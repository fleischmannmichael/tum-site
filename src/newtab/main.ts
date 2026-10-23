import { initExamDetail } from "../components/exam-detail";
import { renderModuleView } from "../components/module-view";
import { applyRoute, currentRoute, initModulesMenu, renderModulesMenu } from "../components/nav";
import { generalGroups } from "../components/resource-grid";
import { applyAccent } from "../lib/accent";
import { summarize } from "../lib/countdown";
import { loadAll, onDataChanged } from "../lib/storage";
import type { StoredData } from "../lib/types";
import { renderExams, renderHeadline, updateClocks } from "./render";

let data: StoredData;
let timer: number | undefined;
let structureKey = "";

const detail = initExamDetail(document.getElementById("exam-detail") as HTMLDialogElement, () => data.exams);

/** Rebuilds what depends on data or route (not on the clock). */
function renderStructure(now: number): void {
  const summary = summarize(data.exams, now);
  renderHeadline(summary);
  renderExams(summary, data.exams);
  renderModulesMenu(data.exams);
  document.getElementById("general-groups")!.replaceChildren(...generalGroups(data.resources));

  let route = currentRoute();
  if (route.view === "module" && !renderModuleView(document.getElementById("view-module")!, route.id, data, now)) {
    history.replaceState(null, "", "#countdown"); // module was deleted
    route = { view: "countdown" };
  }
  applyRoute(route);
  detail.refresh();
}

/** Every second (or minute): update the clocks; rebuild only when something structural changed. */
function tick(force = false): void {
  window.clearTimeout(timer);
  const now = Date.now();
  applyAccent(data.settings.accent);

  // Exams move between upcoming/done at midnight, so the summary is part of the key.
  const summary = summarize(data.exams, now);
  const key = JSON.stringify([data.exams, data.resources, location.hash, summary.upcoming.map((u) => u.days), summary.done.map((e) => e.id)]);
  if (force || key !== structureKey) {
    structureKey = key;
    renderStructure(now);
  }
  updateClocks(data.exams, now, data.settings.showSeconds);

  const step = data.settings.showSeconds ? 1000 : 60_000;
  timer = window.setTimeout(tick, step - (now % step) + 5);
}

initModulesMenu();
data = await loadAll();
tick(true);

window.addEventListener("hashchange", () => {
  tick();
  const view = currentRoute().view;
  if (view !== "countdown") document.getElementById(view === "module" ? "module-title" : "general-title")?.focus({ preventScroll: true });
});

onDataChanged((fresh) => {
  data = fresh;
  tick();
});

// Background tabs get their timers throttled; catch up when shown again.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) tick();
});
