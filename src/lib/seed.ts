import type { StoredData } from "./types";

// WS 2026/27 modules; dates are TBA until TUMonline publishes them.
export const SEED: StoredData = {
  exams: [
    { id: "analysis-1", module: "Analysis 1", date: null },
    { id: "linear-algebra", module: "Linear Algebra", date: null },
    { id: "schaltungstheorie", module: "Schaltungstheorie", date: null },
    { id: "digitaltechnik", module: "Digitaltechnik", date: null },
    { id: "computertechnik", module: "Computertechnik", date: null },
  ],
  resources: [],
  settings: { showSeconds: true },
};
