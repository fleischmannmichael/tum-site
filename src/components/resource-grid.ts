import { el } from "../lib/dom";
import { colorSlot, monogram } from "../lib/monogram";
import { t } from "../lib/i18n";
import type { Resource } from "../lib/types";

const COLORS = 6; // --module-1 … --module-6
/** Stored category name (data, so not translated); shown as t("links.lectureNotes"). */
export const LECTURE_NOTES = "Lecture notes";

function host(url: string): string {
  return new URL(url).host.replace(/^www\./, "");
}

function icon(text: string, colorKey: string): HTMLSpanElement {
  const i = el("span", "link-card__icon", text);
  i.style.setProperty("--tint", `var(--module-${colorSlot(colorKey, COLORS)})`);
  i.setAttribute("aria-hidden", "true");
  return i;
}

/** A link as a card: monogram, title, host. Opens in this tab (it's the new tab anyway). */
export function linkCard(r: Resource): HTMLLIElement {
  const a = el("a", "link-card glass-card");
  a.href = r.url;
  const text = el("span", "link-card__text");
  text.append(el("span", "link-card__title", r.title), el("span", "link-card__host", host(r.url)));
  a.append(icon(monogram(r.title), host(r.url)), text);
  const li = el("li");
  li.append(a);
  return li;
}

/** Settings link that opens the "Add link" form prefilled. */
export function addLinkHref(prefill: { module?: string; category?: string; title?: string } = {}): string {
  const params = new URLSearchParams({ "add-resource": "" });
  for (const [k, v] of Object.entries(prefill)) if (v) params.set(k, v);
  return `settings/index.html#${params.toString()}`;
}

/** Placeholder card for a link that isn't set yet (e.g. a module's lecture notes). */
export function emptySlot(title: string, hint: string, href: string): HTMLLIElement {
  const a = el("a", "link-card link-card--empty");
  a.href = href;
  const text = el("span", "link-card__text");
  text.append(el("span", "link-card__title", title), el("span", "link-card__host", hint));
  const plus = el("span", "link-card__icon link-card__icon--add", "+");
  plus.setAttribute("aria-hidden", "true");
  a.append(plus, text);
  const li = el("li");
  li.append(a);
  return li;
}

export function linkGrid(items: HTMLLIElement[]): HTMLUListElement {
  const ul = el("ul", "link-grid");
  ul.append(...items);
  return ul;
}

const byTitle = (a: Resource, b: Resource) => a.title.localeCompare(b.title);

/** One module's links, plus an empty "Lecture notes" slot until one exists. */
export function moduleLinks(module: string, resources: Resource[]): HTMLUListElement {
  const own = resources.filter((r) => r.module === module).sort(byTitle);
  const items = own.map(linkCard);
  if (!own.some((r) => r.category === LECTURE_NOTES))
    items.unshift(
      emptySlot(t("links.lectureNotes"), t("links.addTheLink"), addLinkHref({ module, category: LECTURE_NOTES, title: t("links.notesTitle", { module }) })),
    );
  items.push(emptySlot(t("links.another"), t("links.anotherHint"), addLinkHref({ module })));
  return linkGrid(items);
}

/** Links without a module, grouped by category. */
export function generalGroups(resources: Resource[]): HTMLElement[] {
  const general = resources.filter((r) => !r.module);
  const categories = [...new Set(general.map((r) => r.category))].sort((a, b) => a.localeCompare(b));
  const sections = categories.map((cat) => {
    const section = el("section", "link-group");
    const h = el("h2", "link-group__title", cat);
    section.append(h, linkGrid(general.filter((r) => r.category === cat).sort(byTitle).map(linkCard)));
    return section;
  });
  const add = el("section", "link-group");
  add.append(linkGrid([emptySlot(t("links.add"), t("links.notTied"), addLinkHref())]));
  return [...sections, add];
}
