import { TIMEZONE, zonedParts } from "./countdown";
import type { FocusEntry } from "./types";

export type { FocusEntry };

/*
 * Pomodoro ("Focus") logic, kept pure so it's easy to test. Time is always
 * measured against an end timestamp, never by counting ticks, so throttled
 * background tabs and reloads can't make it drift.
 */

export type Phase = "focus" | "short" | "long";
export type FocusSettings = { focusMin: number; shortMin: number; longMin: number; rounds: number; sound: boolean };

export const FOCUS_DEFAULTS: FocusSettings = { focusMin: 25, shortMin: 5, longMin: 15, rounds: 4, sound: true };
export const PRESETS = {
  classic: { focusMin: 25, shortMin: 5, longMin: 15 },
  deep: { focusMin: 50, shortMin: 10, longMin: 30 },
} as const;
export type PresetName = keyof typeof PRESETS | "custom";

/** Allowed range for each custom length (minutes) and for rounds. */
export const FOCUS_LIMITS = { focusMin: [1, 180], shortMin: [1, 60], longMin: [1, 120], rounds: [1, 12] } as const;

export function presetOf(s: FocusSettings): PresetName {
  for (const [name, p] of Object.entries(PRESETS) as [keyof typeof PRESETS, (typeof PRESETS)[keyof typeof PRESETS]][])
    if (p.focusMin === s.focusMin && p.shortMin === s.shortMin && p.longMin === s.longMin && s.rounds === FOCUS_DEFAULTS.rounds) return name;
  return "custom";
}

/** A whole number within the limit for `key`, or null. */
export function checkLength(key: keyof typeof FOCUS_LIMITS, value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  const [min, max] = FOCUS_LIMITS[key];
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export type TimerState = {
  phase: Phase;
  /** 1…rounds: which focus session of the current set. */
  round: number;
  status: "idle" | "running" | "paused";
  /** While running: when the phase ends. */
  endsAt: number | null;
  /** While idle/paused: time left. */
  remainingMs: number;
  /** What this session counts toward (a module name), or null. */
  module: string | null;
};

export const phaseMs = (phase: Phase, s: FocusSettings) =>
  60_000 * (phase === "focus" ? s.focusMin : phase === "short" ? s.shortMin : s.longMin);

export function initialState(s: FocusSettings, module: string | null = null): TimerState {
  return { phase: "focus", round: 1, status: "idle", endsAt: null, remainingMs: phaseMs("focus", s), module };
}

export function remaining(st: TimerState, now: number): number {
  return st.status === "running" && st.endsAt !== null ? Math.max(0, st.endsAt - now) : st.remainingMs;
}

/** 0 at the start of the phase, 1 when it's over. */
export function progress(st: TimerState, now: number, s: FocusSettings): number {
  const total = phaseMs(st.phase, s);
  return total ? 1 - remaining(st, now) / total : 1;
}

export const start = (st: TimerState, now: number): TimerState =>
  st.status === "running" ? st : { ...st, status: "running", endsAt: now + st.remainingMs };

export const pause = (st: TimerState, now: number): TimerState =>
  st.status !== "running" ? st : { ...st, status: "paused", remainingMs: remaining(st, now), endsAt: null };

export const reset = (st: TimerState, s: FocusSettings): TimerState => ({ ...st, status: "idle", endsAt: null, remainingMs: phaseMs(st.phase, s) });

/** The phase after this one: focus → short break (or long after the last round) → focus. Waits for Start. */
export function advance(st: TimerState, s: FocusSettings): TimerState {
  let phase: Phase;
  let round = st.round;
  if (st.phase === "focus") phase = st.round >= s.rounds ? "long" : "short";
  else {
    phase = "focus";
    round = st.phase === "long" ? 1 : st.round + 1;
  }
  return { ...st, phase, round, status: "idle", endsAt: null, remainingMs: phaseMs(phase, s) };
}

/** Moves a running timer on once its time is up; `finished` names the phase that just ended. */
export function tick(st: TimerState, now: number, s: FocusSettings): { state: TimerState; finished?: Phase } {
  if (st.status !== "running" || remaining(st, now) > 0) return { state: st };
  return { state: advance(st, s), finished: st.phase };
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ---- Study log ----------------------------------------------------------------
// One entry per day and module (minutes add up), so a year of studying stays
// small enough for Chrome's sync storage.

const KEEP_DAYS = 400; // a full year on the heatmap, plus a little
export const MAX_DAY_MINUTES = 24 * 60;

export const dayOf = (now: number, tz = TIMEZONE) => {
  const { y, m, d } = zonedParts(now, tz);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
const dayNumber = (day: string) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};
const fromDayNumber = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
const daysAgo = (day: string, now: number, tz = TIMEZONE) => dayNumber(dayOf(now, tz)) - dayNumber(day);

/** Whether a day can be logged: today or up to ~a year back. */
export const loggable = (day: string, now: number, tz = TIMEZONE) => {
  const ago = daysAgo(day, now, tz);
  return ago >= 0 && ago < KEEP_DAYS;
};

/** Adds minutes for a day and module (merging with what's there) and forgets anything older than ~a year. */
export function addMinutes(log: FocusEntry[], day: string, module: string | null, minutes: number, now: number, tz = TIMEZONE): FocusEntry[] {
  const kept = log.filter((e) => daysAgo(e.day, now, tz) < KEEP_DAYS);
  const i = kept.findIndex((e) => e.day === day && e.module === module);
  if (i < 0) return daysAgo(day, now, tz) < KEEP_DAYS ? [...kept, { day, module, minutes: Math.min(minutes, MAX_DAY_MINUTES) }] : kept;
  return kept.map((e, j) => (j === i ? { ...e, minutes: Math.min(e.minutes + minutes, MAX_DAY_MINUTES) } : e));
}

/** A finished timer session, counted on the day it ended. */
export const logSession = (log: FocusEntry[], module: string | null, minutes: number, now: number, tz = TIMEZONE) =>
  addMinutes(log, dayOf(now, tz), module, minutes, now, tz);

export const removeEntry = (log: FocusEntry[], day: string, module: string | null) =>
  log.filter((e) => !(e.day === day && e.module === module));

export const entriesOn = (log: FocusEntry[], day: string) =>
  log.filter((e) => e.day === day).sort((a, b) => b.minutes - a.minutes);

/** Colour step for a day: 0 = nothing, then <30 min, <1 h, <2 h, <4 h, 4 h+. */
export function level(minutes: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  if (minutes < 240) return 4;
  return 5;
}

export type HeatDay = { day: string; minutes: number; future: boolean };

/**
 * The heatmap grid: `weeks` columns of Monday…Sunday, the last one holding
 * today. Days after today are marked `future` (drawn empty).
 */
export function heatmap(log: FocusEntry[], now: number, weeks: number, tz = TIMEZONE): HeatDay[][] {
  const totals = new Map<string, number>();
  for (const e of log) totals.set(e.day, (totals.get(e.day) ?? 0) + e.minutes);
  const today = dayNumber(dayOf(now, tz));
  const weekday = (today + 3) % 7; // day 0 (1970-01-01) was a Thursday → Monday = 0
  const firstMonday = today - weekday - 7 * (weeks - 1);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const n = firstMonday + 7 * w + d;
      const day = fromDayNumber(n);
      return { day, minutes: totals.get(day) ?? 0, future: n > today };
    }),
  );
}

