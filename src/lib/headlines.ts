import type { Summary } from "./countdown";
import type { Settings } from "./types";

export type HeadlineMode = "count" | "custom" | "motivation" | "quotes";
export type Quote = { text: string; author: string; source: string };

/**
 * Checked quotes only: each has a traceable source (many famous "quotes" are
 * misattributed, so popular-but-unsourced ones are deliberately left out).
 */
export const QUOTES: Quote[] = [
  { text: "Wir müssen wissen. Wir werden wissen.", author: "David Hilbert", source: "Königsberg, 1930 — also his epitaph" },
  { text: "In der Beschränkung zeigt sich erst der Meister.", author: "Johann Wolfgang von Goethe", source: "„Natur und Kunst“" },
  { text: "What I cannot create, I do not understand.", author: "Richard Feynman", source: "on his blackboard, 1988" },
  { text: "Die Mathematik ist die Königin der Wissenschaften.", author: "Carl Friedrich Gauß", source: "after Sartorius von Waltershausen, 1856" },
  { text: "Genius is one per cent inspiration and ninety-nine per cent perspiration.", author: "Thomas A. Edison", source: "c. 1901" },
  {
    text: "It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult.",
    author: "Seneca",
    source: "Letters to Lucilius 104",
  },
  { text: "The price of reliability is the pursuit of the utmost simplicity.", author: "C. A. R. Hoare", source: "Turing Award lecture, 1980" },
  {
    text: "Programs must be written for people to read, and only incidentally for machines to execute.",
    author: "Harold Abelson & Gerald Jay Sussman",
    source: "SICP, 1985",
  },
  { text: "I have no special talents. I am only passionately curious.", author: "Albert Einstein", source: "letter to Carl Seelig, 1952" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Will Durant", source: "The Story of Philosophy, 1926" },
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay", source: "1971" },
  {
    text: "Es ist nicht genug, zu wissen, man muß auch anwenden; es ist nicht genug, zu wollen, man muß auch tun.",
    author: "Johann Wolfgang von Goethe",
    source: "Wilhelm Meisters Wanderjahre",
  },
];

type Context = { module?: string; days?: number; ahead: number };

/** Short nudges; some mention the next exam when there is one. */
export const MOTIVATION: ((c: Context) => string | null)[] = [
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
];

export type Headline = { title: string; byline?: string; mode: HeadlineMode };

export function countText(ahead: number): string {
  return ahead === 0 ? "All exams done" : `${ahead} ${ahead === 1 ? "exam" : "exams"} ahead`;
}

/**
 * The headline for this visit. `pick` (0 ≤ pick < 1) chooses among messages or
 * quotes; pass one random number per page load so it doesn't change every tick.
 */
export function chooseHeadline(settings: Settings, summary: Summary, pick: number): Headline {
  const ahead = summary.upcoming.length + summary.tba.length;
  const mode = settings.headline?.mode ?? "count";
  if (mode === "custom" && settings.headline?.custom?.trim()) return { mode, title: settings.headline.custom.trim() };
  if (mode === "quotes") {
    const q = QUOTES[Math.floor(pick * QUOTES.length)]!;
    return { mode, title: q.text, byline: `— ${q.author}, ${q.source}` };
  }
  if (mode === "motivation") {
    const next = summary.upcoming[0];
    const ctx: Context = { module: next?.exam.module, days: next?.days, ahead };
    const options = MOTIVATION.map((m) => m(ctx)).filter((m): m is string => m !== null);
    return { mode, title: options[Math.floor(pick * options.length)]! };
  }
  return { mode: "count", title: countText(ahead) };
}
