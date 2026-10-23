import { SEED } from "./seed";
import type { StoredData } from "./types";

type Key = keyof StoredData;
const KEYS: Key[] = ["exams", "resources", "settings"];

/** Reads everything; keys never written yet fall back to the seed. */
export async function loadAll(): Promise<StoredData> {
  const raw = (await chrome.storage.sync.get(KEYS)) as Partial<StoredData>;
  return {
    exams: raw.exams ?? SEED.exams,
    resources: raw.resources ?? SEED.resources,
    settings: { ...SEED.settings, ...raw.settings },
  };
}

export async function save<K extends Key>(key: K, value: StoredData[K]): Promise<void> {
  await chrome.storage.sync.set({ [key]: value });
}

/** Calls `listener` with fresh data whenever another page/worker changes sync storage. */
export function onDataChanged(listener: (data: StoredData) => void): () => void {
  const handler = (_changes: unknown, area: string) => {
    if (area === "sync") void loadAll().then(listener);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
