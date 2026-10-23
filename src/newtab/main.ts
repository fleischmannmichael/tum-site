import { summarize } from "../lib/countdown";
import { loadAll, onDataChanged } from "../lib/storage";
import type { StoredData } from "../lib/types";
import { initPillNav } from "../components/pill-nav";
import { render } from "./render";

let data: StoredData;
let timer: number | undefined;

/** Renders now, then re-renders on the next whole second (or minute). */
function tick(): void {
  window.clearTimeout(timer);
  const now = Date.now();
  render(summarize(data.exams, now), data.exams, data.settings.showSeconds);
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
