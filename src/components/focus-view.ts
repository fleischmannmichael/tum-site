import { chime, unlockAudio } from "../lib/chime";
import { summarize } from "../lib/countdown";
import { el } from "../lib/dom";
import {
  advance,
  FOCUS_DEFAULTS,
  formatClock,
  initialState,
  logSession,
  pause,
  phaseMs,
  progress,
  remaining,
  reset,
  start,
  tick,
  type FocusSettings,
  type TimerState,
} from "../lib/focus";
import { t, type Key } from "../lib/i18n";
import { describeSaveError, save } from "../lib/storage";
import type { StoredData } from "../lib/types";
import { dotColor } from "./exam-grid";
import { initHeatmap } from "./heatmap";
import { modulesInOrder } from "./nav";
import { renderTimerOptions } from "./timer-options";

/*
 * The Focus tab: a Pomodoro timer drawn as the Thiersch tower clock (the gold
 * arc fills and the hand sweeps once per phase), and the study log heatmap,
 * which every finished focus session adds to.
 *
 * The running timer lives in localStorage (not the synced data: it changes
 * every start/pause and only matters on this device), so it survives reloads
 * and other open tabs follow along.
 */

const TIMER_KEY = "exam-tab-focus-timer";
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** The status line: a message key (so it follows a language switch) or an error sentence. */
type Said = { key: Key; vars?: Record<string, string> } | { text: string } | null;

function readTimer(): TimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    return raw ? (JSON.parse(raw) as TimerState) : null;
  } catch {
    return null;
  }
}

function writeTimer(st: TimerState): void {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(st));
  } catch {
    // private mode: the timer still works, it just won't survive a reload
  }
}

