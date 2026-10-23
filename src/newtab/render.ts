import { doneRows, SOON_DAYS, upcomingRows } from "../components/exam-list";
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

export function render(summary: Summary, exams: Exam[], showSeconds: boolean): void {
  const { state } = summary;
  const eyebrow = $("eyebrow");
  const headline = $("headline");
  const days = $("days");
  const detail = $("detail");
  const section = headline.closest(".countdown")!;

  section.classList.toggle("countdown--soon", state.kind !== "none" && state.next.days <= SOON_DAYS);

  if (state.kind === "none") {
    eyebrow.textContent = "Next exam";
    headline.textContent = "No exam dates yet";
    days.textContent = "";
    detail.textContent = "Add them in settings";
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

  const ids = exams.map((e) => e.id);
  $("upcoming").replaceChildren(...upcomingRows(summary.upcoming, summary.tba, ids));
  $("done-section").hidden = summary.done.length === 0;
  $("done-count").textContent = String(summary.done.length);
  $("done").replaceChildren(...doneRows(summary.done, ids));
}
