import { describe, expect, it } from "vitest";
import { summarize, zonedToInstant } from "./countdown";
import { greeting, personalLines } from "./personal";
import { SEED } from "./seed";

const at = (y: number, m: number, d: number, h = 12, min = 0) => zonedToInstant({ y, m, d, h, min });
const input = (now: number, extra: Partial<Parameters<typeof personalLines>[0]> = {}) => ({
  name: "Michael",
  lang: "en" as const,
  now,
  summary: summarize(SEED.exams, now),
  focusLog: [],
  checklists: {},
  ...extra,
});

describe("greeting", () => {
  it("follows the time of day, with or without a name", () => {
    expect(greeting({ name: "Michael", lang: "en", now: at(2026, 10, 23, 8) })).toBe("Good morning, Michael");
    expect(greeting({ name: "Michael", lang: "de", now: at(2026, 10, 23, 12) })).toBe("Mahlzeit, Michael");
    expect(greeting({ name: " ", lang: "en", now: at(2026, 10, 23, 19) })).toBe("Good evening");
    expect(greeting({ lang: "de", now: at(2026, 10, 23, 2) })).toBe("Noch wach");
  });
});

describe("personalLines", () => {
  it("talks about the next exam first, addressed by name", () => {
    const lines = personalLines(input(at(2026, 10, 23, 12))); // a Friday, 115 days before Analysis 1
    expect(lines[0]).toBe("114 days until Analysis 1, Michael. Plenty of time — if today counts."); // like the tile
    expect(lines).toContain("Friday, Michael. Close one topic, then enjoy the weekend.");
    expect(lines.at(-1)).toBe("You've got this, Michael.");
  });

  it("reacts to exam day, tomorrow and late nights", () => {
    expect(personalLines(input(at(2027, 2, 15, 7)))[0]).toBe("Today's the day, Michael. You've got Analysis 1.");
    expect(personalLines(input(at(2027, 2, 14, 20)))[0]).toBe("Analysis 1 is tomorrow, Michael. Pack your things, sleep early.");
    expect(personalLines(input(at(2026, 10, 23, 23, 30)))).toContain("It's late, Michael. Sleep is part of studying too.");
  });

  it("uses the study log and the checklist", () => {
    const now = at(2026, 10, 23, 17);
    const lines = personalLines(
      input(now, {
        focusLog: [
          { day: "2026-10-21", module: null, minutes: 30 },
          { day: "2026-10-22", module: null, minutes: 30 },
          { day: "2026-10-23", module: "Analysis 1", minutes: 50 },
        ],
        checklists: { "Analysis 1": [{ id: "a", text: "Folgen", done: true }, { id: "b", text: "Reihen", done: false }] },
      }),
    );
    expect(lines).toContain("50 min logged today, Michael. Nice start.");
    expect(lines).toContain("3 days in a row, Michael. Don't break the chain.");
    expect(lines).toContain("1 of 2 topics in Analysis 1 done, Michael. Which one is next?");
    expect(personalLines(input(now))).toContain("Nothing logged yet today, Michael. One 25-minute round?");
  });

  it("speaks German and works without a name", () => {
    const lines = personalLines(input(at(2026, 10, 26, 10), { lang: "de", name: undefined })); // Monday
    expect(lines[0]).toBe("Noch 111 Tage bis Analysis 1. Reichlich Zeit – wenn heute zählt.");
    expect(lines).toContain("Neue Woche. Was ist das eine, das du fertig machst?");
    expect(lines.every((l) => !l.includes("undefined") && !l.includes(", ."))).toBe(true);
  });
});
