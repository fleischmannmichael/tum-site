import { dropRetiredSeed, SEED } from "./seed";
import type { StoredData } from "./types";

type Key = keyof StoredData;
const KEYS: Key[] = ["exams", "resources", "settings"];

/*
 * chrome.storage.sync allows only 8 KB per item, which a few exams with long
 * notes can exceed. Each value is therefore stored as JSON split across
 * chunk items ("exams#0", "exams#1", …) plus a small header item ("exams").
 * A header that is a plain value (the pre-M4 format) is still read as-is.
 */
const CHUNK_CHARS = 2000; // worst case ~3 bytes/char + escaping stays under 8 KB
type Header = { chunks: number };

const chunkKey = (key: string, i: number) => `${key}#${i}`;
const isHeader = (v: unknown): v is Header =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 1 && "chunks" in v;

function decode(all: Record<string, unknown>, key: Key): unknown {
  const head = all[key];
  if (!isHeader(head)) return head; // undefined, or the old single-item format
  let json = "";
  for (let i = 0; i < head.chunks; i++) json += String(all[chunkKey(key, i)] ?? "");
  try {
    return JSON.parse(json);
  } catch {
    return undefined; // half-written or corrupt; fall back to the seed
  }
}

/** Reads everything; keys never written yet fall back to the seed. */
export async function loadAll(): Promise<StoredData> {
  const all = await chrome.storage.sync.get(null);
  return {
    exams: dropRetiredSeed((decode(all, "exams") as StoredData["exams"] | undefined) ?? SEED.exams),
    resources: (decode(all, "resources") as StoredData["resources"] | undefined) ?? SEED.resources,
    settings: { ...SEED.settings, ...(decode(all, "settings") as Partial<StoredData["settings"]> | undefined) },
  };
}

export async function save<K extends Key>(key: K, value: StoredData[K]): Promise<void> {
  const json = JSON.stringify(value);
  const items: Record<string, unknown> = {};
  const count = Math.max(1, Math.ceil(json.length / CHUNK_CHARS));
  for (let i = 0; i < count; i++) items[chunkKey(key, i)] = json.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS);
  items[key] = { chunks: count } satisfies Header;

  const before = (await chrome.storage.sync.get(key))[key];
  // One set() writes chunks and header together, so readers never see a mix.
  await chrome.storage.sync.set(items);
  if (isHeader(before) && before.chunks > count) {
    const stale = Array.from({ length: before.chunks - count }, (_, i) => chunkKey(key, count + i));
    await chrome.storage.sync.remove(stale);
  }
}

export async function saveAll(data: StoredData): Promise<void> {
  for (const key of KEYS) await save(key, data[key] as never);
}

/** Calls `listener` with fresh data whenever any page/worker changes sync storage. */
export function onDataChanged(listener: (data: StoredData) => void): () => void {
  const handler = (_changes: unknown, area: string) => {
    if (area === "sync") void loadAll().then(listener);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

/** Turns chrome's quota errors into a sentence a person can act on. */
export function describeSaveError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/QUOTA_BYTES/i.test(msg)) return "Sync storage is full (Chrome allows about 100 KB). Shorten some notes or delete old exams.";
  if (/MAX_WRITE_OPERATIONS/i.test(msg)) return "Too many saves in a short time. Wait a minute and try again.";
  return `Couldn't save: ${msg}`;
}
