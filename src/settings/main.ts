import { dotColor } from "../components/exam-grid";
import { renderTimerOptions } from "../components/timer-options";
import { applyAccent } from "../lib/accent";
import { FOCUS_DEFAULTS, formatMinutes, toCsv, type FocusSettings } from "../lib/focus";
import { formatDateDE } from "../lib/format";
import { applyI18n, cachedLang, setLang, t, type Key } from "../lib/i18n";
import { describeSaveError, loadAll, onDataChanged, save, saveAll } from "../lib/storage";
import { storageArea } from "../lib/storage-area";
import type { Exam, Language, Resource, StoredData } from "../lib/types";
import { parseBackup, toBackup, validateExam, validateResource, type FormInput } from "../lib/validate";
import { fillForm, readForm, showErrors } from "./form";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const DEFAULT_CATEGORIES = ["Portals", "Lecture notes", "Exercises", "Past exams"];

setLang(cachedLang());
applyI18n();
let data: StoredData = await loadAll();
setLang(data.settings.language);

// ---- Tabs: one per part of the site ------------------------------------------------
const TABS = ["countdown", "modules", "focus", "general"] as const;
type Tab = (typeof TABS)[number];

function showTab(tab: Tab, focus = false): void {
  for (const name of TABS) {
    const button = $(`tab-${name}`);
    const selected = name === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    $(`panel-${name}`).hidden = !selected;
  }
  if (focus) $(`tab-${tab}`).focus();
  if (location.hash.slice(1) !== tab) history.replaceState(null, "", `#${tab}`);
}

const tabList = document.querySelector<HTMLElement>("[role=tablist]")!;
for (const name of TABS) $(`tab-${name}`).addEventListener("click", () => showTab(name));
// Arrow keys move between tabs (the usual tab-list keyboard pattern).
tabList.addEventListener("keydown", (e) => {
  const current = TABS.findIndex((name) => $(`tab-${name}`).getAttribute("aria-selected") === "true");
  const step = { ArrowRight: 1, ArrowLeft: -1, Home: -current, End: TABS.length - 1 - current }[e.key];
  if (step === undefined) return;
  e.preventDefault();
  showTab(TABS[(current + step + TABS.length) % TABS.length]!, true);
});

// ---- Feedback --------------------------------------------------------------------
let toastTimer: number | undefined;
function toast(message: string): void {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("toast--visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("toast--visible"), 3000);
}

// ---- Lists -----------------------------------------------------------------------
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text) n.textContent = text;
  return n;
}

function button(text: string, className: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", className, text);
  b.type = "button";
  b.setAttribute("aria-label", label);
  b.addEventListener("click", onClick);
  return b;
}

function actions(name: string, onEdit: () => void, onDelete: () => void): HTMLDivElement {
  const box = el("div", "item__actions");
  box.append(
    button(t("settings.edit"), "btn btn--quiet", t("settings.editItem", { name }), onEdit),
    button(t("settings.delete"), "btn btn--quiet btn--danger", t("settings.deleteItem", { name }), onDelete),
  );
  return box;
}

/** "Schaltungstheorie · Midterm": the module plus its label, if any. */
const examName = (e: Exam) => [e.module, e.label].filter(Boolean).join(" · ");

const byDate = (a: Exam, b: Exam) =>
  (a.date ?? "9999").localeCompare(b.date ?? "9999") || (a.time ?? "").localeCompare(b.time ?? "") || a.module.localeCompare(b.module);

function renderExams(): void {
  const ids = data.exams.map((e) => e.id);
  const list = $("exam-list");
  if (!data.exams.length) {
    list.replaceChildren(el("li", "item item--empty", t("settings.noExams")));
    return;
  }
  list.replaceChildren(
    ...[...data.exams].sort(byDate).map((exam) => {
      const li = el("li", "item");
      const dot = el("span", "dot");
      dot.style.setProperty("--dot", dotColor(exam, ids));
      const when = exam.date ? [formatDateDE(exam.date), exam.time, exam.room].filter(Boolean).join(" · ") : t("date.tba");
      const text = el("div", "item__text");
      const title = [exam.module, exam.label, exam.done ? t("settings.doneSuffix") : ""].filter(Boolean).join(" · ");
      text.append(el("span", "item__title", title), el("span", "item__meta", when));
      li.append(dot, text, actions(examName(exam), () => openExam(exam), () => void deleteExam(exam)));
      return li;
    }),
  );
}

