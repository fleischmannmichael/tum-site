import { examClock } from "../lib/countdown";
import { formatDateDE } from "../lib/format";
import { t, tn, type Key } from "../lib/i18n";
import type { Exam, Resource } from "../lib/types";
import { clockEl } from "./clock";
import { dot, el, whenText } from "./exam-grid";
import { moduleLinks } from "./resource-grid";

/*
 * The pop-out for one exam, laid out like a page: status and module name, the
 * big clock, every detail (with "Not set yet" where empty), the module's links,
 * then ways on: edit the exam, or open the module's checklist page.
 */

function field(label: Key, value: string | Node | undefined): HTMLDivElement {
  const row = el("div", "detail__field");
  const dd = el("dd", value ? "" : "detail__empty");
  if (value instanceof Node) dd.append(value);
  else dd.textContent = value || t("field.notSet");
  row.append(el("dt", "detail__label", t(label)), dd);
  return row;
}

export function statusText(exam: Exam, now: number): string {
  const clock = examClock(exam, now);
  if (clock.kind === "done") return t("status.done");
  if (clock.kind === "tba") return t("status.tba");
  if (clock.kind === "today" || clock.days === 0) return t("status.today");
  if (clock.days === 1) return t("status.tomorrow");
  // Same count as the clock on the square, so the two never disagree.
  return tn("status.in", clock.remaining.days);
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

export const editHref = (exam: Exam) => `settings/index.html#exam=${encodeURIComponent(exam.id)}`;
export const moduleHref = (exam: Exam) => `#module=${encodeURIComponent(exam.id)}`;

/** Eyebrow (dot + label + status) and the module name. */
export function detailHeader(exam: Exam, exams: Exam[], now: number, titleId: string): HTMLElement {
  const header = el("header", "detail__header");
  const eyebrow = el("p", "detail__eyebrow");
  const status = [exam.label, statusText(exam, now)].filter(Boolean).join(" · ");
  eyebrow.append(dot(exam, exams.map((e) => e.id)), document.createTextNode(status));
  const title = el("h2", "detail__title", exam.module);
  title.id = titleId;
  header.append(eyebrow, title);
  return header;
}

/** Every detail field; empty ones say "Not set yet". */
export function detailFields(exam: Exam): HTMLDListElement {
  const rows: [Key, string | Node | undefined][] = [
    ["field.date", exam.date ? whenText(exam.date, exam.time) : undefined],
    ["field.room", exam.room],
    ["field.duration", exam.durationMin ? t("field.minutes", { n: exam.durationMin }) : undefined],
    ["field.deadline", exam.registrationDeadline && formatDateDE(exam.registrationDeadline)],
    ["field.retake", retakeText(exam)],
    ["field.aids", aidsList(exam.allowedAids)],
    ["field.about", exam.description],
    ["field.notes", exam.notes],
  ];
  const dl = el("dl", "detail__fields");
  dl.append(...rows.map(([label, value]) => field(label, value)));
  return dl;
}

/** Fills the dialog for one exam. Safe to call again when data changes. */
export function renderExamDetail(dialog: HTMLDialogElement, exam: Exam, exams: Exam[], resources: Resource[], now: number): void {
  const actions = el("div", "detail__actions");
  const edit = el("a", "detail__edit", t("detail.edit"));
  edit.href = editHref(exam);
  const page = el("a", "detail__edit detail__edit--quiet", t("detail.module"));
  page.href = moduleHref(exam);
  actions.append(edit, page);

  dialog.querySelector(".detail__body")!.replaceChildren(
    detailHeader(exam, exams, now, "detail-title"),
    clockEl(exam.id, "lg"),
    detailFields(exam),
    el("h3", "detail__subtitle", t("detail.links")),
    moduleLinks(exam.module, resources),
    actions,
  );
  dialog.querySelector(".detail__close")!.setAttribute("aria-label", t("detail.close"));
}

/** Opens the detail dialog when a tile is clicked; closes on backdrop click. */
export function initExamDetail(
  dialog: HTMLDialogElement,
  getData: () => { exams: Exam[]; resources: Resource[] },
  onRender: () => void,
): { refresh(): void } {
  let openId: string | null = null;

  const refresh = () => {
    if (!openId || !dialog.open) return;
    const { exams, resources } = getData();
    const exam = exams.find((e) => e.id === openId);
    if (!exam) return dialog.close(); // deleted elsewhere
    renderExamDetail(dialog, exam, exams, resources, Date.now());
    onRender(); // fill the new clock right away
  };

  document.addEventListener("click", (event) => {
    const tile = (event.target as Element).closest<HTMLElement>("[data-exam-id]");
    if (!tile) return;
    openId = tile.dataset.examId!;
    dialog.showModal();
    refresh();
  });

  // A click on the dialog element itself (not its content) is a backdrop click;
  // following a link inside (module page, a study link) closes it too.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || (event.target as Element).closest("a[href^='#']")) dialog.close();
  });
  dialog.addEventListener("close", () => (openId = null));

  return { refresh };
}
