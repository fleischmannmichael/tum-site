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

export type Settings = {
  showSeconds: boolean;
  accent?: string;
  /** What the big headline says: exam count (default), own text, motivation or quotes. */
  headline?: { mode: "count" | "custom" | "motivation" | "quotes"; custom?: string };
  /** Pomodoro lengths in minutes, rounds before the long break, chime on/off. */
  focus?: { focusMin: number; shortMin: number; longMin: number; rounds: number; sound: boolean };
};

/** One finished focus session; `day` is the Munich date it ended on. */
export type FocusEntry = { day: string; module: string | null; minutes: number };

export type StoredData = {
  exams: Exam[];
  resources: Resource[];
  settings: Settings;
  focusLog: FocusEntry[];
};
