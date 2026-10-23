import type { FormInput } from "../lib/validate";

/** Reads a form into the plain string record the validators take. */
export function readForm(form: HTMLFormElement): FormInput {
  const out: FormInput = {};
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) || !el.name) continue;
    out[el.name] = el instanceof HTMLInputElement && el.type === "checkbox" ? (el.checked ? "on" : "") : el.value;
  }
  return out;
}

/** Fills named fields; unnamed keys are ignored, missing keys clear the field. */
export function fillForm(form: HTMLFormElement, values: FormInput): void {
  form.reset();
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) || !el.name) continue;
    const v = values[el.name];
    if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = v === "on";
    else if (v !== undefined && !(el instanceof HTMLInputElement && el.type === "color" && !v)) el.value = v;
  }
  showErrors(form, {});
}

/** Shows per-field messages, wires them to their inputs for screen readers, and focuses the first problem. */
export function showErrors(form: HTMLFormElement, errors: Record<string, string>): void {
  for (const p of Array.from(form.querySelectorAll<HTMLElement>("[data-error]"))) {
    const name = p.dataset.error!;
    const msg = errors[name];
    p.hidden = !msg;
    p.textContent = msg ?? "";
    const input = form.querySelector<HTMLElement>(`[name="${name}"]`);
    if (!input) continue;
    p.id ||= `err-${form.id}-${name}`;
    if (msg) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", p.id);
    } else {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
  }
  const first = Object.keys(errors).find((k) => k !== "_form");
  if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
}
