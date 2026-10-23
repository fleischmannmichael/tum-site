import { el } from "../lib/dom";
import type { StoredData } from "../lib/types";
import { clockEl } from "./clock";
import { detailFields, detailHeader, editHref } from "./exam-detail";
import { moduleLinks } from "./resource-grid";

/** The page for one module: live clock, every detail, and its links. Returns false if the exam is gone. */
export function renderModuleView(root: HTMLElement, examId: string, data: StoredData, now: number): boolean {
  const exam = data.exams.find((e) => e.id === examId);
  if (!exam) return false;

  const card = el("article", "module-view glass-card");
  card.setAttribute("aria-labelledby", "module-title");
  const edit = el("a", "detail__edit", "Edit in settings");
  edit.href = editHref(exam);
  const linksTitle = el("h2", "module-view__subtitle", "Links");
  card.append(
    detailHeader(exam, data.exams, now, "h1", "module-title"),
    clockEl(exam.id, "lg"),
    detailFields(exam),
    linksTitle,
    moduleLinks(exam.module, data.resources),
    edit,
  );
  root.replaceChildren(card);
  return true;
}
