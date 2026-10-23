import type { UpcomingExam } from "../lib/countdown";
import { formatDateDE, formatDays } from "../lib/format";
import type { Exam } from "../lib/types";

/** Exams this many days away (or fewer) get the warm accent. */
export const SOON_DAYS = 7;
const MODULE_COLORS = 5;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function relativeDays(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return formatDays(days);
}

/** Stable fallback colour per exam, so dots don't change when the list reorders. */
function dotColor(exam: Exam, allIds: string[]): string {
  if (exam.color) return exam.color;
  const i = Math.max(allIds.indexOf(exam.id), 0);
  return `var(--module-${(i % MODULE_COLORS) + 1})`;
}

type RowKind = "upcoming" | "tba" | "done";

function row(exam: Exam, kind: RowKind, allIds: string[], days?: number): HTMLLIElement {
  const li = el("li", `exam-row exam-row--${kind}`);
  if (days !== undefined && days <= SOON_DAYS) li.classList.add("exam-row--soon");

  const dot = el("span", "exam-row__dot");
  dot.style.setProperty("--dot", dotColor(exam, allIds));
  dot.setAttribute("aria-hidden", "true");

  const date = exam.date ? [formatDateDE(exam.date), exam.time].filter(Boolean).join(" · ") : "Date TBA";
  const right = kind === "upcoming" ? relativeDays(days!) : kind === "tba" ? "—" : "Done";

  li.append(dot, el("span", "exam-row__module", exam.module), el("span", "exam-row__date", date), el("span", "exam-row__days", right));
  return li;
}

export function upcomingRows(upcoming: UpcomingExam[], tba: Exam[], allIds: string[]): HTMLLIElement[] {
  return [
    ...upcoming.map((u) => row(u.exam, "upcoming", allIds, u.days)),
    ...tba.map((e) => row(e, "tba", allIds)),
  ];
}

export function doneRows(done: Exam[], allIds: string[]): HTMLLIElement[] {
  return done.map((e) => row(e, "done", allIds));
}
