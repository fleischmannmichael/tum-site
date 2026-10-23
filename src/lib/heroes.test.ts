import { describe, expect, it } from "vitest";
import { zonedToInstant } from "./countdown";
import { chooseHero, heroFolder, pickHero, seasonOf, themeOf, VARIANT_MEDIA, type Hero } from "./heroes";

const at = (y: number, m: number, d: number, h = 12) => zonedToInstant({ y, m, d, h });
const hero = (name: string, season: Hero["season"]): Hero => ({ name, season, path: `/hero/${name}/` });

describe("seasonOf", () => {
  it("uses meteorological seasons in Berlin time", () => {
    expect(seasonOf(at(2026, 10, 23))).toBe("autumn");
    expect(seasonOf(at(2027, 2, 12))).toBe("winter");
    expect(seasonOf(at(2027, 3, 1, 0))).toBe("spring"); // 00:00 Berlin = still Feb 28 in UTC
    expect(seasonOf(at(2027, 7, 1))).toBe("summer");
  });
});

describe("pickHero", () => {
  const all = [hero("autumn", "autumn"), hero("winter-snow", "winter"), hero("winter-night", "winter"), hero("any-night", "any")];

  it("prefers the current season", () => {
    expect(pickHero(all, at(2026, 10, 23))?.name).toBe("autumn");
  });

  it("rotates daily between pictures of one season", () => {
    const a = pickHero(all, at(2027, 1, 10))?.name;
    const b = pickHero(all, at(2027, 1, 11))?.name;
    expect(new Set([a, b])).toEqual(new Set(["winter-snow", "winter-night"]));
    expect(pickHero(all, at(2027, 1, 10, 8))?.name).toBe(a); // stable within a day
  });

  it("falls back to all-year pictures, then to anything", () => {
    expect(pickHero(all, at(2027, 7, 1))?.name).toBe("any-night");
    expect(pickHero([hero("autumn", "autumn")], at(2027, 7, 1))?.name).toBe("autumn");
    expect(pickHero([], at(2027, 7, 1))).toBeUndefined();
  });
});

describe("heroFolder", () => {
  const hero = { name: "fall-hero", season: "autumn", path: "hero/fall-hero/", variants: ["mobile", "wide"] } as const;
  const shape = (matching: string) => (query: string) => query === matching;

  it("uses the crop that fits the window shape", () => {
    expect(heroFolder({ ...hero, variants: [...hero.variants] }, shape(VARIANT_MEDIA.mobile))).toBe("hero/fall-hero/mobile/");
    expect(heroFolder({ ...hero, variants: [...hero.variants] }, shape(VARIANT_MEDIA.wide))).toBe("hero/fall-hero/wide/");
  });

  it("falls back to the main picture", () => {
    expect(heroFolder({ ...hero, variants: [...hero.variants] }, () => false)).toBe("hero/fall-hero/");
    expect(heroFolder({ ...hero, variants: ["wide"] }, shape(VARIANT_MEDIA.mobile))).toBe("hero/fall-hero/");
    expect(heroFolder({ name: "x", season: "any", path: "hero/x/" }, () => true)).toBe("hero/x/");
  });
});

describe("themes, live pictures and a picked picture", () => {
  const all: Hero[] = [
    hero("fall-hero", "autumn"),
    { ...hero("halloween-hero", "autumn"), theme: "halloween" },
    hero("winter-hero", "winter"),
    { ...hero("christmas-hero", "winter"), theme: "christmas" },
    hero("non-theme-hero", "any"),
    { ...hero("hero-video", "any"), video: true },
  ];

  it("shows holiday pictures only in their window", () => {
    expect(themeOf(at(2026, 10, 23))).toBeUndefined();
    expect(pickHero(all, at(2026, 10, 23))?.name).toBe("fall-hero");
    expect(pickHero(all, at(2026, 10, 24, 0))?.name).toBe("halloween-hero");
    expect(pickHero(all, at(2026, 10, 31, 23))?.name).toBe("halloween-hero");
    expect(pickHero(all, at(2026, 11, 1))?.name).toBe("fall-hero");
    expect(pickHero(all, at(2026, 12, 24))?.name).toBe("christmas-hero");
    expect(pickHero(all, at(2026, 12, 27))?.name).toBe("winter-hero");
  });

  it("never picks a live picture or an out-of-window theme by itself", () => {
    expect(pickHero(all, at(2027, 7, 1))?.name).toBe("non-theme-hero");
    expect(pickHero([all[1]!, all[5]!], at(2027, 7, 1))?.name).toBe("halloween-hero"); // nothing else left
  });

  it("uses the picked picture, or today's when the pick is gone", () => {
    expect(chooseHero(all, "hero-video", at(2026, 10, 23))?.name).toBe("hero-video");
    expect(chooseHero(all, "deleted-one", at(2026, 10, 23))?.name).toBe("fall-hero");
    expect(chooseHero(all, undefined, at(2026, 12, 24))?.name).toBe("christmas-hero");
  });
});
