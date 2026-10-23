import { checkLength, MAX_DAY_MINUTES } from "./focus";
import { t, type Key } from "./i18n";
import type { ChecklistItem, Exam, FocusEntry, Resource, Settings, StoredData } from "./types";

/** Raw form values: everything is a string (checkboxes "on"/""), as read from FormData. */
export type FormInput = Record<string, string | undefined>;
export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export const LIMITS = {
  module: 60,
  label: 30,
  room: 80,
  text: 2000, // description, notes
  aid: 120,
  aids: 20,
  title: 80,
  category: 40,
  url: 500,
  durationMin: 600,
  headline: 80,
  name: 40,
  checkItem: 200,
  checkItems: 300, // per module
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const COLOR = /^#[0-9a-f]{6}$/i;

export function isValidDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

const clean = (v: string | undefined) => (v ?? "").trim();

/** Builds an Exam from form input. Empty optional fields are left out entirely. */
export function validateExam(input: FormInput, id: string): Result<Exam> {
  const errors: Record<string, string> = {};
  const get = (k: string) => clean(input[k]);
  const tooLong = (k: string, max: number, label: Key) => {
    if (get(k).length > max) errors[k] = t("err.tooLong", { label: t(label), max });
  };
  const date = (k: string) => {
    if (get(k) && !isValidDate(get(k))) errors[k] = t("err.realDate");
  };
  const time = (k: string) => {
    if (get(k) && !TIME.test(get(k))) errors[k] = t("err.time24");
  };

  if (!get("module")) errors.module = t("err.moduleName");
  tooLong("module", LIMITS.module, "err.label.module");
  tooLong("label", LIMITS.label, "err.label.label");
  date("date");
  time("time");
  if (get("time") && !get("date")) errors.time = t("err.timeNeedsDate");
  tooLong("room", LIMITS.room, "err.label.room");
  if (get("color") && !COLOR.test(get("color"))) errors.color = t("err.color");
  const duration = get("durationMin");
  if (duration && !(/^\d+$/.test(duration) && +duration >= 1 && +duration <= LIMITS.durationMin))
    errors.durationMin = t("err.duration", { max: LIMITS.durationMin });
  date("registrationDeadline");
  date("retakeDate");
  time("retakeTime");
  tooLong("retakeRoom", LIMITS.room, "err.label.retakeRoom");
  tooLong("description", LIMITS.text, "err.label.about");
  tooLong("notes", LIMITS.text, "err.label.notes");

  const aids = get("allowedAids")
    .split("\n")
    .map((a) => a.trim())
    .filter(Boolean);
  if (aids.length > LIMITS.aids) errors.allowedAids = t("err.aidsCount", { max: LIMITS.aids });
  else if (aids.some((a) => a.length > LIMITS.aid)) errors.allowedAids = t("err.aidLength", { max: LIMITS.aid });

  if (Object.keys(errors).length) return { ok: false, errors };

  const exam: Exam = { id, module: get("module"), date: get("date") || null };
  const opt = <K extends keyof Exam>(k: K, v: Exam[K] | "" | undefined) => {
    if (v !== "" && v !== undefined) exam[k] = v;
  };
  opt("time", get("time"));
  opt("label", get("label"));
  opt("room", get("room"));
  opt("color", get("color").toLowerCase());
  if (input.done === "on") exam.done = true;
  opt("description", get("description"));
  opt("durationMin", duration ? Number(duration) : undefined);
  if (get("retakeDate") || get("retakeTime") || get("retakeRoom")) {
    exam.retake = { date: get("retakeDate") || null };
    if (get("retakeTime")) exam.retake.time = get("retakeTime");
    if (get("retakeRoom")) exam.retake.room = get("retakeRoom");
  }
  opt("registrationDeadline", get("registrationDeadline"));
  if (aids.length) exam.allowedAids = aids;
  opt("notes", get("notes"));
  return { ok: true, value: exam };
}

export function validateResource(input: FormInput, id: string): Result<Resource> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);
  const url = clean(input.url);
  const category = clean(input.category);
  const module = clean(input.module);

  if (!title) errors.title = t("err.linkTitle");
  else if (title.length > LIMITS.title) errors.title = t("err.tooLong", { label: t("err.label.title"), max: LIMITS.title });

  let parsed: URL | undefined;
  try {
    parsed = new URL(url);
  } catch {
    // handled below
  }
  if (!url) errors.url = t("err.url");
  else if (!parsed || !/^https?:$/.test(parsed.protocol)) errors.url = t("err.urlFull");
  else if (url.length > LIMITS.url) errors.url = t("err.tooLong", { label: t("err.label.address"), max: LIMITS.url });

  if (!category) errors.category = t("err.category");
  else if (category.length > LIMITS.category) errors.category = t("err.tooLong", { label: t("err.label.category"), max: LIMITS.category });

  if (Object.keys(errors).length) return { ok: false, errors };
  const resource: Resource = { id, title, url: parsed!.href, category };
  if (module) resource.module = module;
  return { ok: true, value: resource };
}

// ---- Backup files -----------------------------------------------------------------

