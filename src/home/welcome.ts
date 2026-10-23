import { applyI18n, getLang, setLang } from "../lib/i18n";
import { startData, type StartKind } from "../lib/start";
import { describeSaveError, saveAll } from "../lib/storage";
import type { Language, StoredData } from "../lib/types";

/*
 * The first visit: pick the language, optionally your name, and how to start —
 * blank, or with the TUM example. Nothing is saved until you choose, so
 * closing it (Esc) just asks again next time.
 */
export function showWelcome(dialog: HTMLDialogElement, current: StoredData, onDone: (data: StoredData) => void): void {
  const name = dialog.querySelector<HTMLInputElement>("#welcome-name")!;
  for (const radio of Array.from(dialog.querySelectorAll<HTMLInputElement>('input[name="welcome-lang"]'))) {
    radio.checked = radio.value === getLang();
    // The dialog (and the page behind it) switches language right away.
    radio.addEventListener("change", () => {
      setLang(radio.value as Language);
      applyI18n();
    });
  }

  for (const button of Array.from(dialog.querySelectorAll<HTMLButtonElement>("[data-start]")))
    button.addEventListener("click", async () => {
      const kind = button.dataset.start as StartKind;
      const settings = { ...current.settings, language: getLang() };
      const typed = name.value.trim().slice(0, 40);
      if (typed) settings.name = typed;
      const data = startData(kind, { ...current, settings });
      try {
        await saveAll(data);
      } catch (err) {
        alert(describeSaveError(err));
        return;
      }
      dialog.close();
      onDone(data);
    });

  dialog.showModal();
  // Start in the name field only with a keyboard-friendly focus; the choices are buttons below it.
  name.focus();
}
