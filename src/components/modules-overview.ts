import { examClock } from "../lib/countdown";
import { el } from "../lib/dom";
import { formatDays } from "../lib/format";
import type { StoredData } from "../lib/types";
import { dot, whenText } from "./exam-grid";
import { modulesInOrder } from "./nav";

function when(state: ReturnType<typeof examClock>): string {
  if (state.kind === "counting") return state.days === 1 ? "tomorrow" : `in ${formatDays(state.remaining.days)}`;
  return { today: "today", done: "done", tba: "date TBA" }[state.kind];
}

/** One card per module: its exams with dates and days left, and how many links it has. */
export function renderModulesOverview(root: HTMLElement, data: StoredData, now: number): void {
  const ids = data.exams.map((e) => e.id);
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
          el("span", "overview-card__label", exam.label ?? "Exam"),
          el("span", "overview-card__date", exam.date ? whenText(exam.date, exam.time) : "—"),
          el("span", "overview-card__days", when(state)),
        );
        const li = el("li");
        li.append(a);
        list.append(li);
      }

      const links = data.resources.filter((r) => r.module === first.module).length;
      card.append(head, list, el("p", "overview-card__links", links ? `${links} ${links === 1 ? "link" : "links"}` : "No links yet"));
      return card;
    }),
  );
}