export const BACKUP_FORMAT = "exam-tab-backup";
export const BACKUP_VERSION = 1;

export function toBackup(data: StoredData): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, ...data }, null, 2);
}

/** Exam/resource objects → the string form the validators take, so imports get the same checks as the forms. */
function examToInput(e: Record<string, unknown>): FormInput {
  const retake = (e.retake ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
  return {
    module: str(e.module), label: str(e.label), date: str(e.date), time: str(e.time), room: str(e.room), color: str(e.color),
    done: e.done === true ? "on" : "", description: str(e.description), durationMin: str(e.durationMin),
    retakeDate: str(retake.date), retakeTime: str(retake.time), retakeRoom: str(retake.room),
    registrationDeadline: str(e.registrationDeadline),
    allowedAids: Array.isArray(e.allowedAids) ? e.allowedAids.map(str).join("\n") : "", notes: str(e.notes),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const firstError = (errors: Record<string, string>) => Object.values(errors)[0];

/** Parses and fully validates a backup file. Errors name the item so the person can fix the file. */
export function parseBackup(text: string): { ok: true; value: StoredData } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: t("backup.notJson") };
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) return { ok: false, error: t("backup.notBackup") };
  if (typeof raw.version !== "number" || raw.version > BACKUP_VERSION)
    return { ok: false, error: t("backup.newer") };
  if (!Array.isArray(raw.exams) || !Array.isArray(raw.resources)) return { ok: false, error: t("backup.missing") };

  const exams: Exam[] = [];
  const ids = new Set<string>();
  const idFor = (v: unknown) => {
    const id = typeof v === "string" && v && !ids.has(v) ? v : crypto.randomUUID();
    ids.add(id);
    return id;
  };
  for (const [i, e] of raw.exams.entries()) {
    if (!isObj(e)) return { ok: false, error: t("backup.badExam", { n: i + 1 }) };
    const r = validateExam(examToInput(e), idFor(e.id));
    if (!r.ok) return { ok: false, error: t("backup.examError", { n: i + 1, name: String(e.module ?? "?"), error: firstError(r.errors) ?? "" }) };
    exams.push(r.value);
  }
  const resources: Resource[] = [];
  for (const [i, r] of raw.resources.entries()) {
    if (!isObj(r)) return { ok: false, error: t("backup.badLink", { n: i + 1 }) };
    const res = validateResource({ title: String(r.title ?? ""), url: String(r.url ?? ""), category: String(r.category ?? ""), module: String(r.module ?? "") }, idFor(r.id));
    if (!res.ok) return { ok: false, error: t("backup.linkError", { n: i + 1, name: String(r.title ?? "?"), error: firstError(res.errors) ?? "" }) };
    resources.push(res.value);
  }
  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: Settings = { showSeconds: s.showSeconds === true };
  if (typeof s.accent === "string" && COLOR.test(s.accent)) settings.accent = s.accent.toLowerCase();
  const h = isObj(s.headline) ? s.headline : undefined;
  if (h && ["count", "custom", "motivation", "quotes", "personal"].includes(h.mode as string)) {
    settings.headline = { mode: h.mode as NonNullable<Settings["headline"]>["mode"] };
    if (typeof h.custom === "string" && h.custom.trim()) settings.headline.custom = h.custom.trim().slice(0, LIMITS.headline);
  }
  if (s.language === "en" || s.language === "de") settings.language = s.language;
  if (typeof s.hero === "string" && s.hero.trim()) settings.hero = s.hero.trim().slice(0, 80);
  if (typeof s.name === "string" && s.name.trim()) settings.name = s.name.trim().slice(0, LIMITS.name);
  const f = isObj(s.focus) ? s.focus : undefined;
  if (f) {
    const [focusMin, shortMin, longMin, rounds] = (["focusMin", "shortMin", "longMin", "rounds"] as const).map((k) => checkLength(k, f[k]));
    if (focusMin && shortMin && longMin && rounds) settings.focus = { focusMin, shortMin, longMin, rounds, sound: f.sound !== false };
  }

  // The study log and checklists are optional (older backups don't have them); invalid entries are skipped.
  const mins = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_DAY_MINUTES;
  const focusLog = (Array.isArray(raw.focusLog) ? raw.focusLog : []).filter(
    (e): e is FocusEntry =>
      isObj(e) && typeof e.day === "string" && isValidDate(e.day) && (e.module === null || typeof e.module === "string") && mins(e.minutes),
  );
  const checklists: Record<string, ChecklistItem[]> = {};
  if (isObj(raw.checklists))
    for (const [module, items] of Object.entries(raw.checklists)) {
      if (!Array.isArray(items)) continue;
      const valid = items
        .filter((i): i is Record<string, unknown> => isObj(i) && typeof i.text === "string" && i.text.trim() !== "")
        .slice(0, LIMITS.checkItems)
        .map((i) => ({ id: idFor(i.id), text: (i.text as string).trim().slice(0, LIMITS.checkItem), done: i.done === true }));
      if (valid.length) checklists[module.slice(0, LIMITS.module)] = valid;
    }
  return { ok: true, value: { exams, resources, settings, focusLog, checklists } };
}
