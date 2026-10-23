import { HEROES } from "../lib/heroes.generated";
import { heroLabel, heroWhen, pickHero, type Hero, type HeroVariant } from "../lib/heroes";
import { t } from "../lib/i18n";

/*
 * Settings → General → Background picture: a gallery of every picture.
 * Clicking a card previews it (in the desktop, phone or 21:9 crop, with the
 * page's dark overlay); "Use this picture" makes it the background.
 * "Automatic" goes back to season and holiday pictures.
 */

const AUTO = "";
const ORDER = ["spring", "summer", "autumn", "winter", "any"];
const sorted = [...HEROES].sort(
  (a, b) =>
    Number(!!a.video) - Number(!!b.video) ||
    ORDER.indexOf(a.season) - ORDER.indexOf(b.season) ||
    Number(!!a.theme) - Number(!!b.theme) ||
    a.name.localeCompare(b.name),
);

type Crop = "desktop" | HeroVariant;
const CROPS: [Crop, "settings.bg.desktop" | "settings.bg.phone" | "settings.bg.wide"][] = [
  ["desktop", "settings.bg.desktop"],
  ["mobile", "settings.bg.phone"],
  ["wide", "settings.bg.wide"],
];

// Picture paths are relative to the site root; Settings lives one folder down.
const asset = (path: string) => new URL(`../${path}`, document.baseURI).href;
const folder = (hero: Hero, crop: Crop) => (crop !== "desktop" && hero.variants?.includes(crop) ? `${hero.path}${crop}/` : hero.path);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text) n.textContent = text;
  return n;
}

export type Gallery = { render(current: string | undefined): void };

export function initGallery(root: HTMLElement, onUse: (choice: string | undefined, label: string) => void): Gallery {
  let current: string | undefined; // what's in use (undefined = automatic)
  let previewing = AUTO; // what the preview shows (AUTO = automatic)
  let crop: Crop = "desktop";

  const today = () => pickHero(HEROES, Date.now());
  const heroFor = (name: string) => (name === AUTO ? today() : HEROES.find((h) => h.name === name));
  const nameOf = (name: string) => {
    if (name !== AUTO) return heroLabel(heroFor(name)!);
    const auto = today();
    return auto ? `${t("settings.bg.auto")} (${t("settings.bg.today", { name: heroLabel(auto) })})` : t("settings.bg.auto");
  };

  function renderPreview(): void {
    const hero = heroFor(previewing);
    const frame = root.querySelector<HTMLElement>(".gallery__frame")!;
    frame.dataset.crop = crop;
    const media = frame.querySelector<HTMLElement>(".gallery__media")!;
    if (!hero) return media.replaceChildren();
    const dir = folder(hero, crop);
    // The page centres the screen-made crops and keeps the tower in frame on the main picture.
    frame.style.setProperty("--hero-position", dir === hero.path ? "" : "50% 50%");
    const still = el("img", "gallery__img");
    still.src = asset(`${dir}full.webp`);
    still.alt = "";
    const layers: HTMLElement[] = [still];
    if (hero.video && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const video = Object.assign(el("video", "gallery__img"), { muted: true, loop: true, autoplay: true, playsInline: true, src: asset(`${hero.path}video.mp4`) });
      layers.push(video);
    }
    media.replaceChildren(...layers);
    root.querySelector(".gallery__caption")!.textContent = nameOf(previewing);
    root.querySelector(".gallery__note")!.textContent =
      crop !== "desktop" && !hero.variants?.includes(crop) ? t("settings.bg.noCrop") : "";

    const use = root.querySelector<HTMLButtonElement>(".gallery__use")!;
    const inUse = (current ?? AUTO) === previewing;
    use.disabled = inUse;
    use.textContent = inUse ? t("settings.bg.using") : t("settings.bg.use");
    root.querySelector(".gallery__status")!.textContent = t("settings.bg.inUse", { name: nameOf(current ?? AUTO) });
  }

  function card(name: string): HTMLLabelElement {
    const hero = heroFor(name);
    const label = el("label", "gallery__card");
    const input = el("input");
    input.type = "radio";
    input.name = "hero-preview";
    input.value = name;
    input.checked = name === previewing;
    input.addEventListener("change", () => {
      previewing = name;
      for (const c of Array.from(root.querySelectorAll(".gallery__card"))) c.classList.toggle("is-previewing", c === label);
      renderPreview();
    });
    const thumb = el("span", "gallery__thumb");
    if (hero) thumb.style.backgroundImage = `url("${asset(`${hero.path}thumb.webp`)}")`;
    if (name === AUTO) thumb.append(el("span", "gallery__badge", "A"));
    if (hero?.video && name !== AUTO) thumb.append(el("span", "gallery__badge gallery__badge--live", "▶"));
    const text = el("span", "gallery__text");
    text.append(
      el("span", "gallery__name", name === AUTO ? t("settings.bg.auto") : heroLabel(hero!)),
      el("span", "gallery__when", name === AUTO ? (hero ? t("settings.bg.today", { name: heroLabel(hero) }) : "") : heroWhen(hero!)),
    );
    if ((current ?? AUTO) === name) text.append(el("span", "gallery__in-use", t("settings.bg.using")));
    label.classList.toggle("is-previewing", name === previewing);
    label.append(input, thumb, text);
    return label;
  }

  function build(): void {
    const frame = el("div", "gallery__frame");
    frame.setAttribute("aria-hidden", "true");
    const mock = el("div", "gallery__mock");
    mock.append(el("span", "gallery__mock-nav"), el("span", "gallery__mock-title", t("page.title")));
    frame.append(el("div", "gallery__media"), el("div", "gallery__overlay"), mock);

    const crops = el("div", "chips gallery__crops");
    crops.setAttribute("role", "radiogroup");
    crops.setAttribute("aria-label", t("settings.bg.crop"));
    for (const [value, key] of CROPS) {
      const chip = el("label", "chip");
      const input = el("input");
      input.type = "radio";
      input.name = "hero-crop";
      input.value = value;
      input.checked = value === crop;
      input.addEventListener("change", () => {
        crop = value;
        renderPreview();
      });
      chip.append(input, el("span", "", t(key)));
      crops.append(chip);
    }

    const use = el("button", "btn btn--primary gallery__use");
    use.type = "button";
    use.addEventListener("click", () => {
      const choice = previewing === AUTO ? undefined : previewing;
      onUse(choice, nameOf(previewing));
    });

    const side = el("div", "gallery__side");
    side.append(el("p", "gallery__caption"), el("p", "gallery__status"), crops, el("p", "gallery__note"), use);
    const top = el("div", "gallery__top");
    top.append(frame, side);

    const grid = el("div", "gallery__grid");
    grid.setAttribute("role", "radiogroup");
    grid.setAttribute("aria-label", t("settings.bg.pictures"));
    grid.append(card(AUTO), ...sorted.map((h) => card(h.name)));

    root.replaceChildren(top, grid);
    renderPreview();
  }

  return {
    render(next) {
      const changed = next !== current;
      current = next;
      // First time (or after saving): preview what's in use.
      if (!root.childElementCount || changed) previewing = current ?? AUTO;
      const hadFocus = root.contains(document.activeElement);
      build();
      if (hadFocus) root.querySelector<HTMLElement>('input[name="hero-preview"]:checked')?.focus();
    },
  };
}
