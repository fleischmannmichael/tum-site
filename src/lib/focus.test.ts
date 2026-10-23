import { describe, expect, it } from "vitest";
import { zonedToInstant } from "./countdown";
import {
  advance, FOCUS_DEFAULTS as S, formatClock, formatMinutes, initialState, logSession, pause, progress, remaining, reset, start, tick, today, week,
  type FocusEntry,
} from "./focus";

const at = (y: number, m: number, d: number, h = 12, min = 0) => zonedToInstant({ y, m, d, h, min });
const t0 = at(2026, 11, 2, 9);

describe("timer", () => {
  it("runs against an end time, pauses and resumes exactly", () => {
    let st = start(initialState(S), t0);
    expect(remaining(st, t0 + 60_000)).toBe(24 * 60_000);
    st = pause(st, t0 + 10 * 60_000);
    expect(st).toMatchObject({ status: "paused", remainingMs: 15 * 60_000, endsAt: null });
    expect(remaining(st, t0 + 99 * 60_000)).toBe(15 * 60_000); // paused: no time passes
    st = start(st, t0 + 20 * 60_000);
    expect(st.endsAt).toBe(t0 + 35 * 60_000);
    expect(progress(st, t0 + 20 * 60_000, S)).toBeCloseTo(0.4);
  });

  it("finishes a focus phase into a short break, waiting for Start", () => {
    const st = start(initialState(S, "Analysis 1"), t0);
    expect(tick(st, t0 + 25 * 60_000 - 1, S).finished).toBeUndefined();
    const { state, finished } = tick(st, t0 + 25 * 60_000, S);
    expect(finished).toBe("focus");
    expect(state).toMatchObject({ phase: "short", round: 1, status: "idle", remainingMs: 5 * 60_000, module: "Analysis 1" });
  });

  it("cycles focus → short ×3 → long after the 4th round → focus round 1", () => {
    let st = initialState(S);
    const seen: string[] = [];
    for (let i = 0; i < 9; i++) {
      seen.push(`${st.phase}${st.round}`);
      st = advance(st, S);
    }
    expect(seen).toEqual(["focus1", "short1", "focus2", "short2", "focus3", "short3", "focus4", "long4", "focus1"]);
  });

  it("reset restores the full phase", () => {
    const st = pause(start(initialState(S), t0), t0 + 5 * 60_000);
    expect(reset(st, S)).toMatchObject({ status: "idle", remainingMs: 25 * 60_000 });
  });

  it("formats the clock, rounding up partial seconds", () => {
    expect(formatClock(25 * 60_000)).toBe("25:00");
    expect(formatClock(61_001)).toBe("01:02");
    expect(formatClock(0)).toBe("00:00");
  });
});

describe("study log", () => {
  it("counts today's sessions in Munich time", () => {
    let log: FocusEntry[] = [];
    log = logSession(log, "Analysis 1", 25, at(2026, 11, 2, 9));
    log = logSession(log, "Digitaltechnik", 25, at(2026, 11, 2, 23, 50));
    log = logSession(log, null, 25, zonedToInstant({ y: 2026, m: 11, d: 3, h: 0, min: 10 })); // after midnight
    expect(today(log, at(2026, 11, 2, 23, 59))).toEqual({ sessions: 2, minutes: 50 });
  });

  it("sums the last 7 days per module, most first", () => {
    let log: FocusEntry[] = [];
    log = logSession(log, "Linear Algebra", 50, at(2026, 10, 20)); // 13 days before: not this week
    log = logSession(log, "Analysis 1", 25, at(2026, 10, 28));
    log = logSession(log, "Linear Algebra", 50, at(2026, 11, 1));
    log = logSession(log, "Analysis 1", 25, at(2026, 11, 2));
    log = logSession(log, null, 75, at(2026, 11, 2));
    expect(week(log, at(2026, 11, 2))).toEqual([
      { module: null, minutes: 75 },
      { module: "Analysis 1", minutes: 50 }, // tie with Linear Algebra: A–Z
      { module: "Linear Algebra", minutes: 50 },
    ]);
  });

  it("forgets sessions older than 90 days", () => {
    const old = logSession([], "Analysis 1", 25, at(2026, 6, 1));
    expect(logSession(old, null, 25, at(2026, 11, 2))).toHaveLength(1);
  });

  it("formats minutes", () => {
    expect([formatMinutes(25), formatMinutes(60), formatMinutes(100)]).toEqual(["25 min", "1 h", "1 h 40 min"]);
  });
});
