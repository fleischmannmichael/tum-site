/**
 * A soft tower-bell chime, synthesised (no sound files, no network): a few
 * inharmonic partials with a slow exponential decay, like a struck bell.
 * Browsers only allow sound after a user gesture, so call unlock() from the
 * Start button; the chime at the end of a phase then plays fine.
 */
let ctx: AudioContext | undefined;

export function unlockAudio(): void {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
}

// Bell partials relative to the strike note (hum, prime, tierce, quint, nominal).
const PARTIALS: [ratio: number, gain: number, decay: number][] = [
  [0.5, 0.35, 3.5],
  [1, 0.6, 2.6],
  [1.2, 0.25, 2],
  [1.5, 0.2, 1.6],
  [2, 0.3, 1.2],
];

function strike(at: number, freq: number, volume: number): void {
  if (!ctx) return;
  for (const [ratio, gain, decay] of PARTIALS) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * ratio;
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(gain * volume, at + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(amp).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }
}

/** Focus over: two descending strikes. Break over: one rising pair, a call back to work. */
export function chime(kind: "focus-done" | "break-done", volume = 0.18): void {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime + 0.05;
  const notes = kind === "focus-done" ? [659.25, 523.25] : [523.25, 783.99]; // E5→C5 / C5→G5
  notes.forEach((f, i) => strike(t + i * 0.45, f, volume));
}
