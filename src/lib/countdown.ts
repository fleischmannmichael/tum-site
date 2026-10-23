import type { Exam } from "./types";

/**
 * Pure date math. Every function takes `now` as epoch ms and never reads the
 * system clock or the system timezone, so results are the same on any machine.
 *
 * Two different notions of "how far away":
 * - calendar days: how many midnights (in Berlin) until exam day; 0 = today.
 *   Used for "112 days", the badge and the ≤ 7 days accent.
 * - duration: exact wall-clock time until the exam starts, split into
 *   days + hh:mm:ss. DST-aware: Sat 10:00 → Mon 10:00 is "2d 00:00:00"
 *   even when that weekend is 47 or 49 real hours long.
 */

export const TIMEZONE = "Europe/Berlin";
const DAY_MS = 86_400_000;

type Ymd = { y: number; m: number; d: number };
type ZonedParts = Ymd & { h: number; min: number; s: number; ms: number };

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock fields of an instant in `tz`. */
export function zonedParts(instant: number, tz = TIMEZONE): ZonedParts {
  const p: Record<string, number> = {};
  for (const { type, value } of formatterFor(tz).formatToParts(instant)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return {
    y: p.year!, m: p.month!, d: p.day!, h: p.hour!, min: p.minute!, s: p.second!,
    ms: ((instant % 1000) + 1000) % 1000,
  };
}

function wallAsUtc(p: Ymd & { h?: number; min?: number; s?: number; ms?: number }): number {
  return Date.UTC(p.y, p.m - 1, p.d, p.h ?? 0, p.min ?? 0, p.s ?? 0, p.ms ?? 0);
}

/**
 * Instant at which the wall clock in `tz` shows the given time.
 * Times inside a DST gap (e.g. 02:30 on spring-forward day) resolve one hour later.
 */
export function zonedToInstant(
  p: Ymd & { h?: number; min?: number; s?: number; ms?: number },
  tz = TIMEZONE,
): number {
  const target = wallAsUtc(p);
  // Offset = wall time − instant; two passes settle it across a DST change.
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const offset = wallAsUtc(zonedParts(guess, tz)) - guess;
    guess = target - offset;
  }
  return guess;
}

export function parseDate(iso: string): Ymd {
  const [y, m, d] = iso.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

function parseTime(time: string | undefined): { h: number; min: number } {
  if (!time) return { h: 0, min: 0 };
  const [h, min] = time.split(":").map(Number);
  return { h: h!, min: min! };
}

function addDays(p: Ymd, days: number): Ymd {
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Midnights between two calendar dates (date-only math, so DST can't skew it). */
export function calendarDaysBetween(from: Ymd, to: Ymd): number {
  return (Date.UTC(to.y, to.m - 1, to.d) - Date.UTC(from.y, from.m - 1, from.d)) / DAY_MS;
}

/** Calendar days from today (Berlin) until exam day. 0 = today, negative = past. */
export function daysUntil(date: string, now: number, tz = TIMEZONE): number {
  return calendarDaysBetween(zonedParts(now, tz), parseDate(date));
}

/** Exam start; without a time, the start of exam day. */
export function examStart(exam: Exam & { date: string }, tz = TIMEZONE): number {
  return zonedToInstant({ ...parseDate(exam.date), ...parseTime(exam.time) }, tz);
}

/** An exam stays "upcoming" until midnight after exam day, even if it has a start time. */
export function examDayEnd(date: string, tz = TIMEZONE): number {
  return zonedToInstant(addDays(parseDate(date), 1), tz);
}

export type Duration = { days: number; hours: number; minutes: number; seconds: number; totalMs: number };

/** Wall-clock duration from `now` to `target` (clamped at zero). */
export function durationUntil(now: number, target: number, tz = TIMEZONE): Duration {
  if (target <= now) return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 };

  // Whole days = how often we can step the wall clock forward by a date
  // (same time of day) without passing the target.
  const n = zonedParts(now, tz);
  let days = calendarDaysBetween(n, zonedParts(target, tz));
  let anchor = target + 1;
  for (; days >= 0; days--) {
    anchor = zonedToInstant({ ...n, ...addDays(n, days) }, tz);
    if (anchor <= target) break;
  }
  days = Math.max(days, 0);
  if (days === 0) anchor = now;

  const rest = target - anchor;
  return {
    days,
    hours: Math.floor(rest / 3_600_000),
    minutes: Math.floor(rest / 60_000) % 60,
    seconds: Math.floor(rest / 1000) % 60,
    totalMs: target - now,
  };
}

export type DatedExam = Exam & { date: string };
export type UpcomingExam = { exam: DatedExam; days: number; start: number };

export type Summary = {
  /** What the headline shows. */
  state:
    | { kind: "none" }
    | { kind: "today"; next: UpcomingExam }
    | { kind: "countdown"; next: UpcomingExam; remaining: Duration };
  /** Dated, not done, not over yet; soonest first. */
  upcoming: UpcomingExam[];
  /** No date yet. */
  tba: Exam[];
  /** Marked done or exam day has ended; most recent first. */
  done: Exam[];
};

const isDated = (e: Exam): e is DatedExam => e.date !== null && e.date !== "";

export function summarize(exams: Exam[], now: number, tz = TIMEZONE): Summary {
  const upcoming: UpcomingExam[] = [];
  const tba: Exam[] = [];
  const done: Exam[] = [];

  for (const exam of exams) {
    if (exam.done || (isDated(exam) && now >= examDayEnd(exam.date, tz))) done.push(exam);
    else if (isDated(exam)) upcoming.push({ exam, days: daysUntil(exam.date, now, tz), start: examStart(exam, tz) });
    else tba.push(exam);
  }

  upcoming.sort((a, b) => a.start - b.start || a.exam.module.localeCompare(b.exam.module));
  done.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const next = upcoming[0];
  const state: Summary["state"] = !next
    ? { kind: "none" }
    : next.days === 0
      ? { kind: "today", next }
      : { kind: "countdown", next, remaining: durationUntil(now, next.start, tz) };

  return { state, upcoming, tba, done };
}
