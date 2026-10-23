import { describe, expect, it } from "vitest";
import { summarize, zonedToInstant } from "./countdown";
import { chooseHeadline, MOTIVATION, QUOTES } from "./headlines";
import { SEED } from "./seed";

const now = zonedToInstant({ y: 2026, m: 10, d: 24, h: 12 });
const summary = summarize(SEED.exams, now);
const settings = (headline?: object) => ({ showSeconds: true, ...(headline ? { headline } : {}) }) as never;

describe("chooseHeadline", () => {
  it("defaults to the exam count", () => {
    expect(chooseHeadline(settings(), summary, 0.5)).toEqual({ mode: "count", title: "6 exams ahead" });
  });

  it("uses the custom message, or the count when it's empty", () => {
    expect(chooseHeadline(settings({ mode: "custom", custom: "  Du schaffst das  " }), summary, 0).title).toBe("Du schaffst das");
    expect(chooseHeadline(settings({ mode: "custom", custom: " " }), summary, 0).title).toBe("6 exams ahead");
  });

  it("picks a quote with its source", () => {
    const h = chooseHeadline(settings({ mode: "quotes" }), summary, 0);
    expect(h).toEqual({ mode: "quotes", title: QUOTES[0]!.text, byline: `— ${QUOTES[0]!.author}, ${QUOTES[0]!.source}` });
    expect(chooseHeadline(settings({ mode: "quotes" }), summary, 0.9999).title).toBe(QUOTES.at(-1)!.text);
  });

  it("fills motivational templates with the next exam", () => {
    const titles = Array.from({ length: MOTIVATION.length }, (_, i) => chooseHeadline(settings({ mode: "motivation" }), summary, i / MOTIVATION.length).title);
    expect(titles.some((t) => /^Analysis 1 in 114 days\. Today counts\.$/.test(t))).toBe(true);
    expect(titles).toContain("6 exams. One at a time.");
    expect(titles.every((t) => t && !t.includes("undefined"))).toBe(true);
  });

  it("every quote has an author and a source", () => {
    expect(QUOTES.every((q) => q.text && q.author && q.source)).toBe(true);
  });
});