/** Days in a row with some studying, ending today (or yesterday, if today is still empty). */
export function streak(log: FocusEntry[], now: number, tz = TIMEZONE): number {
  const studied = new Set(log.filter((e) => e.minutes > 0).map((e) => dayNumber(e.day)));
  let n = dayNumber(dayOf(now, tz));
  if (!studied.has(n)) n--;
  let count = 0;
  while (studied.has(n - count)) count++;
  return count;
}

/** Total minutes over the last `days` days, today included. */
export function minutesSince(log: FocusEntry[], now: number, days: number, tz = TIMEZONE): number {
  return log.filter((e) => daysAgo(e.day, now, tz) < days).reduce((sum, e) => sum + e.minutes, 0);
}

// ---- Importing your own study log ----------------------------------------------

const HEADERS = {
  date: ["date", "datum", "day", "tag"],
  minutes: ["minutes", "minuten", "min", "mins"],
  hours: ["hours", "stunden", "h", "std"],
  duration: ["duration", "dauer", "time", "zeit"],
  module: ["module", "modul", "subject", "fach", "course", "kurs"],
} as const;

/** "2026-10-23", "23.10.2026" or "23.10.26" → "2026-10-23"; anything else → null. */
export function parseDay(text: string): string | null {
  const s = text.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [+m[1]!, +m[2]!, +m[3]!];
  else if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(s))) [d, mo, y] = [+m[1]!, +m[2]!, m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!];
  else return null;
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return t.toISOString().slice(0, 10);
}

