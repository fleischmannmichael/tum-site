import { TIMEZONE, zonedParts } from "./countdown";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type HeroVariant = "mobile" | "wide";
/**
 * `path` is relative to the site root, e.g. "hero/autumn/". `variants` lists
 * extra crops in sub-folders: mobile/ (portrait screens), wide/ (21:9).
 */
export type Hero = { name: string; season: Season | "any"; path: string; variants?: HeroVariant[] };

/** Window shapes that get their own crop: portrait (phones) and ultrawide (21:9 ≈ 2.33). */
export const VARIANT_MEDIA: Record<HeroVariant, string> = {
  mobile: "(max-aspect-ratio: 3/4)",
  wide: "(min-aspect-ratio: 2/1)",
};

/** Folder of the crop that suits the window, or the main picture's. */
export function heroFolder(hero: Hero, matches: (query: string) => boolean): string {
  const variant = hero.variants?.find((v) => matches(VARIANT_MEDIA[v]));
  return variant ? `${hero.path}${variant}/` : hero.path;
}

/** Meteorological seasons in Munich: spring Mar–May, summer Jun–Aug, autumn Sep–Nov, winter Dec–Feb. */
export function seasonOf(now: number, tz = TIMEZONE): Season {
  const m = zonedParts(now, tz).m;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

/**
 * The picture for today: one for the current season (or an all-year one),
 * rotating by day when there are several. Without any match, any picture.
 */
export function pickHero(heroes: Hero[], now: number, tz = TIMEZONE): Hero | undefined {
  const season = seasonOf(now, tz);
  const own = heroes.filter((h) => h.season === season);
  const pool = own.length ? own : heroes.filter((h) => h.season === "any").length ? heroes.filter((h) => h.season === "any") : heroes;
  if (!pool.length) return undefined;
  const { y, m, d } = zonedParts(now, tz);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return pool[dayNumber % pool.length];
}
