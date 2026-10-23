import { initExamDetail } from "../components/exam-detail";
import { initFocus } from "../components/focus-view";
import { renderModuleView } from "../components/module-view";
import { renderModulesOverview } from "../components/modules-overview";
import { applyRoute, currentRoute, initModulesMenu, renderModulesMenu } from "../components/nav";
import { generalGroups } from "../components/resource-grid";
import { applyAccent } from "../lib/accent";
import { applyI18n, cachedLang, getLang, setLang } from "../lib/i18n";
import { personalLines } from "../lib/personal";
import { cachedHeroChoice } from "../lib/heroes";
import { summarize } from "../lib/countdown";
import { describeSaveError, loadAll, onDataChanged, save } from "../lib/storage";
import type { StoredData } from "../lib/types";
import { applyHero } from "./hero";
import { renderExams, renderHeadline, updateClocks } from "./render";

let data: StoredData;
let timer: number | undefined;
let structureKey = "";
/** One random number per visit: picks the motivational line or quote. */
const headlinePick = Math.random();
/** Which personal line is showing; moves on every few seconds (see below). */
let personalIndex = 0;
const PERSONAL_EVERY = 12_000;

function personal(now: number): { lines: string[]; index: number } | undefined {
  if (data.settings.headline?.mode !== "personal") return undefined;
  const summary = summarize(data.exams, now);
  const lines = personalLines({ name: data.settings.name, lang: getLang(), now, summary, focusLog: data.focusLog, checklists: data.checklists });
  return { lines, index: personalIndex };
}

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
  applyHero(data.settings.hero);
  setLang(data.settings.language);
  applyI18n();
  const summary = summarize(data.exams, now);
  renderHeadline(summary, data.settings, headlinePick, personal(now));
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
  const key = JSON.stringify([data.exams, data.resources, data.settings.headline, data.settings.name, data.settings.focus, data.settings.language, data.settings.hero, data.focusLog, data.checklists, location.hash, summary.upcoming.map((u) => u.days), summary.done.map((e) => e.id), Math.floor(now / 3_600_000)]); // hourly: greetings change
  if (force || key !== structureKey) {
    structureKey = key;
    renderStructure(now);
  }
  updateClocks(data.exams, now, data.settings.showSeconds);

  const step = data.settings.showSeconds ? 1000 : 60_000;
  timer = window.setTimeout(tick, step - (now % step) + 5);
}

/** Today's picture (by season), set before anything waits on storage so it paints first. */

// The language used last time, so the page doesn't flash English before settings load.
setLang(cachedLang());
applyI18n();
applyHero(cachedHeroChoice());
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

// Personal messages take turns while the countdown is on screen (not when the
// tab is hidden, and not for reduced motion, where text shouldn't keep moving).
window.setInterval(() => {
  if (document.hidden || (location.hash.length > 1 && location.hash !== "#countdown") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const now = Date.now();
  const p = personal(now);
  if (!p || p.lines.length < 2) return;
  personalIndex = (personalIndex + 1) % p.lines.length;
  renderHeadline(summarize(data.exams, now), data.settings, headlinePick, { ...p, index: personalIndex });
}, PERSONAL_EVERY);

// Background tabs get their timers throttled; catch up when shown again.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) tick();
});
