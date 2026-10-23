/**
 * Where data lives: Chrome's sync storage when running as the extension,
 * the browser's localStorage when running as the website. Both look the same
 * to storage.ts.
 */
export type StorageArea = {
  kind: "sync" | "local";
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
  /** Calls back when another tab/page changes the data. */
  onChanged(callback: () => void): () => void;
};

type Chromeish = { storage?: { sync?: chrome.storage.SyncStorageArea; onChanged?: typeof chrome.storage.onChanged } };

function chromeArea(): StorageArea | null {
  const c = (globalThis as { chrome?: Chromeish }).chrome;
  const sync = c?.storage?.sync;
  if (!sync) return null;
  return {
    kind: "sync",
    get: (keys) => sync.get(keys),
    set: (items) => sync.set(items),
    remove: (keys) => sync.remove(keys),
    onChanged(callback) {
      const handler = (_changes: unknown, area: string) => area === "sync" && callback();
      c.storage!.onChanged!.addListener(handler);
      return () => c.storage!.onChanged!.removeListener(handler);
    },
  };
}

const PREFIX = "exam-tab:"; // keeps our keys apart from anything else on the same origin

/** localStorage with the same async shape; values are stored as JSON. */
export function localArea(storage: Storage = globalThis.localStorage, events: EventTarget | undefined = globalThis.window): StorageArea {
  const ours = () => {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length));
    }
    return keys;
  };
  return {
    kind: "local",
    async get(keys) {
      const list = keys === null ? ours() : typeof keys === "string" ? [keys] : keys;
      const out: Record<string, unknown> = {};
      for (const k of list) {
        const raw = storage.getItem(PREFIX + k);
        if (raw !== null) out[k] = JSON.parse(raw);
      }
      return out;
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) storage.setItem(PREFIX + k, JSON.stringify(v));
    },
    async remove(keys) {
      for (const k of keys) storage.removeItem(PREFIX + k);
    },
    onChanged(callback) {
      // The "storage" event fires in every *other* tab of the site.
      const handler = (e: Event) => {
        const key = (e as StorageEvent).key;
        if (key === null || key.startsWith(PREFIX)) callback();
      };
      events?.addEventListener("storage", handler);
      return () => events?.removeEventListener("storage", handler);
    },
  };
}

let cached: StorageArea | undefined;
/** Resolved on first use, so tests can install a fake `chrome` first. */
export function storageArea(): StorageArea {
  return (cached ??= chromeArea() ?? localArea());
}

/** Tests only: forget the resolved area. */
export function resetStorageArea(): void {
  cached = undefined;
}
