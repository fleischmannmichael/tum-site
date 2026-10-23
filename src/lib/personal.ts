import { TIMEZONE, zonedParts, type Summary } from "./countdown";
import { formatMinutes, minutesSince, streak } from "./focus";
import type { ChecklistItem, FocusEntry, Language } from "./types";

/*
 * Personal messages for the countdown headline (mode "personal"): a greeting
 * for the time of day, and lines that react to what's going on — the next
 * exam, today's studying, the streak, the module checklist, the weekday, the
 * hour. Most relevant first; the page cycles through them. With a name set,
 * they're addressed to you ("…, Michael").
 */

export type PersonalInput = {
  name?: string;
  lang: Language;
  now: number;
  summary: Summary;
  focusLog: FocusEntry[];
  checklists: Record<string, ChecklistItem[]>;
  tz?: string;
};

type Ctx = {
  /** ", Michael" or "" — appended where a name reads naturally. */
  n: string;
  name?: string;
  hour: number;
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
  exam?: { module: string; days: number; today: boolean };
  ahead: number;
  todayMin: number;
  streak: number;
  topics?: { module: string; done: number; total: number };
};

type Line = (c: Ctx) => string | null;

const time = (min: number) => formatMinutes(min);

/** Lines per language, in order of relevance. */
const LINES: Record<Language, Line[]> = {
  en: [
    (c) => (c.exam?.today ? `Today's the day${c.n}. You've got ${c.exam.module}.` : null),
    (c) => (c.exam && !c.exam.today && c.exam.days === 1 ? `${c.exam.module} is tomorrow${c.n}. Pack your things, sleep early.` : null),
    (c) => (c.hour >= 23 || c.hour < 5 ? `It's late${c.n}. Sleep is part of studying too.` : null),
    (c) => (c.exam && c.exam.days >= 2 && c.exam.days <= 7 ? `${c.exam.days} days to ${c.exam.module}${c.n}. Old exams, out loud, one by one.` : null),
    (c) => (c.exam && c.exam.days > 7 && c.exam.days <= 30 ? `${c.exam.module} in ${c.exam.days} days${c.n}. Perfect time for the first past paper.` : null),
    (c) => (c.exam && c.exam.days > 30 ? `${c.exam.days} days until ${c.exam.module}${c.n}. Plenty of time — if today counts.` : null),
    (c) => (c.todayMin >= 120 ? `${time(c.todayMin)} today${c.n}. That's a proper study day.` : null),
    (c) => (c.todayMin > 0 && c.todayMin < 120 ? `${time(c.todayMin)} logged today${c.n}. Nice start.` : null),
    (c) => (c.todayMin === 0 && c.hour >= 15 && c.hour < 22 ? `Nothing logged yet today${c.n}. One 25-minute round?` : null),
    (c) => (c.streak >= 2 ? `${c.streak} days in a row${c.n}. Don't break the chain.` : null),
    (c) =>
      c.topics && c.topics.total > 0
        ? c.topics.done === c.topics.total
          ? `Every topic of ${c.topics.module} ticked off${c.n}. Now explain it to someone.`
          : `${c.topics.done} of ${c.topics.total} topics in ${c.topics.module} done${c.n}. Which one is next?`
        : null,
    (c) => (c.weekday === 0 ? `New week${c.n}. What's the one thing you'll finish?` : null),
    (c) => (c.weekday === 4 ? `Friday${c.n}. Close one topic, then enjoy the weekend.` : null),
    (c) => (c.weekday >= 5 ? `Weekend${c.n}. One focused hour makes Monday lighter.` : null),
    (c) => (c.hour >= 5 && c.hour < 9 ? `Early start${c.n}. Fresh head, hard topic first.` : null),
    (c) => (c.ahead === 0 ? `All exams done${c.n}. Enjoy it — you earned it.` : null),
    (c) => (c.ahead > 1 ? `${c.ahead} exams ahead${c.n}. One at a time.` : null),
    (c) => `You've got this${c.n}.`,
  ],
  de: [
    (c) => (c.exam?.today ? `Heute ist der Tag${c.n}. ${c.exam.module} – du packst das.` : null),
    (c) => (c.exam && !c.exam.today && c.exam.days === 1 ? `Morgen ist ${c.exam.module}${c.n}. Sachen packen, früh schlafen.` : null),
    (c) => (c.hour >= 23 || c.hour < 5 ? `Es ist spät${c.n}. Schlaf gehört auch zum Lernen.` : null),
    (c) => (c.exam && c.exam.days >= 2 && c.exam.days <= 7 ? `Noch ${c.exam.days} Tage bis ${c.exam.module}${c.n}. Altklausuren, laut, eine nach der anderen.` : null),
    (c) => (c.exam && c.exam.days > 7 && c.exam.days <= 30 ? `${c.exam.module} in ${c.exam.days} Tagen${c.n}. Genau die richtige Zeit für die erste Altklausur.` : null),
    (c) => (c.exam && c.exam.days > 30 ? `Noch ${c.exam.days} Tage bis ${c.exam.module}${c.n}. Reichlich Zeit – wenn heute zählt.` : null),
    (c) => (c.todayMin >= 120 ? `${time(c.todayMin)} heute${c.n}. Das ist ein richtiger Lerntag.` : null),
    (c) => (c.todayMin > 0 && c.todayMin < 120 ? `${time(c.todayMin)} heute eingetragen${c.n}. Guter Anfang.` : null),
    (c) => (c.todayMin === 0 && c.hour >= 15 && c.hour < 22 ? `Heute noch nichts eingetragen${c.n}. Eine Runde mit 25 Minuten?` : null),
    (c) => (c.streak >= 2 ? `${c.streak} Tage am Stück${c.n}. Bleib dran.` : null),
    (c) =>
      c.topics && c.topics.total > 0
        ? c.topics.done === c.topics.total
          ? `Alle Themen von ${c.topics.module} abgehakt${c.n}. Jetzt erklär es jemandem.`
          : `${c.topics.done} von ${c.topics.total} Themen in ${c.topics.module} erledigt${c.n}. Was kommt als Nächstes?`
        : null,
    (c) => (c.weekday === 0 ? `Neue Woche${c.n}. Was ist das eine, das du fertig machst?` : null),
    (c) => (c.weekday === 4 ? `Freitag${c.n}. Ein Thema abschließen, dann ab ins Wochenende.` : null),
    (c) => (c.weekday >= 5 ? `Wochenende${c.n}. Eine konzentrierte Stunde macht den Montag leichter.` : null),
    (c) => (c.hour >= 5 && c.hour < 9 ? `Früh dran${c.n}. Frischer Kopf, schweres Thema zuerst.` : null),
    (c) => (c.ahead === 0 ? `Alle Prüfungen geschafft${c.n}. Genieß es – du hast es dir verdient.` : null),
    (c) => (c.ahead > 1 ? `Noch ${c.ahead} Prüfungen${c.n}. Eine nach der anderen.` : null),
    (c) => `Du schaffst das${c.n}.`,
  ],
};

