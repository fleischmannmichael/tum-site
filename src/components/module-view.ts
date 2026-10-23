import { examClock } from "../lib/countdown";
import { el } from "../lib/dom";
import { t, tn } from "../lib/i18n";
import type { ChecklistItem, Exam, StoredData } from "../lib/types";
import { dot, whenText } from "./exam-grid";
import { moduleLinks } from "./resource-grid";

/*
 * The page for one module: a checklist of what it covers (tick topics off as
 * you learn them), its exams as chips that open the exam pop-out, and its
 * links. Exam details live in the pop-out, not here.
 */

export const LIMIT_TEXT = 200;
export const LIMIT_ITEMS = 300;

function when(exam: Exam, now: number): string {
  const state = examClock(exam, now);
  if (state.kind === "counting") return state.days === 1 ? t("when.tomorrow") : tn("when.in", state.remaining.days);
  return t(`when.${state.kind}`);
}

/**
 * Lines → new items: blank lines dropped, pasted bullets and numbering removed,
 * Markdown "- [x] topic" arrives ticked; long lines cut, the list capped.
 */
export function newItems(text: string, existing: number): ChecklistItem[] {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const m = /^\s*(?:[-*•+]\s+|\d+[.)]\s+)?(?:\[([ xX])\]\s+)?(.*)$/.exec(line)!;
      return { text: m[2]!.trim(), done: (m[1] ?? "").toLowerCase() === "x" };
    })
    .filter((i) => i.text)
    .slice(0, Math.max(0, LIMIT_ITEMS - existing))
    .map((i) => ({ id: crypto.randomUUID(), text: i.text.slice(0, LIMIT_TEXT), done: i.done }));
}

/** Where focus should land after the next re-render (set by delete, which removes the focused button). */
let pendingFocus: string | undefined;

export type ChecklistChange = (module: string, items: ChecklistItem[]) => void;

/** Renders the module page; returns false if the exam (and so the module) is gone. */
export function renderModuleView(root: HTMLElement, examId: string, data: StoredData, now: number, onChange: ChecklistChange): boolean {
  const exam = data.exams.find((e) => e.id === examId);
  if (!exam) return false;
  const module = exam.module;
  const ids = data.exams.map((e) => e.id);
  const items = data.checklists[module] ?? [];
  // Re-rendering replaces the DOM: remember what had focus and put it back.
  const focusKey = pendingFocus ?? (document.activeElement as HTMLElement | null)?.dataset?.focusKey;
  pendingFocus = undefined;

  const card = el("article", "module-view glass-card");
  card.setAttribute("aria-labelledby", "module-title");

  // The way back to all modules (Esc works too, see home/main.ts).
  const back = el("a", "module-view__back", t("module.back"));
  back.href = "#modules";

  const header = el("header", "detail__header");
  const eyebrow = el("p", "detail__eyebrow");
  eyebrow.append(dot(exam, ids), document.createTextNode(t("module.eyebrow")));
  const title = el("h1", "detail__title", module);
  title.id = "module-title";
  title.tabIndex = -1; // focus target when navigating here
  header.append(eyebrow, title);

  // Exams of this module: chips that open the pop-out with all the details.
  const exams = data.exams.filter((e) => e.module === module).sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const chips = el("ul", "module-exams");
  chips.setAttribute("aria-label", t("module.exams"));
  for (const e of exams) {
    const btn = el("button", "module-exams__chip");
    btn.type = "button";
    btn.dataset.examId = e.id;
    btn.setAttribute("aria-haspopup", "dialog");
    btn.append(
      el("span", "module-exams__label", e.label ?? t("overview.exam")),
      el("span", "module-exams__when", `${e.date ? whenText(e.date, e.time) : t("date.tba")} · ${when(e, now)}`),
    );
    const li = el("li");
    li.append(btn);
    chips.append(li);
  }

  // ---- Checklist
  const save = (next: ChecklistItem[]) => onChange(module, next);
  const section = el("section", "checklist");
  section.setAttribute("aria-labelledby", "checklist-title");
  const head = el("div", "checklist__head");
  const h2 = el("h2", "module-view__subtitle", t("module.contents"));
  h2.id = "checklist-title";
  head.append(h2);
  const doneCount = items.filter((i) => i.done).length;
  if (items.length) {
    const progress = el("p", "checklist__progress", t("module.progress", { done: doneCount, total: items.length }));
    progress.style.setProperty("--share", String(doneCount / items.length));
    head.append(progress);
  }
  section.append(head);

  if (items.length) {
    const list = el("ul", "checklist__list");
    for (const item of items) {
      const li = el("li", item.done ? "checklist__item is-done" : "checklist__item");
      const label = el("label", "checklist__label");
      const box = el("input");
      box.type = "checkbox";
      box.checked = item.done;
      box.dataset.focusKey = `check-${item.id}`;
      box.addEventListener("change", () => save(items.map((i) => (i.id === item.id ? { ...i, done: box.checked } : i))));
      label.append(box, el("span", "checklist__text", item.text));
      const del = el("button", "checklist__delete", "✕");
      del.type = "button";
      del.dataset.focusKey = `delete-${item.id}`;
      del.setAttribute("aria-label", t("module.delete", { text: item.text }));
      del.addEventListener("click", () => {
        // Keep keyboard focus in the list: move it to the next item's delete button (or the input).
        const i = items.indexOf(item);
        const next = items[i + 1] ?? items[i - 1];
        pendingFocus = next ? `delete-${next.id}` : "add";
        save(items.filter((x) => x.id !== item.id));
      });
      li.append(label, del);
      list.append(li);
    }
    section.append(list);
  } else section.append(el("p", "checklist__empty", t("module.empty")));

  const form = el("form", "checklist__add");
  const input = el("textarea", "checklist__input");
  input.rows = 1;
  input.maxLength = LIMIT_TEXT * 50; // room for a pasted list
  input.placeholder = t("module.addPlaceholder");
  input.setAttribute("aria-label", t("module.addLabel"));
  input.dataset.focusKey = "add";
  const add = el("button", "checklist__btn", t("module.add"));
  add.type = "submit";
  form.append(input, add);
  const submit = () => {
    const fresh = newItems(input.value, items.length);
    if (fresh.length) save([...items, ...fresh]);
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submit();
  });
  // Enter adds; Shift+Enter makes a new line for adding several at once.
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submit();
    }
  });
  section.append(form);

  if (doneCount) {
    const clear = el("button", "checklist__clear", t("module.clearDone"));
    clear.type = "button";
    clear.addEventListener("click", () => save(items.filter((i) => !i.done)));
    section.append(clear);
  }

  card.append(back, header, chips, section, el("h2", "module-view__subtitle", t("detail.links")), moduleLinks(module, data.resources));
  root.replaceChildren(card);
  if (focusKey) root.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focusKey)}"]`)?.focus();
  return true;
}
