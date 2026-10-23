import { dotColor } from "../components/exam-grid";
import { formatDateDE } from "../lib/format";
import { describeSaveError, loadAll, onDataChanged, save, saveAll } from "../lib/storage";
import type { Exam, Resource, StoredData } from "../lib/types";
import { parseBackup, toBackup, validateExam, validateResource, type FormInput } from "../lib/validate";
import { applyAccent } from "../lib/accent";
import { fillForm, readForm, showErrors } from "./form";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const DEFAULT_CATEGORIES = ["Portals", "Lecture notes", "Exercises", "Past exams"];

let data: StoredData = await loadAll();

// ---- Feedback --------------------------------------------------------------------
let toastTimer: number | undefined;
function toast(message: string): void {
  const t = $("toast");
  t.textContent = message;
  t.classList.add("toast--visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove("toast--visible"), 3000);
}

// ---- Lists -----------------------------------------------------------------------
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text) n.textContent = text;
  return n;
}

function actions(label: string, onEdit: () => void, onDelete: () => void): HTMLDivElement {
  const box = el("div", "item__actions");
  const edit = el("button", "btn btn--quiet", "Edit");
  const del = el("button", "btn btn--quiet btn--danger", "Delete");
  edit.type = del.type = "button";
  edit.setAttribute("aria-label", `Edit ${label}`);
  del.setAttribute("aria-label", `Delete ${label}`);
  edit.addEventListener("click", onEdit);
  del.addEventListener("click", onDelete);
  box.append(edit, del);
  return box;
}

const byDate = (a: Exam, b: Exam) =>
  (a.date ?? "9999") .localeCompare(b.date ?? "9999") || (a.time ?? "").localeCompare(b.time ?? "") || a.module.localeCompare(b.module);

function renderExams(): void {
  const ids = data.exams.map((e) => e.id);
  const list = $("exam-list");
  if (!data.exams.length) {
    list.replaceChildren(el("li", "item item--empty", "No exams yet."));
    return;
  }
  list.replaceChildren(
    ...[...data.exams].sort(byDate).map((exam) => {
      const li = el("li", "item");
      const dot = el("span", "dot");
      dot.style.setProperty("--dot", dotColor(exam, ids));
      const when = exam.date ? [formatDateDE(exam.date), exam.time, exam.room].filter(Boolean).join(" · ") : "Date TBA";
      const text = el("div", "item__text");
      text.append(el("span", "item__title", exam.module + (exam.done ? " · done" : "")), el("span", "item__meta", when));
      li.append(dot, text, actions(exam.module, () => openExam(exam), () => void deleteExam(exam)));
      return li;
    }),
  );
}

