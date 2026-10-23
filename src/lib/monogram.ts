/** Two-letter icon text for a link, so cards need no favicon (and no network). */
export function monogram(title: string): string {
  const words = title.trim().split(/[\s\-–_/.]+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  const w = words[0] ?? "?";
  return w.length === 1 ? w.toUpperCase() : w[0]!.toUpperCase() + w[1]!.toLowerCase();
}

/** Stable colour slot (1..count) for a host, so the same site always gets the same tint. */
export function colorSlot(key: string, count: number): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % count) + 1;
}
