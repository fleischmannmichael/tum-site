import { TIMEZONE, zonedParts } from "./countdown";
import { t } from "./i18n";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Theme = "halloween" | "christmas";
export type HeroVariant = "mobile" | "wide";
/**
 * `path` is relative to the site root, e.g. "hero/autumn/". `variants` lists
 * extra crops in sub-folders: mobile/ (portrait screens), wide/ (21:9).
 * `theme` pictures show automatically in their date window; `video` ones only
 * when picked in Settings.
 */
export type Hero = {
  name: string;
  label?: string;
  season: Season | "any";
  theme?: Theme;
  path: string;
  variants?: HeroVariant[];
  video?: boolean;
};

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

/** When themed pictures take over: [month, first day, last day], Munich dates. */
export const THEME_DAYS: Record<Theme, [month: number, from: number, to: number]> = {
  halloween: [10, 24, 31], // the last week of October
  christmas: [12, 1, 26],
};

export function themeOf(now: number, tz = TIMEZONE): Theme | undefined {
  const { m, d } = zonedParts(now, tz);
  return (Object.keys(THEME_DAYS) as Theme[]).find((t) => {
    const [month, from, to] = THEME_DAYS[t];
    return m === month && d >= from && d <= to;
  });
}

/**
 * The picture for today: a holiday picture in its window, else one for the
 * current season (themed and live ones aside), else an all-year one, rotating
 * by day when there are several. Without any match, any still picture.
 */
export function pickHero(heroes: Hero[], now: number, tz = TIMEZONE): Hero | undefined {
  const stills = heroes.filter((h) => !h.video);
  const theme = themeOf(now, tz);
  const season = seasonOf(now, tz);
  const plain = stills.filter((h) => !h.theme);
  const pools = [
    stills.filter((h) => theme && h.theme === theme),
    plain.filter((h) => h.season === season),
    plain.filter((h) => h.season === "any"),
    plain,
    stills,
  ];
  const pool = pools.find((p) => p.length);
  if (!pool) return undefined;
  const { y, m, d } = zonedParts(now, tz);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return pool[dayNumber % pool.length];
}

/** The picked picture (Settings → Background), or today's automatic one. */
export function chooseHero(heroes: Hero[], choice: string | undefined, now: number, tz = TIMEZONE): Hero | undefined {
  return (choice && heroes.find((h) => h.name === choice)) || pickHero(heroes, now, tz);
}

const CHOICE_KEY = "exam-tab-hero"; // read at start-up, before settings load, so the right picture paints first

export function cachedHeroChoice(): string | undefined {
  try {
    return localStorage.getItem(CHOICE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function cacheHeroChoice(choice: string | undefined): void {
  try {
    if (choice) localStorage.setItem(CHOICE_KEY, choice);
    else localStorage.removeItem(CHOICE_KEY);
  } catch {
    // private mode: the setting still applies once data has loaded
  }
}

const SEASON_WORDS: Record<string, Season> = { spring: "spring", summer: "summer", autumn: "autumn", fall: "autumn", winter: "winter" };

/** Name for the gallery: translated for the usual pictures ("Fall" → "Herbst"), else as generated from the file name. */
export function heroLabel(hero: Hero): string {
  const label = (hero.label ?? hero.name).toLowerCase();
  if (hero.video && label === "live") return t("hero.live");
  if (hero.theme && label === hero.theme) return t(`hero.${hero.theme}`);
  if (SEASON_WORDS[label]) return t(`season.${SEASON_WORDS[label]}`);
  if (label === "non theme" || label === "any" || label === "classic") return t("hero.classic");
  return hero.label ?? hero.name;
}

/** When a picture shows by itself: "Last week of October", "Winter", "All year", "Animated". */
export function heroWhen(hero: Hero): string {
  if (hero.video) return t("settings.bg.live");
  if (hero.theme) return t(`settings.bg.${hero.theme}`);
  return hero.season === "any" ? t("settings.bg.allYear") : t(`settings.bg.in.${hero.season}`);
}
