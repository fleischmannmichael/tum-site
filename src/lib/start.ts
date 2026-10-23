import { SEED } from "./seed";
import type { StoredData } from "./types";

/*
 * How the site starts: blank (create everything yourself) or with the example
 * — the TUM Electrical Engineering first semester, WS 2026/27. Picked on the
 * first visit (home/welcome.ts) and again any time in Settings → General.
 */

export type StartKind = "blank" | "example";

/**
 * Fresh exams, links and checklists of the chosen kind. Everything personal —
 * settings (language, name, picture…) and the study log — carries over.
 */
export function startData(kind: StartKind, current: StoredData = SEED): StoredData {
  return {
    ...current,
    settings: { ...current.settings },
    exams: kind === "example" ? structuredClone(SEED.exams) : [],
    resources: kind === "example" ? structuredClone(SEED.resources) : [],
    checklists: {},
  };
}
