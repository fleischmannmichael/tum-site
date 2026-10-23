import type { Summary, UpcomingExam } from "../lib/countdown";
import { el } from "../lib/dom";
import { formatDateDE, formatDays } from "../lib/format";
import type { Exam } from "../lib/types";
import { clockEl } from "./clock";

export { el };

/** Exams this many days away (or fewer) get the warm accent. */
export const SOON_DAYS = 7;
const MODULE_COLORS = 5;

export function relativeDays(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return formatDays(days);
}

export function whenText(date: string | null, time?: string): string {
  return date ? [formatDateDE(date), time].filter(Boolean).join(" · ") : "Date TBA";
}

/** Stable fallback colour per exam, so dots don't change when the list reorders. */
export function dotColor(exam: Exam, allIds: string[]): string {
  if (exam.color) return exam.color;
  const i = Math.max(allIds.indexOf(exam.id), 0);
  return `var(--module-${(i % MODULE_COLORS) + 1})`;
}

export function dot(exam: Exam, allIds: string[]): HTMLSpanElement {
  const d = el("span", "dot");
  d.style.setProperty("--dot", dotColor(exam, allIds));
  d.setAttribute("aria-hidden", "true");
  return d;
}

type TileKind = "upcoming" | "tba" | "done";

function tile(exam: Exam, kind: TileKind, allIds: string[], opts: { days?: number; next?: boolean } = {}): HTMLLIElement {
  const li = el("li");
  const btn = el("button", `exam-tile glass-card exam-tile--${kind}`);
  btn.type = "button";
  btn.dataset.examId = exam.id;
  if (opts.days !== undefined && opts.days <= SOON_DAYS) btn.classList.add("exam-tile--soon");
  if (opts.next) btn.classList.add("exam-tile--next");

  const top = el("span", "exam-tile__top");
  top.append(dot(exam, allIds));
  if (opts.next) top.append(el("span", "exam-tile__badge", "Next"));
  if (kind === "done") top.append(el("span", "exam-tile__badge", "Done"));

  const text = el("span", "exam-tile__text");
  text.append(el("span", "exam-tile__module", exam.module), el("span", "exam-tile__when", whenText(exam.date, exam.time)));
  btn.append(top, text);
  if (kind !== "done") btn.append(clockEl(exam.id));
  btn.setAttribute("aria-haspopup", "dialog");
  li.append(btn);
  return li;
}

export function examTiles(summary: Summary, allIds: string[]): HTMLLIElement[] {
  const nextId = summary.state.kind === "none" ? undefined : summary.state.next.exam.id;
  return [
    ...summary.upcoming.map((u: UpcomingExam) => tile(u.exam, "upcoming", allIds, { days: u.days, next: u.exam.id === nextId })),
    ...summary.tba.map((e) => tile(e, "tba", allIds)),
  ];
}

export function doneTiles(summary: Summary, allIds: string[]): HTMLLIElement[] {
  return summary.done.map((e) => tile(e, "done", allIds));
}
