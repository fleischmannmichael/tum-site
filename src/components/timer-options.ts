import { el } from "../lib/dom";
import { checkLength, FOCUS_LIMITS, PRESETS, presetOf, type FocusSettings, type PresetName } from "../lib/focus";
import { getLang, t, type Key } from "../lib/i18n";

/*
 * Timer lengths: Classic / Deep work presets or your own focus, break and
 * round counts, plus the bell. Used on the Focus tab and in Settings → Focus.
 */

const FIELDS: [keyof typeof FOCUS_LIMITS, Key][] = [
  ["focusMin", "focus.focusMin"],
  ["shortMin", "focus.shortMin"],
  ["longMin", "focus.longMin"],
  ["rounds", "focus.rounds"],
];

let uid = 0;

/** Updates built controls in place, so typing and Tab aren't interrupted by a save. */
function refresh(root: HTMLElement, current: FocusSettings): void {
  const preset: PresetName = root.dataset.custom === "1" ? "custom" : presetOf(current);
  for (const input of Array.from(root.querySelectorAll<HTMLInputElement>("input[type=radio]"))) input.checked = input.value === preset;
  root.querySelector<HTMLElement>(".timer-fields")!.hidden = preset !== "custom";
  for (const [key] of FIELDS) {
    const input = root.querySelector<HTMLInputElement>(`[data-timer-field="${key}"]`)!;
    if (document.activeElement !== input && !input.hasAttribute("aria-invalid")) input.value = String(current[key]);
  }
  root.querySelector<HTMLInputElement>('[data-timer-field="sound"]')!.checked = current.sound;
}

/**
 * Fills `root`; call again to refresh (e.g. after a change elsewhere) — that
 * updates in place unless the language changed. `onSave` gets the changed
 * values; it rejects with a message to show.
 */
export function renderTimerOptions(root: HTMLElement, current: FocusSettings, onSave: (patch: Partial<FocusSettings>) => Promise<void>): void {
  if (root.dataset.lang === getLang()) return refresh(root, current);
  root.dataset.lang = getLang();
  const id = `timer-${root.id || ++uid}`;
  // Keep "Custom" open across re-renders once picked, even if the numbers match a preset.
  let preset: PresetName = root.dataset.custom === "1" ? "custom" : presetOf(current);
  const focusedField = (document.activeElement as HTMLElement | null)?.dataset?.timerField;

  const chips = el("div", "chips");
  chips.setAttribute("role", "radiogroup");
  chips.setAttribute("aria-label", t("focus.timer"));
  const custom = el("div", "timer-fields");
  const error = el("p", "timer-fields__error");
  error.setAttribute("role", "alert");

  for (const [value, label] of [["classic", "focus.classic"], ["deep", "focus.deep"], ["custom", "focus.custom"]] as const) {
    const chip = el("label", "chip");
    const input = el("input");
    input.type = "radio";
    input.name = `${id}-preset`;
    input.value = value;
    input.checked = preset === value;
    input.addEventListener("change", () => {
      preset = value;
      root.dataset.custom = value === "custom" ? "1" : "";
      custom.hidden = value !== "custom";
      if (value !== "custom") void onSave({ ...PRESETS[value], rounds: 4 }).catch((m: string) => (error.textContent = m));
    });
    chip.append(input, el("span", "", t(label)));
    chips.append(chip);
  }

  for (const [key, label] of FIELDS) {
    const field = el("label", "timer-fields__field");
    const input = el("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.min = String(FOCUS_LIMITS[key][0]);
    input.max = String(FOCUS_LIMITS[key][1]);
    input.step = "1";
    input.value = String(current[key]);
    input.dataset.timerField = key;
    input.addEventListener("change", () => {
      const value = checkLength(key, input.value);
      input.toggleAttribute("aria-invalid", value === null);
      if (value === null) {
        error.textContent = t("focus.lengthError");
        return;
      }
      error.textContent = "";
      void onSave({ [key]: value }).catch((m: string) => (error.textContent = m));
    });
    field.append(el("span", "timer-fields__label", t(label)), input);
    custom.append(field);
  }
  custom.hidden = preset !== "custom";

  const sound = el("label", "check");
  const box = el("input");
  box.type = "checkbox";
  box.checked = current.sound;
  box.dataset.timerField = "sound";
  box.addEventListener("change", () => void onSave({ sound: box.checked }).catch((m: string) => (error.textContent = m)));
  sound.append(box, el("span", "", t("focus.sound")));

  root.replaceChildren(chips, custom, error, sound);
  if (focusedField) root.querySelector<HTMLElement>(`[data-timer-field="${focusedField}"]`)?.focus();
}
