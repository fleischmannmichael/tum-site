import { describe, expect, it } from "vitest";
import {
  daysUntil,
  durationUntil,
  examDayEnd,
  examStart,
  summarize,
  zonedToInstant,
} from "./countdown";
import { formatDateDE, formatDuration } from "./format";
import type { Exam } from "./types";

/** Berlin wall-clock time → epoch ms, written as "2026-10-23 09:00[:ss[.mmm]]". */
function berlin(s: string): number {
  const [date, time = "00:00"] = s.split(" ");
  const [y, m, d] = date!.split("-").map(Number);
  const [h, min, sec = "0"] = time.split(":");
  const [secWhole, ms = "0"] = sec.split(".");
  return zonedToInstant({ y: y!, m: m!, d: d!, h: +h!, min: +min!, s: +secWhole!, ms: +ms.padEnd(3, "0") });
}

const exam = (over: Partial<Exam> & { module: string }): Exam => ({ id: over.module, date: null, ...over });
const hours = (ms: number) => ms / 3_600_000;

describe("zonedToInstant", () => {
  it("handles summer (CEST, UTC+2) and winter (CET, UTC+1) time", () => {
    expect(new Date(berlin("2026-10-23 09:00")).toISOString()).toBe("2026-10-23T07:00:00.000Z");
    expect(new Date(berlin("2026-11-02 09:00")).toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });

  it("resolves a time inside the spring-forward gap one hour later", () => {
    // 2027-03-28 02:30 does not exist in Berlin; clocks jump 02:00 → 03:00.
    expect(new Date(berlin("2027-03-28 02:30")).toISOString()).toBe("2027-03-28T01:30:00.000Z");
  });
});

describe("daysUntil (calendar days)", () => {
  it("matches the spec example: 23.10.2026 → 12.02.2027 is 112 days", () => {
    expect(daysUntil("2027-02-12", berlin("2026-10-23 10:00"))).toBe(112);
  });

  it("flips exactly at Berlin midnight", () => {
    expect(daysUntil("2027-02-10", berlin("2027-02-09 23:59:59.999"))).toBe(1);
    expect(daysUntil("2027-02-10", berlin("2027-02-10 00:00"))).toBe(0);
  });

  it("uses Berlin's date, not UTC's", () => {
    // 23:30 UTC on the 9th is already 00:30 on the 10th in Berlin.
    expect(daysUntil("2027-02-10", Date.parse("2027-02-09T23:30:00Z"))).toBe(0);
  });

  it("is not skewed by a 25-hour day", () => {
    expect(daysUntil("2026-10-26", berlin("2026-10-24 23:30"))).toBe(2);
  });
});

describe("durationUntil (DST-aware)", () => {
  it("fall back: Sat 10:00 → Mon 10:00 is 2d 00:00:00 although 49 h pass", () => {
    const now = berlin("2026-10-24 10:00");
    const target = berlin("2026-10-26 10:00");
    expect(hours(target - now)).toBe(49);
    expect(durationUntil(now, target)).toMatchObject({ days: 2, hours: 0, minutes: 0, seconds: 0 });
  });

  it("spring forward: Sat 12:00 → Mon 12:00 is 2d 00:00:00 although 47 h pass", () => {
    const now = berlin("2027-03-27 12:00");
    const target = berlin("2027-03-29 12:00");
    expect(hours(target - now)).toBe(47);
    expect(durationUntil(now, target)).toMatchObject({ days: 2, hours: 0, minutes: 0, seconds: 0 });
  });

  it("counts the remaining hours of a DST night as real hours", () => {
    // From 22:00 Saturday to 09:00 Sunday (fall back) is 12 real hours.
    expect(durationUntil(berlin("2026-10-24 22:00"), berlin("2026-10-25 09:00"))).toMatchObject({
      days: 0,
      hours: 12,
    });
  });

  it("splits the spec example into days and clock", () => {
    const d = durationUntil(berlin("2026-10-23 10:00:00"), berlin("2027-02-12 09:00"));
    expect(d).toMatchObject({ days: 111, hours: 23, minutes: 0, seconds: 0 });
    expect(formatDuration(d, true)).toBe("111d 23:00:00");
    expect(formatDuration(d, false)).toBe("111d 23:00");
  });

  it("ticks seconds and clamps at zero", () => {
    expect(durationUntil(berlin("2027-02-12 08:59:58.500"), berlin("2027-02-12 09:00"))).toMatchObject({
      days: 0, hours: 0, minutes: 0, seconds: 1,
    });
    expect(durationUntil(berlin("2027-02-12 09:00:01"), berlin("2027-02-12 09:00")).totalMs).toBe(0);
  });
});

describe("exam boundaries", () => {
  it("starts at the given time, or at midnight without one", () => {
    expect(examStart({ id: "a", module: "A", date: "2027-02-12", time: "09:00" })).toBe(berlin("2027-02-12 09:00"));
    expect(examStart({ id: "a", module: "A", date: "2027-02-12" })).toBe(berlin("2027-02-12 00:00"));
  });

  it("ends at the following Berlin midnight, also across DST", () => {
    expect(examDayEnd("2026-10-25")).toBe(berlin("2026-10-26 00:00"));
    expect(examDayEnd("2026-10-25") - berlin("2026-10-25 00:00")).toBe(25 * 3_600_000);
  });
});

describe("summarize", () => {
  const seed: Exam[] = ["Analysis 1", "Linear Algebra", "Schaltungstheorie"].map((module) => exam({ module }));

  it("all dates TBA → none", () => {
    const s = summarize(seed, berlin("2026-10-23 10:00"));
    expect(s.state.kind).toBe("none");
    expect(s.tba).toHaveLength(3);
    expect(s.upcoming).toHaveLength(0);
  });

  it("next = earliest dated, not done, not over", () => {
    const exams = [
      exam({ module: "Done early", date: "2027-02-01", done: true }),
      exam({ module: "Later", date: "2027-02-20" }),
      exam({ module: "Past", date: "2026-10-01" }),
      exam({ module: "Sooner", date: "2027-02-12", time: "09:00" }),
      exam({ module: "TBA" }),
    ];
    const s = summarize(exams, berlin("2026-10-23 10:00"));
    expect(s.state.kind).toBe("countdown");
    if (s.state.kind !== "countdown") return;
    expect(s.state.next.exam.module).toBe("Sooner");
    expect(s.state.next.days).toBe(112);
    expect(s.upcoming.map((u) => u.exam.module)).toEqual(["Sooner", "Later"]);
    expect(s.done.map((e) => e.module)).toEqual(["Done early", "Past"]);
    expect(s.tba.map((e) => e.module)).toEqual(["TBA"]);
  });

  it("orders same-day exams by start time", () => {
    const exams = [
      exam({ module: "Afternoon", date: "2027-02-12", time: "14:00" }),
      exam({ module: "Morning", date: "2027-02-12", time: "09:00" }),
    ];
    expect(summarize(exams, berlin("2027-01-01 12:00")).upcoming[0]!.exam.module).toBe("Morning");
  });

  describe("end-of-day edge", () => {
    const exams = [exam({ module: "Analysis 1", date: "2027-02-10", time: "09:00", room: "MW 2001" })];

    it("is 'today' from midnight, through the exam, until the day ends", () => {
      for (const t of ["2027-02-10 00:00", "2027-02-10 08:59", "2027-02-10 15:00", "2027-02-10 23:59:59.999"]) {
        expect(summarize(exams, berlin(t)).state.kind, t).toBe("today");
      }
    });

    it("counts down the evening before", () => {
      const s = summarize(exams, berlin("2027-02-09 23:59:59"));
      expect(s.state.kind).toBe("countdown");
      if (s.state.kind === "countdown") expect(s.state.remaining).toMatchObject({ days: 0, hours: 9, minutes: 0, seconds: 1 });
    });

    it("moves to done at the next midnight", () => {
      const s = summarize(exams, berlin("2027-02-11 00:00"));
      expect(s.state.kind).toBe("none");
      expect(s.done.map((e) => e.module)).toEqual(["Analysis 1"]);
    });
  });
});

describe("format", () => {
  it("shows German dates", () => {
    expect(formatDateDE("2026-10-23")).toBe("23.10.2026");
  });
});
