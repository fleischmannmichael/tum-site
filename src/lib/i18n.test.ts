import { afterEach, describe, expect, it } from "vitest";
import { DICT, setLang, t, tn } from "./i18n";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("i18n", () => {
  afterEach(() => setLang("en"));

  it("German has the same placeholders as English, for every string", () => {
    for (const key of Object.keys(DICT.en) as (keyof typeof DICT.en)[]) {
      expect(DICT.de[key], key).toBeTruthy();
      expect(placeholders(DICT.de[key]), key).toEqual(placeholders(DICT.en[key]));
    }
  });

  it("fills placeholders and counts", () => {
    expect(t("field.minutes", { n: 90 })).toBe("90 min");
    expect([tn("status.in", 1), tn("status.in", 114)]).toEqual(["In 1 day", "In 114 days"]);
    setLang("de");
    expect([tn("status.in", 1), tn("status.in", 114)]).toEqual(["In 1 Tag", "In 114 Tagen"]);
    expect(t("count.allDone")).toBe("Alle Prüfungen geschafft");
  });

  it("falls back to English for anything but German", () => {
    setLang("fr" as never);
    expect(t("nav.focus")).toBe("Focus");
  });
});
