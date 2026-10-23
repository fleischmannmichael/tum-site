// Prepares the hero backgrounds. Usage: npm run assets (the deploy runs it too).
//
// Put pictures in assets/heroes/, named after their season or theme:
//   fall_hero.jpg, winter_hero_16x9.jpg, spring-lake.png, summer.webp
//   Halloween_hero_16x9.jpg   shown automatically in the last week of October
//   Christmas_hero_16x9.jpg   shown automatically 1–26 December
//   non-theme-hero-16x9.jpg   (or any-….jpg) usable all year
// Several pictures per season are fine; the site rotates through them by day.
// In Settings → General you can also pick one picture to always show.
//
// Crops for other screens: same name plus a suffix —
//   …_16x9.jpg     the main picture (the suffix is optional)
//   …_mobile.jpg   phones / portrait screens  (also: -phone, -portrait)
//   …_21x9.jpg     ultrawide screens, 21:9    (also: -21-9, -wide, -ultrawide)
// The site picks the one that fits the window and falls back to the main picture.
//
// Videos (.mp4/.webm) become "live" backgrounds you can pick in Settings
// (never chosen automatically): muted, looping, with a still for the load-in
// and for reduced motion. ffmpeg strips the sound and shrinks them; without
// ffmpeg they're skipped with a warning (on the deploy, CI=true, that's an error).
//
// For each picture this writes public/hero/<name>/ with:
//   full.webp       the picture itself (max 2400 px wide)
//   48.png, 96.png  tiny versions for the depixelate-in effect
//   thumb.webp      a small version for the Settings gallery
//   video.mp4       (videos only)
// (plus mobile/ and wide/ with the same files for each crop there is)
// and lists them all in src/lib/heroes.generated.ts.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SRC = fileURLToPath(new URL("../assets/heroes/", import.meta.url));
const OUT = fileURLToPath(new URL("../public/hero/", import.meta.url));
const LIST = fileURLToPath(new URL("../src/lib/heroes.generated.ts", import.meta.url));
const SEASONS = ["spring", "summer", "autumn", "winter"];
const ALIASES = { fall: "autumn", herbst: "autumn", fruehling: "spring", sommer: "summer", any: "any", non: "any", classic: "any" };
// Themes: their season, for when the date window doesn't decide.
const THEMES = { halloween: "autumn", christmas: "winter", xmas: "winter", weihnachten: "winter" };
const MAX_WIDTH = 2400;
const QUALITY = 82; // webp quality for the full picture
const STEPS = [48, 96];
const THUMB_WIDTH = 480;

const all = (await readdir(SRC)).sort();
const images = all.filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
const videos = all.filter((f) => /\.(mp4|webm|mov)$/i.test(f));
if (!images.length && !videos.length) throw new Error(`No pictures in ${SRC}`);

const slugOf = (file) => file.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// "Christmas_hero_21x9.jpg" → base "christmas-hero", variant "wide".
const VARIANTS = { main: ["16x9", "16-9"], mobile: ["mobile", "phone", "portrait"], wide: ["21x9", "21-9", "wide", "ultrawide"] };
function parse(file) {
  const slug = slugOf(file);
  for (const [variant, suffixes] of Object.entries(VARIANTS))
    for (const suffix of suffixes) if (slug.endsWith(`-${suffix}`)) return { name: slug.slice(0, -suffix.length - 1), variant };
  return { name: slug, variant: "main" };
}

/** Season, theme, and a label for the gallery ("christmas-hero" → Christmas). */
function describe(name) {
  const words = name.split("-").filter((w) => w !== "hero");
  const prefix = words[0] ?? "";
  const theme = prefix === "xmas" || prefix === "weihnachten" ? "christmas" : THEMES[prefix] ? prefix : undefined;
  const alias = ALIASES[prefix] ?? prefix;
  const season = theme ? THEMES[theme] : SEASONS.includes(alias) ? alias : "any";
  if (!theme && !SEASONS.includes(alias) && alias !== "any") console.warn(`! ${name}: name doesn't start with a season or theme, using it all year`);
  const label = words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") || name;
  return { season, theme, label };
}

