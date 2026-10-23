import { describe, expect, it } from "vitest";
import { colorSlot, monogram } from "./monogram";

describe("monogram", () => {
  it("uses the first letters of two words", () => {
    expect(monogram("TUM-Live")).toBe("TL");
    expect(monogram("Analysis 1 on Moodle")).toBe("A1");
    expect(monogram("lecture notes")).toBe("LN");
  });

  it("uses two letters of a single word", () => {
    expect(monogram("TUMonline")).toBe("Tu");
    expect(monogram("Artemis")).toBe("Ar");
    expect(monogram("x")).toBe("X");
    expect(monogram("  ")).toBe("?");
  });
});

describe("colorSlot", () => {
  it("is stable and in range", () => {
    expect(colorSlot("www.moodle.tum.de", 6)).toBe(colorSlot("www.moodle.tum.de", 6));
    for (const host of ["campus.tum.de", "artemis.tum.de", "live.rbg.tum.de", "a"]) {
      const s = colorSlot(host, 6);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(6);
    }
  });
});
