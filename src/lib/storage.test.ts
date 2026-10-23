import { beforeEach, describe, expect, it } from "vitest";
import { SEED } from "./seed";
import { loadAll, save } from "./storage";
import { localArea, resetStorageArea } from "./storage-area";
import type { Exam } from "./types";

// Minimal in-memory chrome.storage.sync that enforces the 8 KB per-item quota.
let store: Record<string, unknown>;
beforeEach(() => {
  resetStorageArea();
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

/** In-memory stand-in for window.localStorage. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

describe("website storage (localStorage)", () => {
  it("is used when there is no chrome.storage", async () => {
    delete (globalThis as { chrome?: unknown }).chrome;
    const ls = new MemoryStorage();
    (globalThis as { localStorage?: Storage }).localStorage = ls;
    resetStorageArea();
    await save("settings", { showSeconds: false, accent: "#ff8800" });
    expect(ls.getItem("exam-tab:settings")).toBe('{"chunks":1}');
    expect((await loadAll()).settings).toEqual({ showSeconds: false, accent: "#ff8800" });
    expect((await loadAll()).exams).toEqual(SEED.exams);
  });

  it("round-trips large values and only touches its own keys", async () => {
    const ls = new MemoryStorage();
    ls.setItem("other-app", "keep me");
    const area = localArea(ls, new EventTarget());
    await area.set({ a: { x: 1 }, "a#0": "text" });
    expect(await area.get(null)).toEqual({ a: { x: 1 }, "a#0": "text" });
    await area.remove(["a#0"]);
    expect(await area.get(["a", "a#0"])).toEqual({ a: { x: 1 } });
    expect(ls.getItem("other-app")).toBe("keep me");
  });

  it("reports changes made in other tabs (storage events) for its keys only", () => {
    const events = new EventTarget();
    const area = localArea(new MemoryStorage(), events);
    let calls = 0;
    const off = area.onChanged(() => calls++);
    const fire = (key: string | null) => events.dispatchEvent(Object.assign(new Event("storage"), { key }));
    fire("exam-tab:exams");
    fire("someone-else");
    fire(null); // localStorage.clear() in another tab
    off();
    fire("exam-tab:exams");
    expect(calls).toBe(2);
  });
});
