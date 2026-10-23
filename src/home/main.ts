import { initExamDetail } from "../components/exam-detail";
import { initFocus } from "../components/focus-view";
import { renderModuleView } from "../components/module-view";
import { renderModulesOverview } from "../components/modules-overview";
import { applyRoute, currentRoute, initModulesMenu, renderModulesMenu } from "../components/nav";
import { generalGroups } from "../components/resource-grid";
import { applyAccent } from "../lib/accent";
import { applyI18n, cachedLang, setLang } from "../lib/i18n";
import { HEROES } from "../lib/heroes.generated";
import { VARIANT_MEDIA, heroFolder, pickHero } from "../lib/heroes";
import { summarize } from "../lib/countdown";
import { describeSaveError, loadAll, onDataChanged, save } from "../lib/storage";
import type { StoredData } from "../lib/types";
import { renderExams, renderHeadline, updateClocks } from "./render";

let data: StoredData;
let timer: number | undefined;
let structureKey = "";
/** One random number per visit: picks the motivational line or quote. */
const headlinePick = Math.random();

const detail = initExamDetail(
  document.getElementById("exam-detail") as HTMLDialogElement,
  () => data,
  () => updateClocks(data.exams, Date.now(), data.settings.showSeconds),
);

/** Checklist edits on a module page: shown at once, saved in the background. */
function saveChecklist(module: string, items: StoredData["checklists"][string]): void {
  const checklists = { ...data.checklists, [module]: items };
  if (!items.length) delete checklists[module];
  data = { ...data, checklists };
  tick();
  save("checklists", checklists).catch((err) => alert(describeSaveError(err)));
}

/** Rebuilds what depends on data or route (not on the clock). */
function renderStructure(now: number): void {
  setLang(data.settings.language);
  applyI18n();
  const summary = summarize(data.exams, now);
  renderHeadline(summary, data.settings, headlinePick);
  renderModulesOverview(document.getElementById("modules-overview")!, data, now);
  renderExams(summary, data.exams);
  renderModulesMenu(data.exams);
  document.getElementById("general-groups")!.replaceChildren(...generalGroups(data.resources));

  let route = currentRoute();
  if (route.view === "module" && !renderModuleView(document.getElementById("view-module")!, route.id, data, now, saveChecklist)) {
    history.replaceState(null, "", "#countdown"); // module was deleted
    route = { view: "countdown" };
  }
  applyRoute(route);
  detail.refresh();
  focus.render();
}

/** Every second (or minute): update the clocks; rebuild only when something structural changed. */
function tick(force = false): void {
  window.clearTimeout(timer);
  const now = Date.now();
  applyAccent(data.settings.accent);

  // Exams move between upcoming/done at midnight, so the summary is part of the key.
  const summary = summarize(data.exams, now);
  const key = JSON.stringify([data.exams, data.resources, data.settings.headline, data.settings.focus, data.settings.language, data.focusLog, data.checklists, location.hash, summary.upcoming.map((u) => u.days), summary.done.map((e) => e.id)]);
  if (force || key !== structureKey) {
    structureKey = key;
    renderStructure(now);
  }
  updateClocks(data.exams, now, data.settings.showSeconds);

  const step = data.settings.showSeconds ? 1000 : 60_000;
  timer = window.setTimeout(tick, step - (now % step) + 5);
}

/** Today's picture (by season), set before anything waits on storage so it paints first. */
/** Uses the phone or 21:9 crop when there is one and the window has that shape. */
function applyHero(): void {
  const hero = pickHero(HEROES, Date.now());
  if (!hero) return;
  const folder = heroFolder(hero, (query) => matchMedia(query).matches);
  const style = document.querySelector<HTMLElement>(".hero")!.style;
  for (const [layer, file] of [["48", "48.png"], ["96", "96.png"], ["full", "full.webp"]])
    // Relative to the page, so it works at the site root, under /tum-site/ on GitHub Pages, and in the extension.
    style.setProperty(`--hero-${layer}`, `url("${new URL(folder + file, document.baseURI).href}")`);
  // The default focus point keeps the tower in frame on the main picture; a crop made for the screen is centred.
  if (folder === hero.path) style.removeProperty("--hero-position");
  else style.setProperty("--hero-position", "50% 50%");
}

// Rotating a phone or resizing the window can switch crops.
for (const query of Object.values(VARIANT_MEDIA)) matchMedia(query).addEventListener("change", applyHero);

// The language used last time, so the page doesn't flash English before settings load.
setLang(cachedLang());
applyI18n();
applyHero();
initModulesMenu();
// The entrance (motion.css) plays once; after it, re-rendered parts appear without animating.
window.setTimeout(() => document.documentElement.classList.add("is-entered"), 1000);
data = await loadAll();
const focus = initFocus(
  () => data,
  (patch) => {
    data = { ...data, ...patch };
    tick();
  },
);
tick(true);
performance.mark("countdown-rendered"); // first full render, for load-time checks

window.addEventListener("hashchange", () => {
  tick();
  const view = currentRoute().view;
  const titles = { module: "module-title", modules: "modules-title", general: "general-title", focus: "focus-title" } as const;
  if (view !== "countdown") document.getElementById(titles[view])?.focus({ preventScroll: true });
});

onDataChanged((fresh) => {
  data = fresh;
  tick();
});

// Background tabs get their timers throttled; catch up when shown again.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) tick();
});
