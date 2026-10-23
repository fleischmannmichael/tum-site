import { examClock } from "../lib/countdown";
import { el } from "../lib/dom";
import { t, tn } from "../lib/i18n";
import type { StoredData } from "../lib/types";
import { dot, whenText } from "./exam-grid";
import { modulesInOrder } from "./nav";

function when(state: ReturnType<typeof examClock>): string {
  if (state.kind === "counting") return state.days === 1 ? t("when.tomorrow") : tn("when.in", state.remaining.days);
  return t(`when.${state.kind}`);
}

/** One card per module: its exams with dates and days left, checklist progress and how many links it has. */
export function renderModulesOverview(root: HTMLElement, data: StoredData, now: number): void {
  const ids = data.exams.map((e) => e.id);
  if (!data.exams.length) {
    // A blank page: say how modules come about, and offer to add one.
    const li = el("li", "overview-empty glass-card");
    const add = el("a", "detail__edit", t("empty.addModule"));
    add.href = "settings/index.html#add-module";
    li.append(el("p", "", t("empty.modules")), add);
    root.replaceChildren(li);
    return;
  }
  root.replaceChildren(
    ...modulesInOrder(data.exams).map((exams) => {
      const first = exams[0]!;
      const card = el("li", "overview-card glass-card");
      const head = el("a", "overview-card__head");
      head.href = `#module=${encodeURIComponent(first.id)}`;
      head.append(dot(first, ids), el("span", "overview-card__name", first.module));

      const list = el("ul", "overview-card__exams");
      for (const exam of exams) {
        const state = examClock(exam, now);
        const a = el("a", `overview-card__exam overview-card__exam--${state.kind}`);
        a.href = `#module=${encodeURIComponent(exam.id)}`;
        a.append(
          el("span", "overview-card__label", exam.label ?? t("overview.exam")),
          el("span", "overview-card__date", exam.date ? whenText(exam.date, exam.time) : "—"),
          el("span", "overview-card__days", when(state)),
        );
        const li = el("li");
        li.append(a);
        list.append(li);
      }

      const links = data.resources.filter((r) => r.module === first.module).length;
      const topics = data.checklists[first.module] ?? [];
      const meta = [links ? tn("overview.links", links) : t("overview.noLinks")];
      if (topics.length) meta.unshift(t("overview.topics", { done: topics.filter((i) => i.done).length, total: topics.length }));
      card.append(head, list, el("p", "overview-card__links", meta.join(" · ")));
      return card;
    }),
  );
}
