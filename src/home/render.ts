import { updateClock } from "../components/clock";
import { doneTiles, examTiles, SOON_DAYS } from "../components/exam-grid";
import { examClock, type Summary } from "../lib/countdown";
import type { Exam } from "../lib/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Headline: how many exams are left; a nudge to settings while no dates exist. */
export function renderHeadline(summary: Summary): void {
  const ahead = summary.upcoming.length + summary.tba.length;
  $("headline").textContent =
    ahead === 0 ? "All exams done" : `${ahead} ${ahead === 1 ? "exam" : "exams"} ahead`;
  const detail = $("detail");
  if (summary.upcoming.length === 0 && summary.tba.length > 0) {
    const link = Object.assign(document.createElement("a"), { href: "settings/index.html", textContent: "Add the dates in settings" });
    detail.replaceChildren(document.createTextNode("No dates yet · "), link);
  } else detail.replaceChildren();
}

/** Tiles; only re-rendered when their content changes, so focus isn't lost every tick. */
export function renderExams(summary: Summary, exams: Exam[]): void {
  const ids = exams.map((e) => e.id);
  const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.examId;

  const grid = $("exam-grid");
  const tiles = examTiles(summary, ids);
  grid.replaceChildren(...tiles);
  // Two columns filled top to bottom: three rows for six exams, and so on.
  grid.style.setProperty("--rows", String(Math.max(1, Math.ceil(tiles.length / 2))));
  $("done-section").hidden = summary.done.length === 0;
  $("done-count").textContent = String(summary.done.length);
  $("done-grid").replaceChildren(...doneTiles(summary, ids));

  if (focusedId) document.querySelector<HTMLElement>(`[data-exam-id="${CSS.escape(focusedId)}"]`)?.focus();
}

/** Every clock on the page (tiles and module page), updated in place. */
export function updateClocks(exams: Exam[], now: number, showSeconds: boolean): void {
  const byId = new Map(exams.map((e) => [e.id, e]));
  for (const clock of Array.from(document.querySelectorAll<HTMLElement>("[data-clock-for]"))) {
    const exam = byId.get(clock.dataset.clockFor!);
    if (!exam) continue;
    const state = examClock(exam, now);
    updateClock(clock, state, exam, showSeconds);
    clock.closest(".exam-tile, .module-view")?.classList.toggle("is-soon", state.kind === "counting" && state.days <= SOON_DAYS);
  }
}
