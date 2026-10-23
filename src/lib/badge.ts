import { examClock, summarize, TIMEZONE, zonedParts, zonedToInstant } from "./countdown";
import type { Exam } from "./types";

/** Exams this many days away (or fewer) are "soon": warm badge. Same rule as the countdown. */
const SOON_DAYS = 7;

export type Badge = { text: string; kind: "none" | "today" | "soon" | "normal"; title: string };

/** Toolbar badge for the next exam: "113d", "1d", "!" on exam day, empty without dates. */
export function badgeFor(exams: Exam[], now: number, tz = TIMEZONE): Badge {
  const { state } = summarize(exams, now, tz);
  if (state.kind === "none") return { text: "", kind: "none", title: "Exam countdown — no exam dates yet" };
  const { exam, days } = state.next;
  const name = [exam.module, exam.label].filter(Boolean).join(" · ");
  if (state.kind === "today") return { text: "!", kind: "today", title: `${name} is today` };
  // Same count as the countdown squares (whole 24-hour periods), except that
  // tomorrow always reads "1d", like "Tomorrow" in the pop-up.
  const clock = examClock(exam, now, tz);
  const n = days === 1 || clock.kind !== "counting" ? 1 : Math.max(clock.remaining.days, 1);
  return {
    text: `${n}d`,
    kind: days <= SOON_DAYS ? "soon" : "normal",
    title: days === 1 ? `${name} is tomorrow` : `${name} in ${n} ${n === 1 ? "day" : "days"}`,
  };
}

/** The next local (Berlin) midnight after `now`, when day counts change. */
export function nextMidnight(now: number, tz = TIMEZONE): number {
  const { y, m, d } = zonedParts(now, tz);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return zonedToInstant({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }, tz);
}
