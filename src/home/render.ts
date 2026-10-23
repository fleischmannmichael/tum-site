import { updateClock } from "../components/clock";
import { doneTiles, examTiles, SOON_DAYS } from "../components/exam-grid";
import { examClock, type Summary } from "../lib/countdown";
import { chooseHeadline, countText } from "../lib/headlines";
import { t } from "../lib/i18n";
import { greeting } from "../lib/personal";
import type { Exam, Settings } from "../lib/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * Headline: the exam count, your own message, a motivational line, a quote or
 * personal messages (Settings → Countdown). `pick` is one random number per
 * page load; `personal` the lines for you and which one is showing.
 */
export function renderHeadline(summary: Summary, settings: Settings, pick: number, personal?: { lines: string[]; index: number }): void {
  const headline = chooseHeadline(settings, summary, pick, personal);
  const title = $("headline");
  if (title.textContent !== headline.title) {
    title.textContent = headline.title;
    // A new personal line fades in (motion.css); the first render has the page entrance instead.
    title.classList.remove("is-new");
    if (headline.mode === "personal" && document.documentElement.classList.contains("is-entered")) {
      void title.offsetWidth; // restart the animation
      title.classList.add("is-new");
    }
  }
  title.classList.toggle("countdown__title--long", headline.title.length > 32);
  // The small line above: a greeting when you've set your name, and the count when the headline isn't it.
  const ahead = summary.upcoming.length + summary.tba.length;
  const first = settings.name?.trim() ? greeting({ name: settings.name, lang: settings.language ?? "en", now: Date.now() }) : t("cd.eyebrow");
  $("eyebrow").textContent = headline.mode === "count" ? first : `${first} · ${countText(ahead, summary.done.length)}`;

  const detail = $("detail");
  if (summary.upcoming.length === 0 && summary.tba.length > 0) {
    const link = Object.assign(document.createElement("a"), { href: "settings/index.html", textContent: t("cd.addDates") });
    detail.replaceChildren(document.createTextNode(t("cd.noDates")), link);
  } else detail.replaceChildren(...(headline.byline ? [document.createTextNode(headline.byline)] : []));
}

/** A large "+" card that links to a form in Settings; for pages with nothing on them yet. */
export function emptyCard(href: string, title: string, text: string): HTMLLIElement {
  const a = Object.assign(document.createElement("a"), { href, className: "empty-card glass-card" });
  const plus = Object.assign(document.createElement("span"), { className: "empty-card__plus", textContent: "+" });
  plus.setAttribute("aria-hidden", "true");
  const label = Object.assign(document.createElement("span"), { className: "empty-card__text" });
  label.append(
    Object.assign(document.createElement("span"), { className: "empty-card__title", textContent: title }),
    Object.assign(document.createElement("span"), { className: "empty-card__hint", textContent: text }),
  );
  a.append(plus, label);
  const li = document.createElement("li");
  li.className = "empty-card__item";
  li.append(a);
  return li;
}

/** Tiles; only re-rendered when their content changes, so focus isn't lost every tick. */
export function renderExams(summary: Summary, exams: Exam[]): void {
  const ids = exams.map((e) => e.id);
  const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.examId;

  const grid = $("exam-grid");
  const tiles = examTiles(summary, ids);
  grid.replaceChildren(...tiles);
  // A blank page: one inviting card instead of the boxes.
  if (!tiles.length && !summary.done.length) grid.replaceChildren(emptyCard("settings/index.html#add-exam", t("empty.add"), t("empty.text")));
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
