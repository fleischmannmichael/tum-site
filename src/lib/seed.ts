import type { Exam, StoredData } from "./types";

// WS 2026/27, from the course pages (rules kept in their original German).
export const SEED: StoredData = {
  exams: [
    {
      id: "analysis-1",
      module: "Analysis 1",
      date: "2027-02-15",
      time: "08:00",
      durationMin: 90,
      retake: { date: "2027-04-02", time: "08:00" },
      allowedAids: ["Ein beidseitig selbst handbeschriebenes DIN-A4-Blatt im Original (keine Kopien, keine Ausdrucke!)"],
      notes: "Einziges zugelassenes Hilfsmittel.",
    },
    {
      id: "linear-algebra",
      module: "Linear Algebra",
      date: "2027-02-23",
      time: "08:00",
      durationMin: 90,
      retake: { date: "2027-04-07", time: "11:00" },
      allowedAids: ["Ein beidseitig handbeschriebenes DIN-A4-Blatt mit eigenen Notizen (keine iPad-Ausdrucke o. Ä.)"],
      notes: "Andere Unterlagen oder Geräte wie Taschenrechner, Smartphones etc. sind nicht zugelassen.",
    },
    {
      id: "schaltungstheorie",
      module: "Schaltungstheorie",
      label: "GOP",
      date: "2027-02-18",
      time: "11:00",
      durationMin: 90,
      room: "Hörsaalaufteilung einen Tag vorher per E-Mail",
      retake: { date: "2027-04-05", time: "14:00" },
      allowedAids: [
        "Formelsammlung: 5 beidseitig (oder 10 einseitig) beschriebene DIN-A4-Blätter",
        "Darf gedruckt, gescannt, handgeschrieben, annotiert und beklebt sein",
      ],
      notes:
        "Keine elektronischen Geräte. Max. 10 Seiten mit Inhalt – auch Notizen, die während der Prüfung auf leeren Rückseiten entstehen, zählen mit. Unerlaubte Hilfsmittel oder zu viele Seiten werden als Täuschungsversuch gemeldet.",
    },
    {
      id: "schaltungstheorie-midterm",
      module: "Schaltungstheorie",
      label: "Midterm",
      date: "2026-12-04",
      time: "13:15",
      room: "Audimax",
      durationMin: 90,
      registrationDeadline: "2026-11-30",
      allowedAids: ["Alle Vorlesungs- und Übungsunterlagen", "Handschriftliche Notizen"],
      description:
        "Semestrale: Probeklausur mit Stoff bis einschließlich Kapitel 4. Freiwillig – kein Einfluss auf die Note, kein offizieller Leistungsnachweis. Zum Prüfen des eigenen Wissensstands und um den Prüfungsablauf kennenzulernen.",
      notes:
        "Anmeldung 16.11.2026 – 30.11.2026, 23:59 über CampusTUM (Lehrveranstaltung „Schaltungstheorie Semestrale“). Hilfsmittel hier anders als in der echten Prüfung. Nach dem Termin: Angabe und Musterlösung im Moodle-Kurs.",
    },
    {
      id: "digitaltechnik",
      module: "Digitaltechnik",
      date: "2027-02-25",
      time: "14:00",
      durationMin: 60,
      retake: { date: "2027-03-30", time: "11:00" },
      allowedAids: [
        "Nicht-programmierbarer Taschenrechner",
        "Formelsammlung (handgeschrieben oder gedruckt): max. 2 Blätter DIN A4 beidseitig",
        "Wörterbuch Deutsch ↔ andere Sprache",
      ],
      notes:
        "Formelsammlung: 4 einseitig beschriebene Blätter sind nicht zulässig. Grafiken, Beschreibungen, Definitionen, Gleichungen, Rechenformeln etc. sind erlaubt.",
    },
    {
      id: "computertechnik",
      module: "Computertechnik",
      date: null,
      durationMin: 90,
      room: "Eikon-Rechnerräume",
      description: "Moodle-Prüfung „Computertechnik und Programmieren“; enthält Inhalte von Computertechnik und Programmieren.",
      notes: "Notenbonus 0,3, wenn mindestens 80 % jedes Hausaufgaben-Arbeitsblatts (Programmier-Tutorien) richtig bearbeitet wurden.",
    },
  ],
  // General portals. Verified Oct 2026: TUMonline via tum.de, Artemis and
  // TUM-Live via their projects' READMEs; Moodle couldn't be checked from here.
  resources: [
    { id: "tumonline", title: "TUMonline", url: "https://campus.tum.de/", category: "Portals" },
    { id: "moodle", title: "Moodle", url: "https://www.moodle.tum.de/", category: "Portals" },
    { id: "artemis", title: "Artemis", url: "https://artemis.tum.de/", category: "Portals" },
    { id: "tum-live", title: "TUM-Live", url: "https://live.rbg.tum.de/", category: "Portals" },
    {
      id: "schaltungstheorie-semestrale-anmeldung",
      title: "Semestrale-Anmeldung (CampusTUM)",
      url: "https://campus.tum.de/tumonline/ee/ui/ca2/app/desktop/#/slc.tm.cp/student/courses/950943935",
      module: "Schaltungstheorie",
      category: "Anmeldung",
    },
  ],
  settings: { showSeconds: true },
  focusLog: [],
  checklists: {},
};