function renderResources(): void {
  const list = $("resource-list");
  if (!data.resources.length) {
    list.replaceChildren(el("li", "item item--empty", t("settings.noLinks")));
    return;
  }
  const sorted = [...data.resources].sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  list.replaceChildren(
    ...sorted.map((r) => {
      const li = el("li", "item");
      const text = el("div", "item__text");
      text.append(el("span", "item__title", r.title), el("span", "item__meta", [r.category, r.module, new URL(r.url).host].filter(Boolean).join(" · ")));
      li.append(text, actions(r.title, () => openResource(r), () => void deleteResource(r)));
      return li;
    }),
  );
}

/** Each module's checklist progress, with a link to its page and a way to clear it. */
function renderChecklists(): void {
  const ids = data.exams.map((e) => e.id);
  const modules = [...new Set([...data.exams.map((e) => e.module), ...Object.keys(data.checklists)])];
  $("checklist-list").replaceChildren(
    ...modules.map((module) => {
      const items = data.checklists[module] ?? [];
      const exam = data.exams.find((e) => e.module === module);
      const li = el("li", "item");
      const dot = el("span", "dot");
      if (exam) dot.style.setProperty("--dot", dotColor(exam, ids));
      const text = el("div", "item__text");
      const done = items.filter((i) => i.done).length;
      text.append(
        el("span", "item__title", module),
        el("span", "item__meta", items.length ? t("settings.checklistRow", { done, total: items.length }) : t("settings.checklistNone")),
      );
      const box = el("div", "item__actions");
      if (exam) {
        const open = el("a", "btn btn--quiet", t("settings.checklistOpen"));
        open.href = `../index.html#module=${encodeURIComponent(exam.id)}`;
        box.append(open);
      }
      if (items.length)
        box.append(
          button(t("settings.checklistClear"), "btn btn--quiet btn--danger", `${t("settings.checklistClear")} ${module}`, () => {
            if (!confirm(t("settings.checklistClearConfirm", { n: items.length, module }))) return;
            const checklists = { ...data.checklists };
            delete checklists[module];
            void persist("checklists", checklists, t("settings.checklistCleared", { module }));
          }),
        );
      li.append(dot, text, box);
      return li;
    }),
  );
}

const focusSettings = (): FocusSettings => ({ ...FOCUS_DEFAULTS, ...data.settings.focus });

function renderFocus(): void {
  renderTimerOptions($("timer-options"), focusSettings(), async (patch) => {
    if (!(await persist("settings", { ...data.settings, focus: { ...focusSettings(), ...patch } }, t("settings.timerSaved"))))
      throw $("toast").textContent ?? "";
  });
  const minutes = data.focusLog.reduce((sum, e) => sum + e.minutes, 0);
  $("log-text").textContent = t("settings.studyLogText", { entries: data.focusLog.length, time: formatMinutes(minutes) });
  ($("log-export") as HTMLButtonElement).disabled = ($("log-clear") as HTMLButtonElement).disabled = !data.focusLog.length;
}

function renderGeneral(): void {
  const lang = data.settings.language ?? "en";
  for (const radio of Array.from(document.querySelectorAll<HTMLInputElement>('input[name="language"]'))) radio.checked = radio.value === lang;
  const accent = $("accent") as HTMLInputElement;
  accent.value = data.settings.accent ?? getComputedStyle(document.documentElement).getPropertyValue("--color-accent-default").trim();
  applyAccent(data.settings.accent);
  $("storage-note").textContent = t(storageArea().kind === "sync" ? "settings.backupTextSync" : "settings.backupText");
}

function renderDisplay(): void {
  ($("show-seconds") as HTMLInputElement).checked = data.settings.showSeconds;
  const mode = data.settings.headline?.mode ?? "count";
  for (const radio of Array.from(document.querySelectorAll<HTMLInputElement>('input[name="headline"]'))) radio.checked = radio.value === mode;
  const custom = $("headline-custom") as HTMLInputElement;
  if (document.activeElement !== custom) custom.value = data.settings.headline?.custom ?? "";
  custom.disabled = mode !== "custom";
}

function renderAll(): void {
  setLang(data.settings.language);
  applyI18n();
  renderExams();
  renderDisplay();
  renderResources();
  renderChecklists();
  renderFocus();
  renderGeneral();
}

