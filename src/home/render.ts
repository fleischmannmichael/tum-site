import { updateClock } from "../components/clock";
import { doneTiles, examTiles, SOON_DAYS } from "../components/exam-grid";
import { examClock, type Summary } from "../lib/countdown";
import { chooseHeadline, countText } from "../lib/headlines";
import { t } from "../lib/i18n";
import type { Exam, Settings } from "../lib/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * Headline: the exam count, your own message, a motivational line or a quote
 * (Settings → Display). `pick` is one random number per page load.
 */
export function renderHeadline(summary: Summary, settings: Settings, pick: number): void {
  const headline = chooseHeadline(settings, summary, pick);
  const title = $("headline");
  title.textContent = headline.title;
  title.classList.toggle("countdown__title--long", headline.title.length > 32);
  // When the headline isn't the count, the count moves into the small line above it.
  const ahead = summary.upcoming.length + summary.tba.length;
  $("eyebrow").textContent = headline.mode === "count" ? t("cd.eyebrow") : `${t("cd.eyebrow")} · ${countText(ahead)}`;

  const detail = $("detail");
  if (summary.upcoming.length === 0 && summary.tba.length > 0) {
    const link = Object.assign(document.createElement("a"), { href: "settings/index.html", textContent: t("cd.addDates") });
    detail.replaceChildren(document.createTextNode(t("cd.noDates")), link);
  } else detail.replaceChildren(...(headline.byline ? [document.createTextNode(headline.byline)] : []));
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
  $("done-summary").textContent = t("cd.done", { n: summary.done.length });
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
    clock.closest(".exam-tile, .detail")?.classList.toggle("is-soon", state.kind === "counting" && state.days <= SOON_DAYS);
  }
}
