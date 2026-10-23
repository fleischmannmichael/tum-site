import { chime, unlockAudio } from "../lib/chime";
import { summarize } from "../lib/countdown";
import { el } from "../lib/dom";
import {
  FOCUS_DEFAULTS,
  PRESETS,
  WINDOWS_PER_DAY,
  advance,
  formatClock,
  formatMinutes,
  initialState,
  logSession,
  pause,
  phaseMs,
  progress,
  remaining,
  reset,
  start,
  tick,
  today,
  week,
  type FocusSettings,
  type Phase,
  type TimerState,
} from "../lib/focus";
import { describeSaveError, save } from "../lib/storage";
import type { StoredData } from "../lib/types";
import { dotColor } from "./exam-grid";
import { modulesInOrder } from "./nav";

/*
 * The Focus tab: a Pomodoro timer drawn as the Thiersch tower clock. The gold
 * arc fills and the hand sweeps once per phase; every finished focus session
 * lights one window of the tower for the day.
 *
 * The running timer lives in localStorage (not the synced data: it changes
 * every start/pause and only matters on this device), so it survives reloads
 * and other open tabs follow along.
 */

const TIMER_KEY = "exam-tab-focus-timer";
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const PHASE_NAMES: Record<Phase, string> = { focus: "Focus", short: "Short break", long: "Long break" };

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
  let lastAnnounced = "";
  const baseTitle = document.title;

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
      const focusLog = logSession(getData().focusLog, state.module, s.focusMin, Date.now());
      update({ focusLog });
      save("focusLog", focusLog).catch((err) => announce(describeSaveError(err)));
      announce(`Focus session done — a window lights up. Time for a ${next.phase === "long" ? "long" : "short"} break.`);
    } else announce("Break over. Ready for the next focus session?");
    if (s.sound) chime(finished === "focus" ? "focus-done" : "break-done");
  }

  function announce(text: string): void {
    lastAnnounced = text;
    $("focus-status").textContent = text;
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
    document.title = state.status === "running" ? `${clock} · ${PHASE_NAMES[state.phase]}` : baseTitle;
  }

  function paint(): void {
    const s = settings();
    const timer = $("view-focus").querySelector(".focus__timer")!;
    timer.classList.toggle("is-break", state.phase !== "focus");
    timer.classList.toggle("is-running", state.status === "running");
    $("focus-phase").textContent =
      state.phase === "focus" ? `Focus · round ${Math.min(state.round, s.rounds)} of ${s.rounds}` : PHASE_NAMES[state.phase];
    const startBtn = $<HTMLButtonElement>("focus-start");
    startBtn.textContent = state.status === "running" ? "Pause" : state.status === "paused" ? "Resume" : state.phase === "focus" ? "Start" : "Start break";
    $<HTMLButtonElement>("focus-reset").disabled = state.status === "idle" && state.remainingMs === phaseMs(state.phase, s);
    if (!lastAnnounced) $("focus-status").textContent = state.module ? `Counting toward ${state.module}` : "Not counting toward a module";
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
        lastAnnounced = "";
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
      label.append(el("span", "", name ?? "No module"));
      return label;
    });
    $("focus-modules").replaceChildren(...chips);
  }

  function renderLog(): void {
    const data = getData();
    const now = Date.now();
    const t = today(data.focusLog, now);
    const lit = Math.min(t.sessions, WINDOWS_PER_DAY);
    $("tower-windows").replaceChildren(
      ...Array.from({ length: WINDOWS_PER_DAY }, (_, i) => el("span", i < lit ? "tower__window is-lit" : "tower__window")),
    );
    $("today-text").textContent =
      t.sessions === 0
        ? "No sessions yet today. Each one lights a window."
        : `${t.sessions} ${t.sessions === 1 ? "session" : "sessions"} · ${formatMinutes(t.minutes)}` +
          (t.sessions >= WINDOWS_PER_DAY ? " · the tower is lit" : "");

    const rows = week(data.focusLog, now);
    const max = Math.max(1, ...rows.map((r) => r.minutes));
    const ids = data.exams.map((e) => e.id);
    $("week-list").replaceChildren(
      ...(rows.length
        ? rows.map((r) => {
            const li = el("li", "week__row");
            const exam = data.exams.find((e) => e.module === r.module);
            li.style.setProperty("--bar", exam ? dotColor(exam, ids) : "var(--color-text-faint)");
            li.style.setProperty("--share", String(r.minutes / max));
            li.append(el("span", "week__name", r.module ?? "No module"), el("span", "week__minutes", formatMinutes(r.minutes)), el("span", "week__bar"));
            return li;
          })
        : [el("li", "week__empty", "Your study time per module shows up here.")]),
    );
  }

  function renderOptions(): void {
    const s = settings();
    const preset = s.focusMin === PRESETS.deep.focusMin ? "deep" : "classic";
    for (const input of document.querySelectorAll<HTMLInputElement>('input[name="focus-preset"]')) input.checked = input.value === preset;
    $<HTMLInputElement>("focus-sound").checked = s.sound;
  }

  async function saveSettings(patch: Partial<FocusSettings>): Promise<void> {
    const next = { ...getData().settings, focus: { ...settings(), ...patch } };
    update({ settings: next });
    await save("settings", next);
  }

  // ---- Controls ----

  function toggle(): void {
    unlockAudio();
    lastAnnounced = "";
    set(state.status === "running" ? pause(state, Date.now()) : start(state, Date.now()));
    if (state.status === "running") announce(state.phase === "focus" ? "Focus started. The tower is watching." : "Break started.");
  }
  const doReset = () => {
    lastAnnounced = "";
    set(reset(state, settings()));
  };
  const skip = () => {
    lastAnnounced = "";
    set(advance(state, settings())); // skipping never logs a session
  };

  $("focus-start").addEventListener("click", toggle);
  $("focus-reset").addEventListener("click", doReset);
  $("focus-skip").addEventListener("click", skip);

  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="focus-preset"]'))
    input.addEventListener("change", async () => {
      const done = saveSettings(PRESETS[input.value as keyof typeof PRESETS]);
      // A timer that hasn't started yet takes the new length right away.
      if (state.status === "idle") set(reset(state, settings()));
      await done.catch((err) => announce(describeSaveError(err)));
    });
  $<HTMLInputElement>("focus-sound").addEventListener("change", (e) => {
    const on = (e.target as HTMLInputElement).checked;
    if (on) unlockAudio();
    saveSettings({ sound: on }).catch((err) => announce(describeSaveError(err)));
  });

  document.addEventListener("keydown", (e) => {
    if ($("view-focus").hidden || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, select, button, a, dialog[open]")) return;
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
      renderLog();
      renderOptions();
      paint();
    },
  };
}
