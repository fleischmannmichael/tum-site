import { daysUntil, examDayEnd } from "../lib/countdown";
import { formatDateDE } from "../lib/format";
import type { Exam } from "../lib/types";
import { dot, el, relativeDays, whenText } from "./exam-grid";

const NOT_SET = "Not set yet";

function field(label: string, value: string | Node | undefined): HTMLDivElement {
  const row = el("div", "detail__field");
  const dd = el("dd", value ? "" : "detail__empty");
  if (value instanceof Node) dd.append(value);
  else dd.textContent = value || NOT_SET;
  row.append(el("dt", "detail__label", label), dd);
  return row;
}

export function statusText(exam: Exam, now: number): string {
  if (exam.done || (exam.date && now >= examDayEnd(exam.date))) return "Done";
  if (!exam.date) return "Date TBA";
  const days = daysUntil(exam.date, now);
  return days <= 1 ? relativeDays(days) : `In ${relativeDays(days).toLowerCase()}`;
}

function retakeText(exam: Exam): string | undefined {
  if (!exam.retake) return undefined;
  const { date, time, room } = exam.retake;
  return [whenText(date, time), room].filter(Boolean).join(" · ");
}

function aidsList(aids: string[] | undefined): HTMLUListElement | undefined {
  if (!aids?.length) return undefined;
  const ul = el("ul", "detail__list");
  ul.append(...aids.map((a) => el("li", "", a)));
  return ul;
}

export const editHref = (exam: Exam) => `../options/index.html#exam=${encodeURIComponent(exam.id)}`;

/** Eyebrow (dot + status) and title; shared by the dialog and the module page. */
export function detailHeader(exam: Exam, exams: Exam[], now: number, level: "h1" | "h2", titleId: string): HTMLElement {
  const header = el("header", "detail__header");
  const eyebrow = el("p", "detail__eyebrow");
  eyebrow.append(dot(exam, exams.map((e) => e.id)), document.createTextNode(statusText(exam, now)));
  const title = el(level, "detail__title", exam.module);
  title.id = titleId;
  title.tabIndex = -1; // focus target when navigating to a module page
  header.append(eyebrow, title);
  return header;
}

/** Every detail field, "Not set yet" where empty, so it's clear what can be added. */
export function detailFields(exam: Exam): HTMLDListElement {
  const dl = el("dl", "detail__fields");
  dl.append(
    field("Date", exam.date ? whenText(exam.date, exam.time) : undefined),
    field("Room", exam.room),
    field("Duration", exam.durationMin ? `${exam.durationMin} min` : undefined),
    field("Registration deadline", exam.registrationDeadline && formatDateDE(exam.registrationDeadline)),
    field("Retake", retakeText(exam)),
    field("What you can bring", aidsList(exam.allowedAids)),
    field("About", exam.description),
    field("Notes", exam.notes),
  );
  return dl;
}

/** Fills the dialog for one exam. Safe to call again when data changes. */
export function renderExamDetail(dialog: HTMLDialogElement, exam: Exam, exams: Exam[], now: number): void {
  dialog.querySelector(".detail__body")!.replaceChildren(detailHeader(exam, exams, now, "h2", "detail-title"), detailFields(exam));
  dialog.querySelector<HTMLAnchorElement>("#detail-edit")!.href = editHref(exam);
}

/** Opens the detail dialog when a tile is clicked; closes on backdrop click. */
export function initExamDetail(dialog: HTMLDialogElement, getExams: () => Exam[]): { refresh(): void } {
  let openId: string | null = null;

  const refresh = () => {
    if (!openId || !dialog.open) return;
    const exams = getExams();
    const exam = exams.find((e) => e.id === openId);
    if (exam) renderExamDetail(dialog, exam, exams, Date.now());
    else dialog.close(); // deleted elsewhere
  };

  document.addEventListener("click", (event) => {
    const tile = (event.target as Element).closest<HTMLElement>("[data-exam-id]");
    if (!tile) return;
    openId = tile.dataset.examId!;
    dialog.showModal();
    refresh();
  });

  // A click on the dialog element itself (not its content) is a backdrop click.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => (openId = null));

  return { refresh };
}