/** "90", "1:30" (h:mm), "1.5h", "1,5 h", "45 min", "2 h 15 min" → minutes; null if unreadable. */
export function parseMinutes(text: string, unit: "minutes" | "hours" = "minutes"): number | null {
  const s = text.trim().toLowerCase().replace(",", ".");
  let m = /^(\d+):([0-5]\d)$/.exec(s);
  if (m) return +m[1]! * 60 + +m[2]!;
  m = /^(?:(\d+(?:\.\d+)?)\s*(?:h|std|stunden|hours?))?\s*(?:(\d+)\s*(?:m|min|mins|minuten|minutes?))?$/.exec(s);
  if (m && (m[1] || m[2])) return Math.round(+(m[1] ?? 0) * 60 + +(m[2] ?? 0));
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(+s * (unit === "hours" ? 60 : 1));
  return null;
}

function splitRow(line: string, sep: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (quoted && line[i + 1] === '"') (cell += '"'), i++;
      else quoted = !quoted;
    } else if (c === sep && !quoted) out.push(cell.trim()), (cell = "");
    else cell += c;
  }
  out.push(cell.trim());
  return out;
}

export type ImportRow = { day: string; module: string | null; minutes: number };

/**
 * Reads a study log you kept elsewhere: CSV (comma, semicolon or tab) with
 * a date, a time column (minutes, hours or h:mm) and an optional module —
 * with or without a header row — or JSON ([{ date, minutes, module }]).
 * Module names are matched to `modules` ignoring case.
 */
export function parseStudyLog(text: string, modules: string[] = []): { rows: ImportRow[]; skipped: number } {
  const canonical = (name: unknown) => {
    const s = typeof name === "string" ? name.trim() : "";
    if (!s) return null;
    return modules.find((m) => m.toLowerCase() === s.toLowerCase()) ?? s.slice(0, 60);
  };
  const rows: ImportRow[] = [];
  let skipped = 0;
  const push = (day: string | null, minutes: number | null, module: string | null) => {
    if (day && minutes !== null && minutes > 0 && minutes <= MAX_DAY_MINUTES) rows.push({ day, module, minutes });
    else skipped++;
  };

  const trimmed = text.trim().replace(/^\uFEFF/, "");
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    let raw: unknown;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return { rows, skipped: 1 };
    }
    // Our own backup file has the log under "focusLog".
    const list = Array.isArray(raw) ? raw : typeof raw === "object" && raw && Array.isArray((raw as { focusLog?: unknown }).focusLog) ? (raw as { focusLog: unknown[] }).focusLog : [];
    for (const item of list) {
      if (typeof item !== "object" || !item) {
        skipped++;
        continue;
      }
      const o = item as Record<string, unknown>;
      const minutes = typeof o.minutes === "number" ? Math.round(o.minutes) : typeof o.hours === "number" ? Math.round(o.hours * 60) : parseMinutes(String(o.minutes ?? o.duration ?? ""));
      push(parseDay(String(o.date ?? o.day ?? "")), minutes, canonical(o.module));
    }
    return { rows, skipped };
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows, skipped };
  const sep = [";", "\t", ","].find((c) => lines[0]!.includes(c)) ?? ",";
  const first = splitRow(lines[0]!, sep).map((h) => h.toLowerCase());
  const find = (names: readonly string[]) => first.findIndex((h) => names.includes(h));
  const hasHeader = parseDay(first[0] ?? "") === null && first.some((h) => Object.values(HEADERS).some((names) => (names as readonly string[]).includes(h)));
  let col = { date: 0, time: 1, unit: "minutes" as "minutes" | "hours", module: 2 };
  if (hasHeader) {
    const hours = find(HEADERS.hours);
    const minutes = find(HEADERS.minutes);
    const duration = find(HEADERS.duration);
    col = {
      date: Math.max(find(HEADERS.date), 0),
      time: minutes >= 0 ? minutes : duration >= 0 ? duration : hours,
      unit: minutes < 0 && duration < 0 && hours >= 0 ? "hours" : "minutes",
      module: find(HEADERS.module),
    };
  }
  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const cells = splitRow(line, sep);
    push(parseDay(cells[col.date] ?? ""), col.time >= 0 ? parseMinutes(cells[col.time] ?? "", col.unit) : null, col.module >= 0 ? canonical(cells[col.module]) : null);
  }
  return { rows, skipped };
}

/** The log as CSV (date, minutes, module), oldest first; opens in any spreadsheet. */
export function toCsv(log: FocusEntry[]): string {
  const quote = (s: string) => (/[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = [...log].sort((a, b) => a.day.localeCompare(b.day) || (a.module ?? "").localeCompare(b.module ?? ""));
  return ["date,minutes,module", ...rows.map((e) => `${e.day},${e.minutes},${quote(e.module ?? "")}`)].join("\n") + "\n";
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}
