const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-23" → "23.10.2026" */
export function formatDateDE(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

export function formatDays(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** Remaining time as "111d 23:00:00" (or without seconds). */
export function formatDuration(
  d: { days: number; hours: number; minutes: number; seconds: number },
  showSeconds: boolean,
): string {
  const clock = `${pad(d.hours)}:${pad(d.minutes)}` + (showSeconds ? `:${pad(d.seconds)}` : "");
  return d.days > 0 ? `${d.days}d ${clock}` : clock;
}
