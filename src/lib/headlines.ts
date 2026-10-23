import type { Summary } from "./countdown";
import { getLang, t, tn } from "./i18n";
import type { Settings } from "./types";

export type HeadlineMode = "count" | "custom" | "motivation" | "quotes" | "personal";
/** `de`: the German version, shown when the interface is German. */
export type Quote = { text: string; author: string; source: string; de: { text: string; source: string } };

/**
 * Checked quotes only: each has a traceable source (many famous "quotes" are
 * misattributed, so popular-but-unsourced ones are deliberately left out).
 */
export const QUOTES: Quote[] = [
  { text: "Wir müssen wissen. Wir werden wissen.", author: "David Hilbert", source: "Königsberg, 1930 — also his epitaph", de: { text: "Wir müssen wissen. Wir werden wissen.", source: "Königsberg, 1930 – auch seine Grabinschrift" } },
  { text: "In der Beschränkung zeigt sich erst der Meister.", author: "Johann Wolfgang von Goethe", source: "„Natur und Kunst“", de: { text: "In der Beschränkung zeigt sich erst der Meister.", source: "„Natur und Kunst“" } },
  {
    text: "What I cannot create, I do not understand.",
    author: "Richard Feynman",
    source: "on his blackboard, 1988",
    de: { text: "Was ich nicht erschaffen kann, verstehe ich nicht.", source: "an seiner Tafel, 1988" },
  },
  { text: "Die Mathematik ist die Königin der Wissenschaften.", author: "Carl Friedrich Gauß", source: "after Sartorius von Waltershausen, 1856", de: { text: "Die Mathematik ist die Königin der Wissenschaften.", source: "nach Sartorius von Waltershausen, 1856" } },
  {
    text: "Genius is one per cent inspiration and ninety-nine per cent perspiration.",
    author: "Thomas A. Edison",
    source: "c. 1901",
    de: { text: "Genie ist ein Prozent Inspiration und neunundneunzig Prozent Transpiration.", source: "um 1901" },
  },
  {
    text: "It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult.",
    author: "Seneca",
    source: "Letters to Lucilius 104",
    de: { text: "Nicht weil es schwer ist, wagen wir es nicht, sondern weil wir es nicht wagen, ist es schwer.", source: "Briefe an Lucilius 104" },
  },
  {
    text: "The price of reliability is the pursuit of the utmost simplicity.",
    author: "C. A. R. Hoare",
    source: "Turing Award lecture, 1980",
    de: { text: "Der Preis der Zuverlässigkeit ist das Streben nach größtmöglicher Einfachheit.", source: "Turing-Award-Vortrag, 1980" },
  },
  {
    text: "Programs must be written for people to read, and only incidentally for machines to execute.",
    author: "Harold Abelson & Gerald Jay Sussman",
    source: "SICP, 1985",
    de: { text: "Programme müssen für Menschen zum Lesen geschrieben werden und nur nebenbei für Maschinen zum Ausführen.", source: "SICP, 1985" },
  },
  {
    text: "I have no special talents. I am only passionately curious.",
    author: "Albert Einstein",
    source: "letter to Carl Seelig, 1952",
    de: { text: "Ich habe keine besondere Begabung, sondern bin nur leidenschaftlich neugierig.", source: "Brief an Carl Seelig, 1952" },
  },
  {
    text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Will Durant",
    source: "The Story of Philosophy, 1926",
    de: { text: "Wir sind, was wir wiederholt tun. Vortrefflichkeit ist daher keine Handlung, sondern eine Gewohnheit.", source: "The Story of Philosophy, 1926" },
  },
  {
    text: "The best way to predict the future is to invent it.",
    author: "Alan Kay",
    source: "1971",
    de: { text: "Die beste Art, die Zukunft vorherzusagen, ist, sie zu erfinden.", source: "1971" },
  },
  {
    text: "Es ist nicht genug, zu wissen, man muß auch anwenden; es ist nicht genug, zu wollen, man muß auch tun.",
    author: "Johann Wolfgang von Goethe",
    source: "Wilhelm Meisters Wanderjahre",
    de: {
      text: "Es ist nicht genug, zu wissen, man muß auch anwenden; es ist nicht genug, zu wollen, man muß auch tun.",
      source: "Wilhelm Meisters Wanderjahre",
    },
  },
];

