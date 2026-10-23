import { dot, whenText } from "../components/exam-grid";
import { applyAccent } from "../lib/accent";
import { examClock, summarize } from "../lib/countdown";
import { el } from "../lib/dom";
import { applyI18n, cachedLang, setLang, t } from "../lib/i18n";
import { loadAll } from "../lib/storage";

const NEXT = 3;

setLang(cachedLang());
applyI18n();

function render(): Promise<void> {
  return loadAll().then((data) => {
    applyAccent(data.settings.accent);
    setLang(data.settings.language);
    applyI18n();
    const now = Date.now();
    const ids = data.exams.map((e) => e.id);
    const next = summarize(data.exams, now).upcoming.slice(0, NEXT);
    const list = document.getElementById("next-exams")!;
    if (!next.length) {
      list.replaceChildren(el("li", "popup__empty", t("popup.empty")));
      return;
    }
    list.replaceChildren(
      ...next.map(({ exam, days }) => {
        const clock = examClock(exam, now);
        // Same wording as the countdown page: Today / Tomorrow / whole days to the start.
        const [big, small] =
          days === 0
            ? [t("status.today"), exam.time ?? ""]
            : days === 1
              ? ["1", t("popup.dayTomorrow")]
              : clock.kind === "counting"
                ? [String(clock.remaining.days), t("clock.days")]
                : ["", ""];
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