const hashOf = async (file) => createHash("sha256").update(await readFile(`${SRC}${file}`)).digest("hex");

await rm(OUT, { recursive: true, force: true }); // drop pictures that were removed
const groups = new Map();
for (const file of images) {
  const { name, variant } = parse(file);
  const group = groups.get(name) ?? {};
  if (group[variant]) {
    // The same picture uploaded under two names (e.g. _21x9 and _21-9): use one, say so.
    if ((await hashOf(file)) === (await hashOf(group[variant]))) {
      console.warn(`! ${file} is the same picture as ${group[variant]}; using ${group[variant]}`);
      continue;
    }
    throw new Error(`${file} and ${group[variant]} are both the ${variant} picture of "${name}" — keep one`);
  }
  groups.set(name, { ...group, [variant]: file });
}

const heroes = [];
for (const [name, group] of groups) {
  const { season, theme, label } = describe(name);
  if (!group.main) throw new Error(`"${name}" has crops (${Object.values(group).join(", ")}) but no main picture`);
  const variants = [];
  for (const [variant, file] of Object.entries(group)) {
    const dir = variant === "main" ? `${OUT}${name}/` : `${OUT}${name}/${variant}/`;
    await prepare(sharp(`${SRC}${file}`).rotate(), dir, `${name}${variant === "main" ? "" : ` [${variant}]`} (${theme ?? season})`);
    if (variant !== "main") variants.push(variant);
  }
  heroes.push({ name, label, season, ...(theme ? { theme } : {}), path: `hero/${name}/`, ...(variants.length ? { variants: variants.sort() } : {}) });
}

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
for (const file of videos) {
  const name = slugOf(file);
  if (!hasFfmpeg) {
    // On the deploy, a missing video would go unnoticed: fail instead.
    if (process.env.CI) throw new Error(`${file}: ffmpeg isn't installed (needed for videos)`);
    console.warn(`! ${file}: ffmpeg isn't installed, skipping the video`);
    continue;
  }
  const dir = `${OUT}${name}/`;
  await mkdir(dir, { recursive: true });
  // No sound, at most 1280 px wide, quick to start (moov atom first).
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", `${SRC}${file}`, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "25",
    "-pix_fmt", "yuv420p", "-vf", "scale='min(1280,iw)':-2", "-movflags", "+faststart", `${dir}video.mp4`]);
  // The first frame: still for the load-in, reduced motion and the gallery.
  const still = execFileSync("ffmpeg", ["-v", "error", "-i", `${SRC}${file}`, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], {
    maxBuffer: 64 * 1024 * 1024,
  });
  await prepare(sharp(still), dir, `${name} (video)`);
  console.log(`  video.mp4 ${((await stat(`${dir}video.mp4`)).size / 1024).toFixed(0)} KB`);
  heroes.push({ name, label: "Live", season: "any", path: `hero/${name}/`, video: true });
}

async function prepare(img, dir, label) {
  await mkdir(dir, { recursive: true });
  const { width, height } = await img.metadata();
  await img.clone().resize({ width: Math.min(width, MAX_WIDTH), withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(`${dir}full.webp`);
  for (const w of STEPS) await img.clone().resize({ width: w, kernel: "mitchell" }).png({ compressionLevel: 9 }).toFile(`${dir}${w}.png`);
  await img.clone().resize({ width: THUMB_WIDTH }).webp({ quality: 74 }).toFile(`${dir}thumb.webp`);

  const files = ["full.webp", ...STEPS.map((w) => `${w}.png`), "thumb.webp"];
  const sizes = await Promise.all(files.map(async (f) => `${f} ${((await stat(dir + f)).size / 1024).toFixed(1)} KB`));
  console.log(`${label} ${width}×${height}: ${sizes.join(", ")}`);
}

await writeFile(
  LIST,
  `// Generated by scripts/heroes.mjs — don't edit; add pictures to assets/heroes/ instead.\n` +
    `import type { Hero } from "./heroes";\n\n` +
    `export const HEROES: Hero[] = ${JSON.stringify(heroes, null, 2)};\n`,
);
console.log(`→ ${heroes.length} hero picture(s) listed in src/lib/heroes.generated.ts`);