/** Exam ids of the first, date-less seed (before the real dates were known). */
const FIRST_SEED_IDS = ["analysis-1", "linear-algebra", "schaltungstheorie", "digitaltechnik", "computertechnik", "schaltungstheorie-2"];
/** Removed later: the Schaltungstheorie midterm belongs to the one module. */
const RETIRED_SEED_IDS = ["schaltungstheorie-2"];

/**
 * Earlier versions of example entries. A stored entry that still equals one
 * of them exactly (never edited) is brought up to date; edited ones stay.
 */
const PREVIOUS: Exam[] = [
  { id: "schaltungstheorie-midterm", module: "Schaltungstheorie", label: "Midterm", date: null, notes: "Etwa im Dezember; genauer Termin folgt." },
];
/** Example links that arrived together with an updated entry (added once, with it). */
const LINKS_WITH: Record<string, string[]> = { "schaltungstheorie-midterm": ["schaltungstheorie-semestrale-anmeldung"] };

/** JSON with sorted keys, so stored objects compare equal regardless of key order. */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const isPrevious = (e: Exam) => PREVIOUS.some((p) => p.id === e.id && canonical(p) === canonical(e));

/**
 * Updates never-edited example entries to their current version, and adds
 * the example links that came with that update (unless already there).
 */
export function upgradeExample(data: Pick<StoredData, "exams" | "resources">): Pick<StoredData, "exams" | "resources"> {
  const updated = data.exams.filter(isPrevious).map((e) => e.id);
  if (!updated.length) return data;
  const exams = data.exams.map((e) => (isPrevious(e) ? structuredClone(SEED.exams.find((s) => s.id === e.id) ?? e) : e));
  const have = new Set(data.resources.map((r) => r.id));
  const links = updated.flatMap((id) => LINKS_WITH[id] ?? []).filter((id) => !have.has(id));
  const resources = [...data.resources, ...structuredClone(SEED.resources.filter((r) => links.includes(r.id)))];
  return { exams, resources };
}

/** Still exactly as first seeded: just id, module and no date. */
const untouched = (e: Exam) => e.date === null && Object.keys(e).length === 3;

/**
 * Brings stored exams up to the current seed without losing anything the
 * user entered: a list that is still entirely the first date-less seed is
 * replaced by the current seed; otherwise only untouched first-seed entries
 * are filled in (or dropped, if retired) and everything else stays as is.
 */
export function upgradeSeed(exams: Exam[]): Exam[] {
  if (exams.length && exams.every((e) => FIRST_SEED_IDS.includes(e.id) && untouched(e))) return structuredClone(SEED.exams);
  return exams
    .filter((e) => !(RETIRED_SEED_IDS.includes(e.id) && untouched(e)))
    .map((e) => (FIRST_SEED_IDS.includes(e.id) && untouched(e) ? structuredClone(SEED.exams.find((s) => s.id === e.id) ?? e) : e));
}
