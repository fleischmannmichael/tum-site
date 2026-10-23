import type { Summary, UpcomingExam } from "../lib/countdown";
import { formatDateDE, formatDays, formatDuration } from "../lib/format";
import type { Exam } from "../lib/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${formatDays(days)}`;
}

function examRow(text: string): HTMLLIElement {
  const li = document.createElement("li");
  li.textContent = text;
  return li;
}

function upcomingRow({ exam, days }: UpcomingExam): HTMLLIElement {
  const when = [formatDateDE(exam.date), exam.time].filter(Boolean).join(" · ");
  return examRow(`${exam.module} — ${when} — ${relativeDays(days)}`);
}

function doneRow(exam: Exam): HTMLLIElement {
  return examRow(exam.date ? `${exam.module} — ${formatDateDE(exam.date)}` : exam.module);
}

export function render(summary: Summary, showSeconds: boolean): void {
  const { state } = summary;
  const headline = $("headline");
  const days = $("days");
  const detail = $("detail");

  if (state.kind === "none") {
    headline.textContent = "No exam dates yet — add them in settings";
    days.textContent = "";
    detail.textContent = "";
  } else if (state.kind === "today") {
    const { exam } = state.next;
    headline.textContent = exam.module;
    days.textContent = ["Today", exam.time, exam.room].filter(Boolean).join(" · ");
    detail.textContent = "";
  } else {
    headline.textContent = state.next.exam.module;
    days.textContent = formatDays(state.next.days);
    detail.textContent = formatDuration(state.remaining, showSeconds);
  }

  $("upcoming").replaceChildren(
    ...summary.upcoming.map(upcomingRow),
    ...summary.tba.map((e) => examRow(`${e.module} — date TBA`)),
  );

  $("done-section").hidden = summary.done.length === 0;
  $("done-count").textContent = String(summary.done.length);
  $("done").replaceChildren(...summary.done.map(doneRow));
}
