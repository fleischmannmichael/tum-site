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


export const WINDOWS_PER_DAY = 8; // the tower facade has 8 windows to light
const KEEP_DAYS = 90;

const dayOf = (now: number, tz = TIMEZONE) => {
  const { y, m, d } = zonedParts(now, tz);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
const daysAgo = (day: string, now: number, tz = TIMEZONE) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const t = zonedParts(now, tz);
  return Math.round((Date.UTC(t.y, t.m - 1, t.d) - Date.UTC(y, m - 1, d)) / 86_400_000);
};

/** Adds a session and forgets anything older than 90 days. */
export function logSession(log: FocusEntry[], module: string | null, minutes: number, now: number, tz = TIMEZONE): FocusEntry[] {
  return [...log.filter((e) => daysAgo(e.day, now, tz) < KEEP_DAYS), { day: dayOf(now, tz), module, minutes }];
}

export function today(log: FocusEntry[], now: number, tz = TIMEZONE): { sessions: number; minutes: number } {
  const mine = log.filter((e) => e.day === dayOf(now, tz));
  return { sessions: mine.length, minutes: mine.reduce((sum, e) => sum + e.minutes, 0) };
}

/** Minutes per module over the last 7 days (today included), most first. */
export function week(log: FocusEntry[], now: number, tz = TIMEZONE): { module: string | null; minutes: number }[] {
  const totals = new Map<string | null, number>();
  for (const e of log) if (daysAgo(e.day, now, tz) < 7) totals.set(e.module, (totals.get(e.module) ?? 0) + e.minutes);
  return [...totals]
    .map(([module, minutes]) => ({ module, minutes }))
    .sort((a, b) => b.minutes - a.minutes || (a.module ?? "~").localeCompare(b.module ?? "~")); // ties: A–Z, "no module" last
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}
