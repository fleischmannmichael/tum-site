import { describe, expect, it } from "vitest";
import { SEED } from "./seed";
import { isValidDate, parseBackup, toBackup, validateExam, validateResource } from "./validate";

describe("isValidDate", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isValidDate("2027-02-12")).toBe(true);
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2027-02-29")).toBe(false);
    expect(isValidDate("2027-13-01")).toBe(false);
    expect(isValidDate("12.02.2027")).toBe(false);
  });
});

describe("validateExam", () => {
  it("keeps only filled-in optional fields", () => {
    const r = validateExam({ module: "  Analysis 1 ", date: "", time: "", room: "", done: "" }, "a1");
    expect(r).toEqual({ ok: true, value: { id: "a1", module: "Analysis 1", date: null } });
  });

  it("builds the full detail record", () => {
    const r = validateExam(
      {
        module: "Analysis 1", date: "2027-02-12", time: "09:00", room: "MW 2001", color: "#AABBCC", done: "on",
        durationMin: "120", registrationDeadline: "2027-01-15", retakeDate: "2027-04-08", retakeTime: "13:30",
        allowedAids: "StudentCard\n\n  One A4 sheet  \n", description: "Sequences", notes: "Water",
      },
      "a1",
    );
    expect(r.ok && r.value).toEqual({
      id: "a1", module: "Analysis 1", date: "2027-02-12", time: "09:00", room: "MW 2001", color: "#aabbcc", done: true,
      durationMin: 120, registrationDeadline: "2027-01-15", retake: { date: "2027-04-08", time: "13:30" },
      allowedAids: ["StudentCard", "One A4 sheet"], description: "Sequences", notes: "Water",
    });
  });

  it("keeps a retake with only a room as date TBA", () => {
    const r = validateExam({ module: "A", retakeRoom: "Interims I" }, "a");
    expect(r.ok && r.value.retake).toEqual({ date: null, room: "Interims I" });
  });

  it("reports every problem by field", () => {
    const r = validateExam(
      { module: "", date: "2027-02-30", time: "9:00", durationMin: "0", color: "red", allowedAids: "x".repeat(121) },
      "a",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["allowedAids", "color", "date", "durationMin", "module", "time"]);
  });

  it("needs a date before a time", () => {
    const r = validateExam({ module: "A", time: "09:00" }, "a");
    expect(!r.ok && r.errors.time).toMatch(/date first/);
  });
});

describe("validateResource", () => {
  it("normalises the URL and keeps the module", () => {
    const r = validateResource({ title: "Moodle", url: "https://www.moodle.tum.de", category: "Portals", module: "Analysis 1" }, "r");
    expect(r.ok && r.value).toEqual({ id: "r", title: "Moodle", url: "https://www.moodle.tum.de/", category: "Portals", module: "Analysis 1" });
  });

  it("rejects non-web links", () => {
    for (const url of ["moodle.tum.de", "javascript:alert(1)", "file:///etc/passwd"]) {
      const r = validateResource({ title: "x", url, category: "c" }, "r");
      expect(!r.ok && r.errors.url, url).toBeTruthy();
    }
  });
});

describe("backup", () => {
  it("round-trips", () => {
    const data = { ...SEED, settings: { showSeconds: true, accent: "#6aa8ec" } };
    expect(parseBackup(toBackup(data))).toEqual({ ok: true, value: data });
  });

  it("explains what's wrong with a bad file", () => {
    expect(parseBackup("{")).toEqual({ ok: false, error: "This file isn't valid JSON." });
    expect(parseBackup("{}")).toMatchObject({ ok: false, error: expect.stringMatching(/isn't an Exam Tab backup/) });
    const bad = JSON.stringify({ format: "exam-tab-backup", version: 1, exams: [{ id: "x", module: "A", date: "2027-02-30" }], resources: [] });
    expect(parseBackup(bad)).toEqual({ ok: false, error: "Exam 1 (A): Enter a real date." });
  });

  it("gives duplicate ids fresh ones", () => {
    const file = JSON.stringify({ format: "exam-tab-backup", version: 1, exams: [{ id: "x", module: "A" }, { id: "x", module: "B" }], resources: [] });
    const r = parseBackup(file);
    expect(r.ok && new Set(r.value.exams.map((e) => e.id)).size).toBe(2);
  });
});
