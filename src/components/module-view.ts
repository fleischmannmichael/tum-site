import { el } from "../lib/dom";
import type { Resource, StoredData } from "../lib/types";
import { clockEl } from "./clock";
import { detailFields, detailHeader, editHref } from "./exam-detail";

function linkList(resources: Resource[]): HTMLElement {
  if (!resources.length) {
    const p = el("p", "module-view__empty", "No links for this module yet. ");
    const a = el("a", "", "Add one in settings");
    a.href = "../options/index.html";
    p.append(a);
    return p;
  }
  const ul = el("ul", "module-view__links");
  for (const r of [...resources].sort((a, b) => a.title.localeCompare(b.title))) {
    const a = el("a", "", r.title);
    a.href = r.url;
    const li = el("li");
    li.append(a, el("span", "module-view__host", new URL(r.url).host));
    ul.append(li);
  }
  return ul;
}

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
    linkList(data.resources.filter((r) => r.module === exam.module)),
    edit,
  );
  root.replaceChildren(card);
  return true;
}