/** `update` applies a saved change to the page's data right away (storage events only reach other tabs). */
export function initFocus(getData: () => StoredData, update: (patch: Partial<StoredData>) => void): { render(): void } {
  const settings = (): FocusSettings => ({ ...FOCUS_DEFAULTS, ...getData().settings.focus });
  let state: TimerState = readTimer() ?? initialState(settings(), defaultModule());
  let finishTimer: number | undefined;
  let display: number | undefined;
  // The last message, kept as a key so it follows a language switch.
  let said: Said = null;

  function defaultModule(): string | null {
    const s = summarize(getData().exams, Date.now());
    const next = s.state.kind === "none" ? undefined : s.state.next.exam;
    return next?.module ?? null;
  }

  // 60 minute ticks, every fifth one longer.
  const ticks = $("dial-ticks");
  for (let i = 0; i < 60; i++) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const major = i % 5 === 0;
    line.setAttribute("class", major ? "dial__tick dial__tick--major" : "dial__tick");
    line.setAttribute("x1", "100");
    line.setAttribute("x2", "100");
    line.setAttribute("y1", "13");
    line.setAttribute("y2", major ? "22" : "18");
    line.setAttribute("transform", `rotate(${i * 6} 100 100)`);
    ticks.append(line);
  }

  function set(next: TimerState, persist = true): void {
    state = next;
    if (persist) writeTimer(state);
    schedule();
    paint();
  }

  /** One timeout to the end of the phase (chained short timers get throttled in background tabs). */
  function schedule(): void {
    window.clearTimeout(finishTimer);
    if (state.status === "running" && state.endsAt !== null)
      finishTimer = window.setTimeout(finishIfDue, Math.max(0, state.endsAt - Date.now()) + 20);
    window.clearInterval(display);
    if (state.status === "running") display = window.setInterval(paintClock, 250);
  }

  function finishIfDue(): void {
    // Another tab may already have finished this phase: only the first one logs it.
    const stored = readTimer();
    if (stored && (stored.status !== state.status || stored.endsAt !== state.endsAt)) {
      set(stored, false);
      return;
    }
    const s = settings();
    const { state: next, finished } = tick(state, Date.now(), s);
    if (!finished) return schedule();
    set(next);
    if (finished === "focus") {
      void setLog(logSession(getData().focusLog, state.module, s.focusMin, Date.now())).catch((m: string) => announceText(m));
      announce(next.phase === "long" ? "focus.doneLong" : "focus.doneShort", named());
    } else announce("focus.breakOver", named());
    if (s.sound) chime(finished === "focus" ? "focus-done" : "break-done");
  }

  function announce(key: Key, vars?: Record<string, string>): void {
    said = { key, vars };
    $("focus-status").textContent = t(key, vars);
  }
  /** ", Michael" for messages that address you, once your name is set. */
  const named = () => ({ n: getData().settings.name?.trim() ? `, ${getData().settings.name!.trim()}` : "" });

  /** Errors come as finished sentences. */
  function announceText(text: string): void {
    said = { text };
    $("focus-status").textContent = text;
  }

  /** Applies and saves a new study log; rejects with a message. */
  async function setLog(focusLog: StoredData["focusLog"]): Promise<void> {
    update({ focusLog });
    try {
      await save("focusLog", focusLog);
    } catch (err) {
      throw describeSaveError(err);
    }
  }

  // ---- Painting ----

  function paintClock(): void {
    const now = Date.now();
    const s = settings();
    const ms = remaining(state, now);
    const p = Math.min(1, Math.max(0, progress(state, now, s)));
    const clock = formatClock(ms);
    $("focus-time").textContent = clock;
    const arc = $("dial-progress").style;
    arc.strokeDasharray = `${p * 100} 100`;
    arc.opacity = p > 0 ? "1" : "0"; // a zero-length arc would still draw its round cap
    $("dial-hand").setAttribute("transform", `rotate(${p * 360} 100 100)`);
    // The tab title shows the time left on every view, so it's readable from other tabs.
    document.title = state.status === "running" ? `${clock} · ${t(`focus.phase.${state.phase}`)}` : t("page.title");
  }

  function paint(): void {
    const s = settings();
    const timer = $("view-focus").querySelector(".focus__timer")!;
    timer.classList.toggle("is-break", state.phase !== "focus");
    timer.classList.toggle("is-running", state.status === "running");
    $("focus-phase").textContent =
      state.phase === "focus" ? t("focus.round", { round: Math.min(state.round, s.rounds), rounds: s.rounds }) : t(`focus.phase.${state.phase}`);
    const startBtn = $<HTMLButtonElement>("focus-start");
    startBtn.textContent = t(
      state.status === "running" ? "focus.pause" : state.status === "paused" ? "focus.resume" : state.phase === "focus" ? "focus.start" : "focus.startBreak",
    );
    $<HTMLButtonElement>("focus-reset").disabled = state.status === "idle" && state.remainingMs === phaseMs(state.phase, s);
    $("focus-status").textContent = said
      ? "text" in said
        ? said.text
        : t(said.key, said.vars)
      : state.module
        ? t("focus.counting", { module: state.module })
        : t("focus.notCounting");
    paintClock();
  }

  function renderModules(): void {
    const data = getData();
    const names = modulesInOrder(data.exams).map((list) => list[0]!.module);
    // A module that was removed from the exam list falls back to "none".
    if (state.module !== null && !names.includes(state.module)) state = { ...state, module: null };
    const chips = [...names, null].map((name) => {
      const label = el("label", "chip");
      const input = el("input");
      input.type = "radio";
      input.name = "focus-module";
      input.value = name ?? "";
      input.checked = state.module === name;
      input.addEventListener("change", () => {
        said = null;
        set({ ...state, module: name });
      });
      label.append(input);
      if (name) {
        const d = el("span", "dot");
        const exam = data.exams.find((e) => e.module === name)!;
        d.style.setProperty("--dot", dotColor(exam, data.exams.map((e) => e.id)));
        d.setAttribute("aria-hidden", "true");
        label.append(d);
      }
      label.append(el("span", "", name ?? t("focus.noModule")));
      return label;
    });
    $("focus-modules").replaceChildren(...chips);
  }

  const heat = initHeatmap({
    getLog: () => getData().focusLog,
    getExams: () => getData().exams,
    modules: () => modulesInOrder(getData().exams).map((list) => list[0]!.module),
    setLog,
  });

  function renderOptions(): void {
    renderTimerOptions($("focus-options"), settings(), async (patch) => {
      await saveSettings(patch);
      // A timer that hasn't started yet takes new lengths right away.
      if (state.status === "idle" && ("focusMin" in patch || "shortMin" in patch || "longMin" in patch)) set(reset(state, settings()));
      if (patch.sound) unlockAudio();
    });
  }

  async function saveSettings(patch: Partial<FocusSettings>): Promise<void> {
    const next = { ...getData().settings, focus: { ...settings(), ...patch } };
    update({ settings: next });
    try {
      await save("settings", next);
    } catch (err) {
      throw describeSaveError(err);
    }
  }

  // ---- Controls ----

  function toggle(): void {
    unlockAudio();
    said = null;
    set(state.status === "running" ? pause(state, Date.now()) : start(state, Date.now()));
    if (state.status === "running") announce(state.phase === "focus" ? "focus.started" : "focus.breakStarted", named());
  }
  const doReset = () => {
    said = null;
    set(reset(state, settings()));
  };
  const skip = () => {
    said = null;
    set(advance(state, settings())); // skipping never logs a session
  };

  $("focus-start").addEventListener("click", toggle);
  $("focus-reset").addEventListener("click", doReset);
  $("focus-skip").addEventListener("click", skip);

  document.addEventListener("keydown", (e) => {
    if ($("view-focus").hidden || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, select, button, a, dialog[open], .heat")) return;
    const key = e.key.toLowerCase();
    if (key === " ") toggle();
    else if (key === "r") doReset();
    else if (key === "s") skip();
    else return;
    e.preventDefault();
  });

  // Other tabs: follow their start/pause/finish.
  window.addEventListener("storage", (e) => {
    if (e.key !== TIMER_KEY) return;
    const fresh = readTimer();
    if (fresh) set(fresh, false);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) finishIfDue();
  });

  // A phase that ended while the page was closed is finished (and logged) now,
  // once the caller has its handle back.
  queueMicrotask(finishIfDue);

  return {
    render() {
      renderModules();
      heat.render();
      renderOptions();
      paint();
    },
  };
}