const GREETINGS: Record<Language, [fromHour: number, text: string][]> = {
  // Checked in order; the first whose hour has started wins (from late to early).
  en: [[22, "Still up"], [18, "Good evening"], [14, "Good afternoon"], [11, "Hi"], [5, "Good morning"], [0, "Still up"]],
  de: [[22, "Noch wach"], [18, "Guten Abend"], [14, "Hallo"], [11, "Mahlzeit"], [5, "Guten Morgen"], [0, "Noch wach"]],
};

function context(input: PersonalInput): Ctx {
  const tz = input.tz ?? TIMEZONE;
  const { y, m, d, h } = zonedParts(input.now, tz);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  const name = input.name?.trim() || undefined;
  const { state, upcoming, tba } = input.summary;
  const next = state.kind === "none" ? undefined : state.next;
  const items = next ? input.checklists[next.exam.module] : undefined;
  return {
    n: name ? `, ${name}` : "",
    name,
    hour: h,
    weekday: (dayNumber + 3) % 7, // 1970-01-01 was a Thursday
    // Whole days like the tiles show them ("114 days"), but "tomorrow" by the calendar.
    exam: next
      ? { module: next.exam.module, days: state.kind === "countdown" && next.days > 1 ? Math.max(2, state.remaining.days) : next.days, today: state.kind === "today" }
      : undefined,
    ahead: upcoming.length + tba.length,
    todayMin: minutesSince(input.focusLog, input.now, 1, tz),
    streak: streak(input.focusLog, input.now, tz),
    topics: next && items?.length ? { module: next.exam.module, done: items.filter((i) => i.done).length, total: items.length } : undefined,
  };
}

/** "Good evening, Michael" — or just "Good evening" without a name. */
export function greeting(input: Pick<PersonalInput, "name" | "lang" | "now" | "tz">): string {
  const hour = zonedParts(input.now, input.tz ?? TIMEZONE).h;
  const text = GREETINGS[input.lang].find(([from]) => hour >= from)![1];
  const name = input.name?.trim();
  return name ? `${text}, ${name}` : text;
}

/** Every line that fits right now, most relevant first (never empty). */
export function personalLines(input: PersonalInput): string[] {
  const ctx = context(input);
  return LINES[input.lang].map((line) => line(ctx)).filter((s): s is string => s !== null);
}
