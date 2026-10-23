import type { ExamClock } from "../lib/countdown";
import type { Exam } from "../lib/types";
import { el } from "../lib/dom";

const UNITS = [
  ["days", "days"],
  ["hours", "hrs"],
  ["minutes", "min"],
  ["seconds", "sec"],
] as const;

/** Four labelled numbers: days · hours · minutes · seconds. Filled in by updateClock(). */
export function clockEl(examId: string, size: "sm" | "lg" = "sm"): HTMLSpanElement {
  const clock = el("span", `clock clock--${size}`);
  clock.dataset.clockFor = examId;
  for (const [unit, label] of UNITS) {
    const box = el("span", "clock__unit");
    box.dataset.unit = unit;
    const num = el("span", "clock__num", "–");
    box.append(num, el("span", "clock__label", label));
    clock.append(box);
  }
  clock.append(el("span", "clock__status"));
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
  const num = (unit: string) => clock.querySelector(`[data-unit="${unit}"] .clock__num`);
  const status = clock.querySelector(".clock__status");

  if (state.kind === "counting") {
    const r = state.remaining;
    setText(num("days"), String(r.days));
    setText(num("hours"), pad(r.hours));
    setText(num("minutes"), pad(r.minutes));
    setText(num("seconds"), pad(r.seconds));
    setText(status, "");
    return;
  }
  for (const [unit] of UNITS) setText(num(unit), "–");
  // TBA/done are already said by the date line next to the clock; only exam day needs words here.
  setText(status, state.kind === "today" ? ["Today", exam.time, exam.room].filter(Boolean).join(" · ") : "");
}
