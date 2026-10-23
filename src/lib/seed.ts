import type { StoredData } from "./types";

// WS 2026/27 modules; dates are TBA until TUMonline publishes them.
export const SEED: StoredData = {
  exams: [
    { id: "analysis-1", module: "Analysis 1", date: null },
    { id: "linear-algebra", module: "Linear Algebra", date: null },
    { id: "schaltungstheorie", module: "Schaltungstheorie", date: null },
    { id: "schaltungstheorie-2", module: "Schaltungstheorie 2", date: null }, // second exam; rename once the official title is known
    { id: "digitaltechnik", module: "Digitaltechnik", date: null },
    { id: "computertechnik", module: "Computertechnik", date: null },
  ],
  // General portals. Verified Oct 2026: TUMonline via tum.de, Artemis and
  // TUM-Live via their projects' READMEs; Moodle couldn't be checked from here.
  resources: [
    { id: "tumonline", title: "TUMonline", url: "https://campus.tum.de/", category: "Portals" },
    { id: "moodle", title: "Moodle", url: "https://www.moodle.tum.de/", category: "Portals" },
    { id: "artemis", title: "Artemis", url: "https://artemis.tum.de/", category: "Portals" },
    { id: "tum-live", title: "TUM-Live", url: "https://live.rbg.tum.de/", category: "Portals" },
  ],
  settings: { showSeconds: true },
};
