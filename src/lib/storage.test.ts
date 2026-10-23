import { beforeEach, describe, expect, it } from "vitest";
import { SEED } from "./seed";
import { loadAll, save } from "./storage";
import type { Exam } from "./types";

// Minimal in-memory chrome.storage.sync that enforces the 8 KB per-item quota.
let store: Record<string, unknown>;
beforeEach(() => {
  store = {};
  const sync = {
    async get(keys: string | string[] | null) {
      if (keys === null) return structuredClone(store);
      const list = typeof keys === "string" ? [keys] : keys;
      return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, structuredClone(store[k])]));
    },
    async set(items: Record<string, unknown>) {
      for (const [k, v] of Object.entries(items))
        if (new TextEncoder().encode(k + JSON.stringify(v)).length > 8192) throw new Error("QUOTA_BYTES_PER_ITEM quota exceeded");
      Object.assign(store, structuredClone(items));
    },
    async remove(keys: string[]) {
      for (const k of keys) delete store[k];
    },
  };
  (globalThis as unknown as { chrome: unknown }).chrome = { storage: { sync } };
});

const bigExam = (i: number): Exam => ({ id: `e${i}`, module: `Modül ${i}`, date: null, notes: "Ä\"".repeat(1000), description: "x".repeat(2000) });

describe("storage", () => {
  it("falls back to the seed when empty", async () => {
    expect(await loadAll()).toEqual(SEED);
  });

  it("stores values larger than one sync item", async () => {
    const exams = [1, 2, 3, 4, 5].map(bigExam);
    await save("exams", exams);
    expect((await loadAll()).exams).toEqual(exams);
    expect(Object.keys(store).filter((k) => k.startsWith("exams#")).length).toBeGreaterThan(1);
  });

  it("removes chunks that are no longer needed", async () => {
    await save("exams", [1, 2, 3, 4, 5].map(bigExam));
    await save("exams", [SEED.exams[0]!]);
    expect(Object.keys(store).filter((k) => k.startsWith("exams#"))).toEqual(["exams#0"]);
    expect((await loadAll()).exams).toEqual([SEED.exams[0]]);
  });

  it("still reads the pre-M4 single-item format", async () => {
    store.exams = [{ id: "a", module: "Old", date: "2027-02-12" }];
    store.settings = { showSeconds: true };
    const data = await loadAll();
    expect(data.exams[0]!.module).toBe("Old");
    expect(data.settings.showSeconds).toBe(true);
  });

  it("replaces a never-edited first seed with the current one", async () => {
    store.exams = ["analysis-1", "linear-algebra", "schaltungstheorie", "digitaltechnik", "computertechnik", "schaltungstheorie-2"].map(
      (id) => ({ id, module: id, date: null }),
    );
    expect((await loadAll()).exams).toEqual(SEED.exams);
  });

  it("keeps edits; fills in only untouched seed entries and drops the retired one", async () => {
    store.exams = [
      { id: "analysis-1", module: "Analysis 1", date: "2027-02-16", room: "MW 2001" }, // edited by the user
      { id: "digitaltechnik", module: "Digitaltechnik", date: null }, // untouched
      { id: "schaltungstheorie-2", module: "Schaltungstheorie 2", date: null }, // retired, untouched
      { id: "mine", module: "Programmieren", date: null }, // the user's own
    ];
    const exams = (await loadAll()).exams;
    expect(exams.map((e) => e.id)).toEqual(["analysis-1", "digitaltechnik", "mine"]);
    expect(exams[0]).toEqual(store.exams && { id: "analysis-1", module: "Analysis 1", date: "2027-02-16", room: "MW 2001" });
    expect(exams[1]!.date).toBe("2027-02-25");
  });

  it("keeps an edited retired entry", async () => {
    store.exams = [{ id: "schaltungstheorie-2", module: "Schaltungstheorie Midterm", date: "2026-12-01" }];
    expect((await loadAll()).exams.map((e) => e.id)).toEqual(["schaltungstheorie-2"]);
  });
});
