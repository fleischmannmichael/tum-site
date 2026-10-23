import { el } from "../lib/dom";
import {
  addMinutes,
  dayOf,
  entriesOn,
  formatMinutes,
  heatmap,
  level,
  loggable,
  minutesSince,
  parseMinutes,
  parseStudyLog,
  removeEntry,
  streak,
  toCsv,
  type FocusEntry,
} from "../lib/focus";
import { formatDateDE } from "../lib/format";
import { getLang, t, tn } from "../lib/i18n";
import type { Exam } from "../lib/types";
import { dotColor } from "./exam-grid";

/*
 * Study log: a year of studying as a heatmap (one square per day, Monday on
 * top), a panel for the picked day with its entries, a form to log time by
 * hand, and upload/download of the log as CSV.
 */

const WEEKS = 53;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const locale = () => (getLang() === "de" ? "de-DE" : "en-GB");

const dayToDate = (day: string) => new Date(`${day}T12:00:00Z`);
const weekdayDate = (day: string) =>
  `${new Intl.DateTimeFormat(locale(), { weekday: "short", timeZone: "UTC" }).format(dayToDate(day))} ${formatDateDE(day)}`;

export type HeatmapDeps = {
  getLog: () => FocusEntry[];
  getExams: () => Exam[];
  modules: () => string[];
  /** Applies and saves a new log; rejects with a message. */
  setLog: (log: FocusEntry[]) => Promise<void>;
};

