import type { ExamClock } from "../lib/countdown";
import { el } from "../lib/dom";
import type { Exam } from "../lib/types";

const SMALL_UNITS = [
  ["hours", "hrs"],
  ["minutes", "min"],
  ["seconds", "sec"],
] as const;

/** Big serif day count, then hours · minutes · seconds. Filled in by updateClock(). */
export function clockEl(examId: string, size: "sm" | "lg" = "sm"): HTMLSpanElement {
  const clock = el("span", `clock clock--${size}`);
  clock.dataset.clockFor = examId;
  const days = el("span", "clock__days");
  days.append(el("span", "clock__days-num", "–"), el("span", "clock__days-label"));
  const rest = el("span", "clock__rest");
  for (const [unit, label] of SMALL_UNITS) {
    const box = el("span", "clock__unit");
    box.dataset.unit = unit;
    box.append(el("span", "clock__num", "–"), el("span", "clock__label", label));
    rest.append(box);
  }
  clock.append(days, rest);
  return clock;
}

const pad = (n: number) => String(n).padStart(2, "0");

function setText(node: Element | null, text: string): void {
  if (node && node.textContent !== text) node.textContent = text; // avoid needless DOM writes every second
}

/** Updates a clock in place; cheap enough for every tick. */
export function updateClock(clock: HTMLElement, state: ExamClock, exam: Exam, showSeconds: boolean): void {
  clock.dataset.state = state.kind;
  clock.classList.toggle("clock--no-seconds", !showSeconds);
  const daysNum = clock.querySelector(".clock__days-num");
  const daysLabel = clock.querySelector(".clock__days-label");
  const num = (unit: string) => clock.querySelector(`[data-unit="${unit}"] .clock__num`);

  if (state.kind === "counting") {
    const r = state.remaining;
    setText(daysNum, String(r.days));
    // Small panels have no room for "ahead"; the module page does.
    const ahead = clock.classList.contains("clock--lg") ? " ahead" : "";
    setText(daysLabel, (r.days === 1 ? "day" : "days") + ahead);
    setText(num("hours"), pad(r.hours));
    setText(num("minutes"), pad(r.minutes));
    setText(num("seconds"), pad(r.seconds));
    return;
  }
  // The small units only make sense while counting; CSS hides them otherwise.
  const words = {
    today: ["Today", [exam.time, exam.room].filter(Boolean).join(" · ") || "Good luck"],
    tba: ["–", "days"],
    done: ["Done", ""],
  } as const;
  const [big, small] = words[state.kind];
  setText(daysNum, big);
  setText(daysLabel, small);
}