type Context = { module?: string; days?: number; ahead: number };
type Message = (c: Context) => string | null;

/** Short nudges; some mention the next exam when there is one. Same list in both languages. */
export const MOTIVATION: Record<"en" | "de", Message[]> = {
  en: [
    () => "One problem set at a time.",
    () => "Understand it once, use it forever.",
    () => "Small steps every day beat cramming.",
    () => "Future you will thank you for this hour.",
    () => "Explain it out loud — then you know it.",
    () => "Start the formula sheet now. It grows with you.",
    () => "Old exams are the best teachers.",
    () => "Rest is part of the plan.",
    () => "Ask in the tutorial. Someone else is wondering too.",
    () => "Done beats perfect. Next exercise.",
    (c) => (c.module && c.days !== undefined && c.days > 1 ? `${c.module} in ${c.days} days. Today counts.` : null),
    (c) => (c.module && c.days !== undefined && c.days > 7 ? `${c.days} days to ${c.module} — plenty, if you start today.` : null),
    (c) => (c.ahead > 1 ? `${c.ahead} exams. One at a time.` : null),
  ],
  de: [
    () => "Ein Übungsblatt nach dem anderen.",
    () => "Einmal verstanden, für immer gelernt.",
    () => "Jeden Tag ein kleiner Schritt schlägt jedes Bulimielernen.",
    () => "Dein zukünftiges Ich dankt dir für diese Stunde.",
    () => "Erklär es laut – dann kannst du es.",
    () => "Fang jetzt mit dem Formelblatt an. Es wächst mit dir.",
    () => "Altklausuren sind die besten Lehrer.",
    () => "Pausen gehören zum Plan.",
    () => "Frag in der Übung. Jemand anderes fragt sich das auch.",
    () => "Fertig schlägt perfekt. Nächste Aufgabe.",
    (c) => (c.module && c.days !== undefined && c.days > 1 ? `${c.module} in ${c.days} Tagen. Heute zählt.` : null),
    (c) => (c.module && c.days !== undefined && c.days > 7 ? `Noch ${c.days} Tage bis ${c.module} – reichlich, wenn du heute anfängst.` : null),
    (c) => (c.ahead > 1 ? `${c.ahead} Prüfungen. Eine nach der anderen.` : null),
  ],
};

export type Headline = { title: string; byline?: string; mode: HeadlineMode };

export function countText(ahead: number): string {
  return ahead === 0 ? t("count.allDone") : tn("count", ahead);
}

/**
 * The headline for this visit. `pick` (0 ≤ pick < 1) chooses among messages or
 * quotes; pass one random number per page load so it doesn't change every tick.
 */
export function chooseHeadline(settings: Settings, summary: Summary, pick: number, personal?: { lines: string[]; index: number }): Headline {
  const ahead = summary.upcoming.length + summary.tba.length;
  const mode = settings.headline?.mode ?? "count";
  // Personal: the page cycles through lines made for you (lib/personal.ts).
  if (mode === "personal" && personal?.lines.length) return { mode, title: personal.lines[personal.index % personal.lines.length]! };
  if (mode === "custom" && settings.headline?.custom?.trim()) return { mode, title: settings.headline.custom.trim() };
  if (mode === "quotes") {
    const q = QUOTES[Math.floor(pick * QUOTES.length)]!;
    const { text, source } = getLang() === "de" ? q.de : q;
    return { mode, title: text, byline: `— ${q.author}, ${source}` };
  }
  if (mode === "motivation") {
    const next = summary.upcoming[0];
    const ctx: Context = { module: next?.exam.module, days: next?.days, ahead };
    const options = MOTIVATION[getLang()].map((m) => m(ctx)).filter((m): m is string => m !== null);
    return { mode, title: options[Math.floor(pick * options.length)]! };
  }
  return { mode: "count", title: countText(ahead) };
}