export function initHeatmap(deps: HeatmapDeps): { render(): void } {
  let selected = dayOf(Date.now());
  let message = "";

  const say = (text: string) => {
    message = text;
    $("heat-message").textContent = text;
  };

  async function commit(log: FocusEntry[], done: string): Promise<void> {
    try {
      await deps.setLog(log);
      say(done);
    } catch (err) {
      say(String(err instanceof Error ? err.message : err));
    }
  }

  function colorFor(module: string | null): string {
    const exams = deps.getExams();
    const exam = exams.find((e) => e.module === module);
    return exam ? dotColor(exam, exams.map((e) => e.id)) : "var(--color-text-faint)";
  }

  // ---- Grid --------------------------------------------------------------------
  function renderGrid(): void {
    const now = Date.now();
    const log = deps.getLog();
    const weeks = heatmap(log, now, WEEKS);
    const grid = $("heat-grid");
    const months = $("heat-months");
    const monthName = new Intl.DateTimeFormat(locale(), { month: "short", timeZone: "UTC" });

    const cells: HTMLElement[] = [];
    const labels: HTMLElement[] = [];
    weeks.forEach((week, w) => {
      // A month label over the first week that starts in that month.
      const first = week[0]!.day;
      const prev = weeks[w - 1]?.[0]!.day;
      const label = el("span", "heat__month");
      if (!prev || first.slice(5, 7) !== prev.slice(5, 7)) label.textContent = monthName.format(dayToDate(first));
      labels.push(label);
      for (const d of week) {
        if (d.future) {
          cells.push(el("span", "heat__cell heat__cell--future"));
          continue;
        }
        const cell = el("button", `heat__cell heat--${level(d.minutes)}`);
        cell.type = "button";
        cell.dataset.day = d.day;
        cell.tabIndex = d.day === selected ? 0 : -1;
        cell.setAttribute("aria-pressed", String(d.day === selected));
        const text = d.minutes
          ? t("heat.cell", { date: weekdayDate(d.day), time: formatMinutes(d.minutes) })
          : t("heat.cellEmpty", { date: weekdayDate(d.day) });
        cell.setAttribute("aria-label", text);
        cell.title = text;
        cells.push(cell);
      }
    });
    months.replaceChildren(...labels);
    // Row labels: Monday, Wednesday, Friday (2026-10-26 was a Monday).
    const weekday = new Intl.DateTimeFormat(locale(), { weekday: "short", timeZone: "UTC" });
    const rows = document.querySelectorAll<HTMLElement>(".heat__weekdays span");
    for (const [row, day] of [[1, "2026-10-26"], [3, "2026-10-28"], [5, "2026-10-30"]] as const)
      if (rows[row]) rows[row].textContent = weekday.format(dayToDate(day));
    grid.replaceChildren(...cells);

    // Newest weeks are on the right: start scrolled there on narrow screens.
    const scroller = grid.closest<HTMLElement>(".heat__scroll");
    if (scroller && !scroller.dataset.scrolled) {
      scroller.scrollLeft = scroller.scrollWidth;
      scroller.dataset.scrolled = "1";
    }

    const week = minutesSince(log, now, 7);
    const year = minutesSince(log, now, 365);
    const s = streak(log, now);
    $("heat-summary").textContent = t("heat.summary", {
      week: formatMinutes(week),
      year: formatMinutes(year),
      streak: s ? tn("heat.streak", s) : t("heat.noStreak"),
    });
  }

  function select(day: string, focus = false): void {
    selected = day;
    renderGrid();
    renderDay();
    ($("heat-date") as HTMLInputElement).value = day;
    if (focus) $("heat-grid").querySelector<HTMLElement>(`[data-day="${day}"]`)?.focus();
  }

  $("heat-grid").addEventListener("click", (e) => {
    const cell = (e.target as Element).closest<HTMLElement>("[data-day]");
    if (cell) select(cell.dataset.day!, true); // the grid is rebuilt: keep focus on the picked day
  });
  // Arrow keys move through days (up/down) and weeks (left/right), like the grid looks.
  $("heat-grid").addEventListener("keydown", (e) => {
    const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = new Date(dayToDate(selected).getTime() + step * 86_400_000).toISOString().slice(0, 10);
    if (loggable(next, Date.now()) && $("heat-grid").querySelector(`[data-day="${next}"]`)) select(next, true);
  });

  // ---- The picked day -------------------------------------------------------------
  function renderDay(): void {
    $("heat-day-title").textContent = weekdayDate(selected);
    const entries = entriesOn(deps.getLog(), selected);
    const list = $("heat-day-list");
    if (!entries.length) {
      list.replaceChildren(el("li", "heat-day__empty", t("heat.dayEmpty")));
      return;
    }
    list.replaceChildren(
      ...entries.map((entry) => {
        const li = el("li", "heat-day__row");
        const name = el("span", "heat-day__name");
        const dot = el("span", "dot");
        dot.style.setProperty("--dot", colorFor(entry.module));
        dot.setAttribute("aria-hidden", "true");
        name.append(dot, document.createTextNode(entry.module ?? t("focus.noModule")));
        const del = el("button", "heat-day__remove", "✕");
        del.type = "button";
        const label = entry.module ?? t("focus.noModule");
        del.setAttribute("aria-label", t("heat.remove", { module: label, date: formatDateDE(entry.day) }));
        del.title = del.getAttribute("aria-label")!;
        del.addEventListener("click", () => {
          void commit(removeEntry(deps.getLog(), entry.day, entry.module), t("heat.removed")).then(() => $("heat-time").focus());
        });
        li.append(name, el("span", "heat-day__time", formatMinutes(entry.minutes)), del);
        return li;
      }),
    );
  }

  // ---- Logging by hand -------------------------------------------------------------
  function renderModuleSelect(): void {
    const select = $<HTMLSelectElement>("heat-module");
    const value = select.value;
    const names = deps.modules();
    select.replaceChildren(
      ...names.map((m) => Object.assign(document.createElement("option"), { value: m, textContent: m })),
      Object.assign(document.createElement("option"), { value: "", textContent: t("focus.noModule") }),
    );
    select.value = names.includes(value) || value === "" ? value : (names[0] ?? "");
  }

  $("heat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const now = Date.now();
    const day = ($("heat-date") as HTMLInputElement).value;
    const timeInput = $<HTMLInputElement>("heat-time");
    const minutes = parseMinutes(timeInput.value);
    if (!day || !loggable(day, now)) return say(t("heat.badDate"));
    if (minutes === null || minutes <= 0 || minutes > 24 * 60) {
      timeInput.setAttribute("aria-invalid", "true");
      return say(t("heat.badTime"));
    }
    timeInput.removeAttribute("aria-invalid");
    const module = $<HTMLSelectElement>("heat-module").value || null;
    selected = day;
    void commit(addMinutes(deps.getLog(), day, module, minutes, now), t("heat.added", { time: formatMinutes(minutes), date: formatDateDE(day) })).then(() => {
      timeInput.value = "";
    });
  });

  // ---- Upload / download -------------------------------------------------------------
  $("heat-upload").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ""; // the same file can be picked again
    if (!file) return;
    const now = Date.now();
    const parsed = parseStudyLog(await file.text(), deps.modules());
    const rows = parsed.rows.filter((r) => loggable(r.day, now));
    const skipped = parsed.skipped + parsed.rows.length - rows.length;
    if (!rows.length) return say(t("heat.importNone"));
    const total = rows.reduce((sum, r) => sum + r.minutes, 0);
    if (!confirm(t("heat.importConfirm", { n: rows.length, time: formatMinutes(total) }))) return;
    const log = rows.reduce((acc, r) => addMinutes(acc, r.day, r.module, r.minutes, now), deps.getLog());
    await commit(log, skipped ? t("heat.importedSkipped", { n: rows.length, skipped }) : t("heat.imported", { n: rows.length }));
  });

  $("heat-export").addEventListener("click", () => {
    const blob = new Blob([toCsv(deps.getLog())], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `study-log-${dayOf(Date.now())}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  });

  ($("heat-date") as HTMLInputElement).value = selected;

  return {
    render() {
      const date = $<HTMLInputElement>("heat-date");
      date.max = dayOf(Date.now());
      if (!loggable(selected, Date.now())) selected = dayOf(Date.now()); // past midnight, a year on
      renderGrid();
      renderDay();
      renderModuleSelect();
      $("heat-message").textContent = message;
    },
  };
}
