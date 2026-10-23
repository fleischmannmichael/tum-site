import { beforeEach, describe, expect, it } from "vitest";
import { SEED } from "./seed";
import { startData } from "./start";
import { isFirstVisit, loadAll, saveAll } from "./storage";
import { resetStorageArea } from "./storage-area";

describe("startData", () => {
  const mine = {
    ...SEED,
    settings: { showSeconds: false, name: "Alex", language: "de" as const },
    focusLog: [{ day: "2026-10-20", module: "Physik", minutes: 40 }],
    checklists: { Physik: [{ id: "a", text: "Optik", done: true }] },
  };

  it("blank: no exams, links or checklists; keeps settings and study log", () => {
    const blank = startData("blank", mine);
    expect(blank).toEqual({ ...mine, exams: [], resources: [], checklists: {} });
  });

  it("example: the TUM semester, as a copy", () => {
    const example = startData("example", mine);
    expect(example.exams).toEqual(SEED.exams);
    expect(example.exams).not.toBe(SEED.exams);
    expect(example.settings.name).toBe("Alex");
    expect(example.checklists).toEqual({});
  });
});

describe("first visit", () => {
  beforeEach(() => {
    resetStorageArea();
    const store: Record<string, unknown> = {};
    const sync = {
      async get(keys: string | string[] | null) {
        if (keys === null) return structuredClone(store);
        const list = typeof keys === "string" ? [keys] : keys;
        return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, structuredClone(store[k])]));
      },
      async set(items: Record<string, unknown>) {
        Object.assign(store, structuredClone(items));
      },
      async remove(keys: string[]) {
        for (const k of keys) delete store[k];
      },
    };
    (globalThis as unknown as { chrome: unknown }).chrome = { storage: { sync } };
  });

  it("is first until something is saved; a blank start stays blank after reload", async () => {
    expect(await isFirstVisit()).toBe(true);
    await saveAll(startData("blank"));
    expect(await isFirstVisit()).toBe(false);
    const data = await loadAll();
    expect([data.exams, data.resources]).toEqual([[], []]);
  });
});
