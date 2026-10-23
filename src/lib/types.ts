/** `date` is a calendar date "YYYY-MM-DD" in Europe/Berlin; null = TBA. */
export type Exam = {
  id: string;
  module: string;
  /** Tells several exams of one module apart, e.g. "Midterm" or "GOP". */
  label?: string;
  date: string | null;
  /** "HH:MM", 24 h, Europe/Berlin. */
  time?: string;
  room?: string;
  color?: string;
  done?: boolean;
  /** What the exam covers, format, anything worth knowing. */
  description?: string;
  durationMin?: number;
  /** Retake (Wiederholungsklausur); date null = TBA. */
  retake?: { date: string | null; time?: string; room?: string };
  /** Last day to register in TUMonline, "YYYY-MM-DD". */
  registrationDeadline?: string;
  /** What you're allowed / need to bring. */
  allowedAids?: string[];
  notes?: string;
};

export type Resource = {
  id: string;
  title: string;
  url: string;
  module?: string;
  category: string;
};

export type Language = "en" | "de";

export type Settings = {
  showSeconds: boolean;
  /** Interface language; exam data stays as entered. */
  language?: Language;
  /** Background picture picked in Settings (a hero name); unset = automatic by season and holiday. */
  hero?: string;
  /** Your first name, for greetings and personal messages. */
  name?: string;
  accent?: string;
  /** What the big headline says: exam count (default), own text, motivation or quotes. */
  headline?: { mode: "count" | "custom" | "motivation" | "quotes" | "personal"; custom?: string };
  /** Pomodoro lengths in minutes, rounds before the long break, chime on/off. */
  focus?: { focusMin: number; shortMin: number; longMin: number; rounds: number; sound: boolean };
};

/** Minutes studied on one Munich date for one module (null = no module); one entry per day and module. */
export type FocusEntry = { day: string; module: string | null; minutes: number };

/** One topic of a module's contents, ticked off when learned. */
export type ChecklistItem = { id: string; text: string; done: boolean };

export type StoredData = {
  exams: Exam[];
  resources: Resource[];
  settings: Settings;
  focusLog: FocusEntry[];
  /** Module name → its contents checklist. */
  checklists: Record<string, ChecklistItem[]>;
};
