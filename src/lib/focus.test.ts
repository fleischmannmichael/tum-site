import { describe, expect, it } from "vitest";
import { zonedToInstant } from "./countdown";
import {
  addMinutes, advance, checkLength, FOCUS_DEFAULTS as S, formatClock, formatMinutes, heatmap, initialState, level, logSession, parseDay,
  parseMinutes, parseStudyLog, pause, presetOf, progress, remaining, removeEntry, reset, start, streak, tick, toCsv, type FocusEntry,
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
  it("merges sessions per Munich day and module", () => {
    let log: FocusEntry[] = [];
    log = logSession(log, "Analysis 1", 25, at(2026, 11, 2, 9));
    log = logSession(log, "Analysis 1", 25, at(2026, 11, 2, 23, 50));
    log = logSession(log, null, 25, zonedToInstant({ y: 2026, m: 11, d: 3, h: 0, min: 10 })); // after midnight
    expect(log).toEqual([
      { day: "2026-11-02", module: "Analysis 1", minutes: 50 },
      { day: "2026-11-03", module: null, minutes: 25 },
    ]);
    expect(removeEntry(log, "2026-11-02", "Analysis 1")).toEqual([{ day: "2026-11-03", module: null, minutes: 25 }]);
  });

  it("keeps about a year, caps a day at 24 h", () => {
    const old = addMinutes([], "2025-09-01", "Analysis 1", 25, at(2026, 11, 2));
    expect(old).toEqual([]); // older than 400 days: not added
    const year = addMinutes([], "2025-11-02", null, 25, at(2026, 11, 2));
    expect(year).toHaveLength(1);
    expect(addMinutes(year, "2025-11-02", null, 2000, at(2026, 11, 2))[0]!.minutes).toBe(1440);
  });

  it("builds Monday-first weeks ending with today", () => {
    const log = [{ day: "2026-11-02", module: "x", minutes: 30 }, { day: "2026-11-02", module: null, minutes: 45 }];
    const grid = heatmap(log, at(2026, 11, 4), 2); // Wednesday 4 Nov
    expect(grid).toHaveLength(2);
    expect(grid[0]![0]!.day).toBe("2026-10-26"); // a Monday
    expect(grid[1]![0]).toEqual({ day: "2026-11-02", minutes: 75, future: false });
    expect(grid[1]![2]!.future).toBe(false); // today
    expect(grid[1]![3]!.future).toBe(true);
    expect([0, 10, 45, 90, 200, 300].map(level)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("counts the streak up to today or yesterday", () => {
    const log = ["2026-10-30", "2026-10-31", "2026-11-01"].map((day) => ({ day, module: null, minutes: 10 }));
    expect(streak(log, at(2026, 11, 1))).toBe(3);
    expect(streak(log, at(2026, 11, 2))).toBe(3); // today still empty
    expect(streak(log, at(2026, 11, 3))).toBe(0);
  });

  it("formats minutes", () => {
    expect([formatMinutes(25), formatMinutes(60), formatMinutes(100)]).toEqual(["25 min", "1 h", "1 h 40 min"]);
  });
});

describe("custom timings", () => {
  it("recognises presets and checks limits", () => {
    expect(presetOf(S)).toBe("classic");
    expect(presetOf({ ...S, focusMin: 50, shortMin: 10, longMin: 30 })).toBe("deep");
    expect(presetOf({ ...S, focusMin: 40 })).toBe("custom");
    expect([checkLength("focusMin", "45"), checkLength("focusMin", 0), checkLength("rounds", 13), checkLength("shortMin", "2.5")]).toEqual([45, null, null, null]);
  });
});

describe("importing a study log", () => {
  it("reads dates and durations in common forms", () => {
    expect(["2026-10-23", "23.10.2026", "3.1.27", "2026/2/30", "10/23/2026"].map(parseDay)).toEqual(["2026-10-23", "2026-10-23", "2027-01-03", null, null]);
    expect(["90", "1:30", "1,5 h", "1.5h", "45 min", "2 h 15 min", "abc"].map((s) => parseMinutes(s))).toEqual([90, 90, 90, 90, 45, 135, null]);
    expect(parseMinutes("2", "hours")).toBe(120);
  });

  it("reads CSV with a German header and semicolons", () => {
    const csv = "Datum;Stunden;Fach\n23.10.2026;1,5;analysis 1\n24.10.2026;2;Physik\nkaputt;;\n";
    expect(parseStudyLog(csv, ["Analysis 1"])).toEqual({
      rows: [
        { day: "2026-10-23", module: "Analysis 1", minutes: 90 },
        { day: "2026-10-24", module: "Physik", minutes: 120 },
      ],
      skipped: 1,
    });
  });

  it("reads CSV without a header, and JSON", () => {
    expect(parseStudyLog("2026-10-23,45\n2026-10-24,30,Digitaltechnik").rows).toEqual([
      { day: "2026-10-23", module: null, minutes: 45 },
      { day: "2026-10-24", module: "Digitaltechnik", minutes: 30 },
    ]);
    expect(parseStudyLog('[{"date":"2026-10-23","minutes":20,"module":"X"},{"date":"no"}]').rows).toEqual([{ day: "2026-10-23", module: "X", minutes: 20 }]);
  });

  it("exports CSV that reads back the same", () => {
    const log = [{ day: "2026-10-24", module: "A, B", minutes: 30 }, { day: "2026-10-23", module: null, minutes: 45 }];
    expect(parseStudyLog(toCsv(log)).rows).toEqual([
      { day: "2026-10-23", module: null, minutes: 45 },
      { day: "2026-10-24", module: "A, B", minutes: 30 },
    ]);
  });
});
