import { dot, whenText } from "../components/exam-grid";
import { applyAccent } from "../lib/accent";
import { examClock, summarize } from "../lib/countdown";
import { el } from "../lib/dom";
import { loadAll } from "../lib/storage";

const NEXT = 3;

function render(): Promise<void> {
  return loadAll().then((data) => {
    applyAccent(data.settings.accent);
    const now = Date.now();
    const ids = data.exams.map((e) => e.id);
    const next = summarize(data.exams, now).upcoming.slice(0, NEXT);
    const list = document.getElementById("next-exams")!;
    if (!next.length) {
      list.replaceChildren(el("li", "popup__empty", "No exam dates yet — add them in settings."));
      return;
    }
    list.replaceChildren(
      ...next.map(({ exam, days }) => {
        const clock = examClock(exam, now);
        // Same wording as the countdown page: Today / Tomorrow / whole days to the start.
        const [big, small] =
          days === 0 ? ["Today", exam.time ?? ""] : days === 1 ? ["1", "day · tomorrow"] : clock.kind === "counting" ? [String(clock.remaining.days), "days"] : ["", ""];
        const li = el("li", `popup__row${days <= 7 ? " is-soon" : ""}`);
        const text = el("span", "popup__text");
        const name = el("span", "popup__name");
        name.append(dot(exam, ids), document.createTextNode([exam.module, exam.label].filter(Boolean).join(" · ")));
        text.append(name, el("span", "popup__when", whenText(exam.date, exam.time)));
        const count = el("span", "popup__count");
        count.append(el("span", "popup__days", big), el("span", "popup__unit", small));
        li.append(text, count);
        return li;
      }),
    );
  });
}

document.getElementById("open-countdown")!.addEventListener("click", () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
  window.close();
});
document.getElementById("open-settings")!.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
  window.close();
});

await render();