// ---- Saving ------------------------------------------------------------------------
async function persist<K extends keyof StoredData>(key: K, value: StoredData[K], message: string | (() => string)): Promise<boolean> {
  try {
    await save(key, value);
    data = { ...data, [key]: value };
    renderAll();
    toast(typeof message === "function" ? message() : message);
    return true;
  } catch (err) {
    toast(describeSaveError(err));
    return false;
  }
}

async function deleteExam(exam: Exam): Promise<void> {
  const name = examName(exam);
  if (!confirm(t("settings.deleteExamConfirm", { name }))) return;
  await persist("exams", data.exams.filter((e) => e.id !== exam.id), t("settings.deleted", { name }));
}

async function deleteResource(r: Resource): Promise<void> {
  if (!confirm(t("settings.deleteLinkConfirm", { name: r.title }))) return;
  await persist("resources", data.resources.filter((x) => x.id !== r.id), t("settings.deleted", { name: r.title }));
}

// ---- Exam form ---------------------------------------------------------------------
const examDialog = $("exam-dialog") as HTMLDialogElement;
const examForm = $("exam-form") as HTMLFormElement;
let editingExam: string | null = null;

function examToForm(e: Exam): FormInput {
  return {
    module: e.module, label: e.label, date: e.date ?? "", time: e.time, room: e.room, durationMin: e.durationMin?.toString(),
    registrationDeadline: e.registrationDeadline, retakeDate: e.retake?.date ?? "", retakeTime: e.retake?.time,
    retakeRoom: e.retake?.room, allowedAids: e.allowedAids?.join("\n"), description: e.description, notes: e.notes,
    done: e.done ? "on" : "", customColor: e.color ? "on" : "", colorPick: e.color,
  };
}

function openExam(exam?: Exam): void {
  showTab("countdown");
  editingExam = exam?.id ?? null;
  $("exam-form-title").textContent = exam ? t("form.editItem", { name: examName(exam) }) : t("form.addExam");
  fillForm(examForm, exam ? examToForm(exam) : {});
  examDialog.showModal();
}

examForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = readForm(examForm);
  input.color = input.customColor === "on" ? input.colorPick : "";
  const id = editingExam ?? crypto.randomUUID();
  const result = validateExam(input, id);
  if (!result.ok) return showErrors(examForm, result.errors);
  const exams = editingExam ? data.exams.map((e) => (e.id === id ? result.value : e)) : [...data.exams, result.value];
  if (await persist("exams", exams, t("settings.saved", { name: result.value.module }))) examDialog.close();
  else showErrors(examForm, { _form: $("toast").textContent ?? "" });
});

// ---- Resource form -------------------------------------------------------------------
const resourceDialog = $("resource-dialog") as HTMLDialogElement;
const resourceForm = $("resource-form") as HTMLFormElement;
let editingResource: string | null = null;

function openResource(r?: Resource, prefill: FormInput = {}): void {
  showTab("modules");
  editingResource = r?.id ?? null;
  $("resource-form-title").textContent = r ? t("form.editItem", { name: r.title }) : t("form.addLink");
  // Choices come from current data, so refresh them on every open.
  const categories = [...new Set([...DEFAULT_CATEGORIES, ...data.resources.map((x) => x.category)])];
  $("category-options").replaceChildren(...categories.map((c) => Object.assign(document.createElement("option"), { value: c })));
  const modules = [...new Set(data.exams.map((e) => e.module))];
  ($("r-module") as HTMLSelectElement).replaceChildren(
    Object.assign(document.createElement("option"), { value: "", textContent: t("form.none") }),
    ...modules.map((m) => Object.assign(document.createElement("option"), { value: m, textContent: m })),
  );
  fillForm(resourceForm, r ? { title: r.title, url: r.url, category: r.category, module: r.module ?? "" } : prefill);
  resourceDialog.showModal();
}

resourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = editingResource ?? crypto.randomUUID();
  const result = validateResource(readForm(resourceForm), id);
  if (!result.ok) return showErrors(resourceForm, result.errors);
  const resources = editingResource ? data.resources.map((r) => (r.id === id ? result.value : r)) : [...data.resources, result.value];
  if (await persist("resources", resources, t("settings.saved", { name: result.value.title }))) resourceDialog.close();
  else showErrors(resourceForm, { _form: $("toast").textContent ?? "" });
});

for (const dialog of [examDialog, resourceDialog]) {
  dialog.querySelector("[data-close]")!.addEventListener("click", () => dialog.close());
}