function renderResources(): void {
  const list = $("resource-list");
  if (!data.resources.length) {
    list.replaceChildren(el("li", "item item--empty", "No links yet."));
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

function renderDisplay(): void {
  ($("show-seconds") as HTMLInputElement).checked = data.settings.showSeconds;
  const accent = $("accent") as HTMLInputElement;
  accent.value = data.settings.accent ?? getComputedStyle(document.documentElement).getPropertyValue("--color-accent-default").trim();
  applyAccent(data.settings.accent);
}

function renderAll(): void {
  renderExams();
  renderResources();
  renderDisplay();
}

// ---- Saving ------------------------------------------------------------------------
async function persist<K extends keyof StoredData>(key: K, value: StoredData[K], message: string): Promise<boolean> {
  try {
    await save(key, value);
    data = { ...data, [key]: value };
    renderAll();
    toast(message);
    return true;
  } catch (err) {
    toast(describeSaveError(err));
    return false;
  }
}

async function deleteExam(exam: Exam): Promise<void> {
  if (!confirm(`Delete “${exam.module}”? This can't be undone (unless you have a backup).`)) return;
  await persist("exams", data.exams.filter((e) => e.id !== exam.id), `Deleted ${exam.module}.`);
}

async function deleteResource(r: Resource): Promise<void> {
  if (!confirm(`Delete the link “${r.title}”?`)) return;
  await persist("resources", data.resources.filter((x) => x.id !== r.id), `Deleted ${r.title}.`);
}

// ---- Exam form ---------------------------------------------------------------------
const examDialog = $("exam-dialog") as HTMLDialogElement;
const examForm = $("exam-form") as HTMLFormElement;
let editingExam: string | null = null;

function examToForm(e: Exam): FormInput {
  return {
    module: e.module, date: e.date ?? "", time: e.time, room: e.room, durationMin: e.durationMin?.toString(),
    registrationDeadline: e.registrationDeadline, retakeDate: e.retake?.date ?? "", retakeTime: e.retake?.time,
    retakeRoom: e.retake?.room, allowedAids: e.allowedAids?.join("\n"), description: e.description, notes: e.notes,
    done: e.done ? "on" : "", customColor: e.color ? "on" : "", colorPick: e.color,
  };
}

function openExam(exam?: Exam): void {
  editingExam = exam?.id ?? null;
  $("exam-form-title").textContent = exam ? `Edit ${exam.module}` : "Add exam";
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
  if (await persist("exams", exams, `Saved ${result.value.module}.`)) examDialog.close();
  else showErrors(examForm, { _form: $("toast").textContent ?? "" });
});

// ---- Resource form -------------------------------------------------------------------
const resourceDialog = $("resource-dialog") as HTMLDialogElement;
const resourceForm = $("resource-form") as HTMLFormElement;
let editingResource: string | null = null;

function openResource(r?: Resource): void {
  editingResource = r?.id ?? null;
  $("resource-form-title").textContent = r ? `Edit ${r.title}` : "Add link";
  // Choices come from current data, so refresh them on every open.
  const categories = [...new Set([...DEFAULT_CATEGORIES, ...data.resources.map((x) => x.category)])];
  $("category-options").replaceChildren(...categories.map((c) => Object.assign(document.createElement("option"), { value: c })));
  const modules = [...new Set(data.exams.map((e) => e.module))];
  ($("r-module") as HTMLSelectElement).replaceChildren(
    Object.assign(document.createElement("option"), { value: "", textContent: "None" }),
    ...modules.map((m) => Object.assign(document.createElement("option"), { value: m, textContent: m })),
  );
  fillForm(resourceForm, r ? { title: r.title, url: r.url, category: r.category, module: r.module ?? "" } : {});
  resourceDialog.showModal();
}

resourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = editingResource ?? crypto.randomUUID();
  const result = validateResource(readForm(resourceForm), id);
  if (!result.ok) return showErrors(resourceForm, result.errors);
  const resources = editingResource ? data.resources.map((r) => (r.id === id ? result.value : r)) : [...data.resources, result.value];
  if (await persist("resources", resources, `Saved ${result.value.title}.`)) resourceDialog.close();
  else showErrors(resourceForm, { _form: $("toast").textContent ?? "" });
});

for (const dialog of [examDialog, resourceDialog]) {
  dialog.querySelector("[data-close]")!.addEventListener("click", () => dialog.close());
}

$("add-exam").addEventListener("click", () => openExam());
$("add-resource").addEventListener("click", () => openResource());

// ---- Display -------------------------------------------------------------------------
$("show-seconds").addEventListener("change", (e) => {
  const showSeconds = (e.target as HTMLInputElement).checked;
  void persist("settings", { ...data.settings, showSeconds }, showSeconds ? "Seconds on." : "Seconds off.");
});
// `change` fires once the picker closes, so this doesn't write on every drag step.
$("accent").addEventListener("change", (e) => {
  void persist("settings", { ...data.settings, accent: (e.target as HTMLInputElement).value }, "Accent colour saved.");
});
$("accent-reset").addEventListener("click", () => {
  const { accent: _drop, ...rest } = data.settings;
  void persist("settings", rest, "Accent colour reset.");
});

// ---- Backup ---------------------------------------------------------------------------
$("export").addEventListener("click", () => {
  const blob = new Blob([toBackup(data)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `exam-tab-backup-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Backup downloaded.");
});

$("import-file").addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ""; // allow picking the same file again
  if (!file) return;
  const parsed = parseBackup(await file.text());
  if (!parsed.ok) return toast(`Import failed: ${parsed.error}`);
  const { exams, resources } = parsed.value;
  if (!confirm(`Replace everything with this backup (${exams.length} exams, ${resources.length} links)?`)) return;
  try {
    await saveAll(parsed.value);
    data = parsed.value;
    renderAll();
    toast("Backup imported.");
  } catch (err) {
    toast(describeSaveError(err));
  }
});

// ---- Live updates & deep links ------------------------------------------------------------
onDataChanged((fresh) => {
  data = fresh;
  renderAll();
});

renderAll();

// The new tab links here as #exam=<id> to edit one exam, or #add-exam.
const hash = new URLSearchParams(location.hash.slice(1));
const target = data.exams.find((e) => e.id === hash.get("exam"));
if (target) openExam(target);
else if (location.hash === "#add-exam") openExam();
