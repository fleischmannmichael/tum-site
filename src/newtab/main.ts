import { initExamDetail } from "../components/exam-detail";
import { initPillNav } from "../components/pill-nav";
import { applyAccent } from "../lib/accent";
import { summarize } from "../lib/countdown";
import { loadAll, onDataChanged } from "../lib/storage";
import type { StoredData } from "../lib/types";
import { renderExams, renderHeadline } from "./render";

let data: StoredData;
let timer: number | undefined;
let tilesKey = "";

const detail = initExamDetail(document.getElementById("exam-detail") as HTMLDialogElement, () => data.exams);

/** Renders now, then re-renders on the next whole second (or minute). */
function tick(): void {
  window.clearTimeout(timer);
  const now = Date.now();
  applyAccent(data.settings.accent);
  const summary = summarize(data.exams, now);
  renderHeadline(summary, data.settings.showSeconds);

  // Day counts only change at midnight or when data changes.
  const key = JSON.stringify([data.exams, summary.upcoming.map((u) => u.days), summary.done.map((e) => e.id)]);
  if (key !== tilesKey) {
    tilesKey = key;
    renderExams(summary, data.exams);
    detail.refresh();
  }

  const step = data.settings.showSeconds ? 1000 : 60_000;
  timer = window.setTimeout(tick, step - (now % step) + 5);
}

initPillNav();
data = await loadAll();
tick();

onDataChanged((fresh) => {
  data = fresh;
  tick();
});

// Background tabs get their timers throttled; catch up when shown again.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) tick();
});
