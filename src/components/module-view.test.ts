import { describe, expect, it } from "vitest";
import { LIMIT_ITEMS, newItems } from "./module-view";

describe("newItems", () => {
  it("turns pasted lists into topics", () => {
    const items = newItems("- Folgen\n\n2. Reihen\n* [x] Grenzwerte\n- [ ] Stetigkeit\n  Ableitung  ", 0);
    expect(items.map(({ text, done }) => [text, done])).toEqual([
      ["Folgen", false],
      ["Reihen", false],
      ["Grenzwerte", true],
      ["Stetigkeit", false],
      ["Ableitung", false],
    ]);
    expect(new Set(items.map((i) => i.id)).size).toBe(5);
  });

  it("keeps the list within its limit", () => {
    expect(newItems("a\nb\nc", LIMIT_ITEMS - 2)).toHaveLength(2);
    expect(newItems("x".repeat(500), 0)[0]!.text).toHaveLength(200);
  });
});
