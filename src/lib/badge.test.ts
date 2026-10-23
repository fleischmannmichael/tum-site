import { describe, expect, it } from "vitest";
import { badgeFor, nextMidnight } from "./badge";
import { zonedToInstant } from "./countdown";
import type { Exam } from "./types";

const at = (y: number, m: number, d: number, h = 12, min = 0) => zonedToInstant({ y, m, d, h, min });
const exams: Exam[] = [
  { id: "a", module: "Analysis 1", date: "2027-02-15", time: "08:00" },
  { id: "s", module: "Schaltungstheorie", label: "GOP", date: "2027-02-18", time: "11:00" },
  { id: "t", module: "Computertechnik", date: null },
];

describe("badgeFor", () => {
  it("counts like the countdown squares (whole days to the start time)", () => {
    // 24.10. 12:00 → 15.02. 08:00 is 113 days 20 hours.
    expect(badgeFor(exams, at(2026, 10, 24))).toEqual({ text: "113d", kind: "normal", title: "Analysis 1 in 113 days" });
  });

  it("is warm within 7 days, '1d' the day before, '!' on exam day", () => {
    expect(badgeFor(exams, at(2027, 2, 8)).kind).toBe("soon");
    expect(badgeFor(exams, at(2027, 2, 14, 23, 59))).toMatchObject({ text: "1d", title: "Analysis 1 is tomorrow" });
    // Two calendar days ahead, but only 1 day 12 hours to the start.
    expect(badgeFor(exams, at(2027, 2, 13, 20, 0))).toMatchObject({ text: "1d", title: "Analysis 1 in 1 day" });
    expect(badgeFor(exams, at(2027, 2, 15, 0, 0))).toMatchObject({ text: "!", kind: "today", title: "Analysis 1 is today" });
  });

  it("moves on to the next exam after exam day, with its label", () => {
    expect(badgeFor(exams, at(2027, 2, 16, 9))).toMatchObject({ text: "2d", title: "Schaltungstheorie · GOP in 2 days" });
  });

  it("is empty without dates", () => {
    expect(badgeFor([exams[2]!], at(2026, 10, 24))).toMatchObject({ text: "", kind: "none" });
  });
});

describe("nextMidnight", () => {
  it("is the next Berlin midnight, also across DST", () => {
    expect(nextMidnight(at(2026, 10, 24, 15))).toBe(at(2026, 10, 25, 0));
    expect(nextMidnight(at(2026, 10, 25, 1))).toBe(at(2026, 10, 26, 0)); // 25-hour day
    expect(nextMidnight(at(2026, 10, 24, 0, 0))).toBe(at(2026, 10, 25, 0));
  });
});