$("add-exam").addEventListener("click", () => openExam());
$("add-resource").addEventListener("click", () => openResource());

// ---- Countdown display ------------------------------------------------------------------
$("show-seconds").addEventListener("change", (e) => {
  const showSeconds = (e.target as HTMLInputElement).checked;
  void persist("settings", { ...data.settings, showSeconds }, t(showSeconds ? "settings.secondsOn" : "settings.secondsOff"));
});
type HeadlineMode = NonNullable<StoredData["settings"]["headline"]>["mode"];
function saveHeadline(mode: HeadlineMode): void {
  const custom = ($("headline-custom") as HTMLInputElement).value.trim();
  const headline = { mode, ...(custom ? { custom } : {}) };
  void persist("settings", { ...data.settings, headline }, t(`settings.headlineSaved.${mode}` as Key));
}
for (const radio of Array.from(document.querySelectorAll<HTMLInputElement>('input[name="headline"]'))) {
  radio.addEventListener("change", () => {
    saveHeadline(radio.value as HeadlineMode);
    if (radio.value === "custom") $("headline-custom").focus();
  });
}
$("headline-custom").addEventListener("change", () => saveHeadline("custom"));

// ---- Focus ------------------------------------------------------------------------------
$("log-export").addEventListener("click", () => {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([toCsv(data.focusLog)], { type: "text/csv" })),
    download: `study-log-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
});
$("log-clear").addEventListener("click", () => {
  if (confirm(t("settings.studyLogClearConfirm"))) void persist("focusLog", [], t("settings.studyLogCleared"));
});

// ---- General ----------------------------------------------------------------------------
for (const radio of Array.from(document.querySelectorAll<HTMLInputElement>('input[name="language"]')))
  radio.addEventListener("change", () => {
    const language = radio.value as Language;
    // The confirmation reads in the new language: render first, then say it.
    void persist("settings", { ...data.settings, language }, () => t("settings.languageSaved"));
  });

// `change` fires once the picker closes, so this doesn't write on every drag step.
$("accent").addEventListener("change", (e) => {
  void persist("settings", { ...data.settings, accent: (e.target as HTMLInputElement).value }, t("settings.accentSaved"));
});
$("accent-reset").addEventListener("click", () => {
  const { accent: _drop, ...rest } = data.settings;
  void persist("settings", rest, t("settings.accentWasReset"));
});

$("export").addEventListener("click", () => {
  const blob = new Blob([toBackup(data)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `exam-tab-backup-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
  toast(t("settings.backupDownloaded"));
});

$("import-file").addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ""; // allow picking the same file again
  if (!file) return;
  const parsed = parseBackup(await file.text());
  if (!parsed.ok) return toast(t("settings.importFailed", { error: parsed.error }));
  const { exams, resources } = parsed.value;
  if (!confirm(t("settings.importConfirm", { exams: exams.length, links: resources.length }))) return;
  try {
    await saveAll(parsed.value);
    data = parsed.value;
    renderAll();
    toast(t("settings.imported"));
  } catch (err) {
    toast(describeSaveError(err));
  }
});

// ---- Esc goes back to the countdown (an open form closes first) ----
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open]")) return;
  // In a text field, the first Esc just leaves the field (which saves it); the next one goes back.
  const active = document.activeElement;
  if (active instanceof HTMLInputElement && ["text", "number"].includes(active.type)) return active.blur();
  location.href = "../index.html";
});

// ---- Live updates & deep links ------------------------------------------------------------
onDataChanged((fresh) => {
  data = fresh;
  renderAll();
});

renderAll();

// The site links here as #exam=<id> to edit one exam, #add-exam, #add-resource[&module=…&category=…&title=…]
// to add a prefilled link, or #<tab> to open a tab.
function followHash(): void {
  const hash = new URLSearchParams(location.hash.slice(1));
  const target = data.exams.find((e) => e.id === hash.get("exam"));
  const tab = TABS.find((name) => location.hash === `#${name}`);
  if (target) openExam(target);
  else if (location.hash === "#add-exam") openExam();
  else if (hash.has("add-resource"))
    openResource(undefined, { module: hash.get("module") ?? "", category: hash.get("category") ?? "", title: hash.get("title") ?? "" });
  else showTab(tab ?? "countdown");
}
window.addEventListener("hashchange", followHash);
followHash();
