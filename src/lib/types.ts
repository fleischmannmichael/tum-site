/** `date` is a calendar date "YYYY-MM-DD" in Europe/Berlin; null = TBA. */
export type Exam = {
  id: string;
  module: string;
  date: string | null;
  /** "HH:MM", 24 h, Europe/Berlin. */
  time?: string;
  room?: string;
  color?: string;
  done?: boolean;
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
};

export type StoredData = {
  exams: Exam[];
  resources: Resource[];
  settings: Settings;
};
