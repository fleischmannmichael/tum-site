import { HEROES } from "../lib/heroes.generated";
import { cacheHeroChoice, chooseHero, heroFolder, VARIANT_MEDIA } from "../lib/heroes";

/*
 * The background picture: today's (by season and holiday) or the one picked in
 * Settings, in the crop that fits the window. A live picture adds a muted,
 * looping video over its still once the video can play.
 */

let choice: string | undefined;
let shown = "";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/** Shows `next` (a picture name, or undefined for automatic). */
export function applyHero(next: string | undefined): void {
  choice = next;
  cacheHeroChoice(choice);
  refresh();
}

function refresh(): void {
  const hero = chooseHero(HEROES, choice, Date.now());
  if (!hero) return;
  const folder = heroFolder(hero, (query) => matchMedia(query).matches);
  const key = `${folder}|${hero.video && !reducedMotion.matches}`;
  if (key === shown) return; // nothing changed: don't restart the picture
  shown = key;

  const root = document.querySelector<HTMLElement>(".hero")!;
  const style = root.style;
  // Relative to the page, so it works at the site root, under /tum-site/ on GitHub Pages, and in the extension.
  const url = (file: string) => new URL(folder + file, document.baseURI).href;
  for (const [layer, file] of [["48", "48.png"], ["96", "96.png"], ["full", "full.webp"]] as const) style.setProperty(`--hero-${layer}`, `url("${url(file)}")`);
  // The default focus point keeps the tower in frame on the main picture; a crop made for the screen is centred.
  if (folder === hero.path) style.removeProperty("--hero-position");
  else style.setProperty("--hero-position", "50% 50%");

  root.querySelector("video")?.remove();
  if (hero.video && !reducedMotion.matches) {
    const video = Object.assign(document.createElement("video"), { muted: true, loop: true, autoplay: true, playsInline: true, src: url("video.mp4") });
    video.className = "hero__layer hero__video";
    video.setAttribute("aria-hidden", "true");
    video.addEventListener("playing", () => video.classList.add("is-playing"), { once: true });
    root.querySelector(".hero__overlay")!.before(video);
    void video.play().catch(() => {}); // autoplay refused: the still stays
  }
}

// Rotating a phone, resizing the window or turning reduced motion on/off can change the picture.
for (const query of [...Object.values(VARIANT_MEDIA), reducedMotion.media]) matchMedia(query).addEventListener("change", refresh);
