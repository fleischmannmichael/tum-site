import { doneTiles, examTiles, SOON_DAYS } from "../components/exam-grid";
import type { Summary } from "../lib/countdown";
import { formatDateDE, formatDuration } from "../lib/format";
import type { Exam } from "../lib/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function setDays(days: number): void {
  const num = document.createElement("span");
  num.className = "countdown__number";
  num.textContent = String(days);
  $("days").replaceChildren(num, document.createTextNode(days === 1 ? " day" : " days"));
}

/** Headline; cheap enough to run every tick. */
export function renderHeadline(summary: Summary, showSeconds: boolean): void {
  const { state } = summary;
  const eyebrow = $("eyebrow");
  const headline = $("headline");
  const days = $("days");
  const detail = $("detail");

  headline.closest(".countdown")!.classList.toggle("countdown--soon", state.kind !== "none" && state.next.days <= SOON_DAYS);

  if (state.kind === "none") {
    eyebrow.textContent = "Next exam";
    headline.textContent = "No exam dates yet";
    days.textContent = "";
    const link = Object.assign(document.createElement("a"), { href: "../options/index.html", textContent: "Add them in settings" });
    detail.replaceChildren(link);
  } else if (state.kind === "today") {
    const { exam } = state.next;
    eyebrow.textContent = "Exam day";
    headline.textContent = exam.module;
    days.textContent = ["Today", exam.time, exam.room].filter(Boolean).join(" · ");
    detail.textContent = "";
  } else {
    const { exam } = state.next;
    eyebrow.textContent = `Next exam · ${formatDateDE(exam.date)}${exam.time ? ` · ${exam.time}` : ""}`;
    headline.textContent = exam.module;
    setDays(state.next.days);
    detail.textContent = `Starts in ${formatDuration(state.remaining, showSeconds)}`;
  }
}

/** Tiles; only re-rendered when their content changes, so focus isn't lost every tick. */
export function renderExams(summary: Summary, exams: Exam[]): void {
  const ids = exams.map((e) => e.id);
  const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.examId;

  $("exam-grid").replaceChildren(...examTiles(summary, ids));
  $("done-section").hidden = summary.done.length === 0;
  $("done-count").textContent = String(summary.done.length);
  $("done-grid").replaceChildren(...doneTiles(summary, ids));

  if (focusedId) document.querySelector<HTMLElement>(`[data-exam-id="${CSS.escape(focusedId)}"]`)?.focus();
}
