// Turns the campus photo into pixel art that matches it closely.
//   1. smooth the photo and shrink it to the art size
//   2. reduce it to a small palette (k-means), then clean stray pixels so
//      areas read as flat, deliberate shapes
//   3. redraw what must be crisp by hand at its measured spot in the photo:
//      the TUM logos, the clocks, the railing and signals on the tower
//   4. optional night grade for dark mode
// Usage: npm run assets            (MODE=day npm run assets for daylight)
import { mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// ---- Tweak these ------------------------------------------------------------
const MODE = process.env.MODE ?? "night"; // "night" (dark-mode hero) or "day" (as photographed)
const W = 384; // art size; 48:25 crop of the 1920×1016 photo
const H = 200;
const COLORS = 20; // palette size
const CLEANUP_PASSES = 2; // majority filter passes; more = flatter shapes
const NIGHT = { brightness: 0.75, skyFactor: 0.45, saturation: 0.95, tint: [45, 75, 170], tintStrength: 0.72, gamma: 1.25 };
const STEP_WIDTHS = [48, 96]; // depixelate stages; the full art is the last

const SRC = fileURLToPath(new URL("../assets/source/tum-campus.jpg", import.meta.url));
const OUT = fileURLToPath(new URL(process.env.OUT_DIR ?? "../public/hero/", import.meta.url));
const SRC_W = 1920;
const CROP_TOP = 8; // 1016 → 1000 rows, centred
const S = W / SRC_W; // photo px → art px

// ---- 1. Shrink ----------------------------------------------------------------
const { data: px } = await sharp(SRC)
  .extract({ left: 0, top: CROP_TOP, width: SRC_W, height: SRC_W / (W / H) })
  .median(5) // drops leaf-level noise before shrinking
  .resize(W, H, { kernel: "lanczos3" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

// ---- 2. Palette + cleanup -------------------------------------------------------
// Weighted RGB distance: close enough to perceptual for picking palette entries.
const dist = (a, b) => 2 * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + 3 * (a[2] - b[2]) ** 2;
const pixels = [];
for (let i = 0; i < W * H; i++) pixels.push([px[i * 3], px[i * 3 + 1], px[i * 3 + 2]]);

function kmeans(points, k) {
  // Deterministic farthest-point init, then Lloyd iterations.
  const centers = [points[Math.floor(points.length / 2)]];
  while (centers.length < k) {
    let best = 0;
    let bestD = -1;
    for (let i = 0; i < points.length; i += 7) {
      const d = Math.min(...centers.map((c) => dist(points[i], c)));
      if (d > bestD) [best, bestD] = [i, d];
    }
    centers.push(points[best]);
  }
  const assign = new Uint8Array(points.length);
  for (let iter = 0; iter < 15; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    points.forEach((p, i) => {
      let bi = 0;
      for (let c = 1; c < k; c++) if (dist(p, centers[c]) < dist(p, centers[bi])) bi = c;
      assign[i] = bi;
      sums[bi][0] += p[0];
      sums[bi][1] += p[1];
      sums[bi][2] += p[2];
      sums[bi][3]++;
    });
    sums.forEach((s, c) => s[3] && (centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]].map(Math.round)));
  }
  return { centers, assign };
}

const { centers: palette, assign } = kmeans(pixels, COLORS);
let idx = assign;

// Majority filter: a pixel takes the most common colour of its 3×3 block
// (only if that colour clearly wins), which removes speckle but keeps edges.
for (let pass = 0; pass < CLEANUP_PASSES; pass++) {
  const next = idx.slice();
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const counts = new Map();
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const v = idx[(y + dy) * W + x + dx];
          counts.set(v, (counts.get(v) ?? 0) + 1);
        }
      let [best, n] = [idx[y * W + x], 0];
      for (const [v, c] of counts) if (c > n) [best, n] = [v, c];
      if (n >= 5) next[y * W + x] = best;
    }
  idx = next;
}

const img = new Uint8Array(W * H * 3);
idx.forEach((c, i) => img.set(palette[c], i * 3));

// ---- 3. Hand-drawn details -------------------------------------------------------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** Pixels drawn here skip most of the night grade so they stay legible/bright. */
const keepBright = new Uint8Array(W * H);
function set(x, y, color, bright = false) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  img.set(typeof color === "string" ? hex(color) : color, (y * W + x) * 3);
  keepBright[y * W + x] = bright ? 1 : 0;
}
function rect(x0, y0, x1, y1, color, bright = false) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, color, bright);
}
const at = (x, y) => [...img.subarray((y * W + x) * 3, (y * W + x) * 3 + 3)];
/** Photo coordinates (1920×1016) → art coordinates. */
const ax = (x) => Math.round(x * S);
const ay = (y) => Math.round((y - CROP_TOP) * S);

/**
 * The TUM logo, from the official mark: five equal vertical strokes, gaps
 * ≈ 1.19 × stroke, T bar from the far left over strokes 1–2 (stem is
 * stroke 1, offset by one stroke), U bottom joining strokes 2–3, M bar over
 * strokes 3–5. Snapped to whole pixels so every stroke has the same width.
 */
function tumLogo(x0, y0, w, h, color, clipRight = Infinity) {
  const s = Math.max(1, Math.round(w / 10.76)); // stroke width
  const g = Math.max(1, Math.round((w - 6 * s) / 4)); // gap
  const t = Math.max(1, Math.round(h / 5.78)); // bar thickness
  const width = 6 * s + 4 * g;
  const left = x0 + Math.round((w - width) / 2);
  const v = [1, 2, 3, 4, 5].map((n) => left + n * s + (n - 1) * g); // stroke x starts
  const clip = (a, b, ya, yb) => rect(a, ya, Math.min(b, clipRight), yb, color, true);
  clip(left, v[1] + s, y0, y0 + t); // T bar
  clip(v[2], v[4] + s, y0, y0 + t); // M bar
  for (const sx of v) clip(sx, sx + s, y0, y0 + h); // strokes
  clip(v[1], v[2] + s, y0 + h - t, y0 + h); // U bottom
}

const luma = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Removes the photo's blurry logo: light pixels take the flag colour to their left, so fabric folds survive. */
function eraseLogo(x0, y0, x1, y1) {
  for (let y = y0; y < y1; y++) {
    let fill = at(Math.max(x0 - 1, 0), y);
    for (let x = x0; x < x1; x++) {
      const c = at(x, y);
      if (luma(c) > 160) set(x, y, fill);
      else fill = c;
    }
  }
}

function logos() {
  const white = MODE === "night" ? "#e6edf8" : "#ffffff";
  // [x0, x1, y0, y1] in photo px (measured), plus the flag's right edge for clipping.
  const boxes = [
    [800, 910, 700, 782, 925],
    [1002, 1139, 551, 640, 1140],
    [1225, 1389, 342, 432, 1400],
    [1486, 1678, 104, 203, 1780],
  ];
  for (const [x0, x1, y0, y1, edge] of boxes) {
    eraseLogo(ax(x0) - 2, ay(y0) - 2, Math.min(ax(x1) + 3, ax(edge)), ay(y1) + 3);
    tumLogo(ax(x0), ay(y0), ax(x1) - ax(x0), ay(y1) - ay(y0), white, ax(edge));
  }
}

function disc(cx, cy, r, color, bright) {
  for (let y = -r - 1; y <= r + 1; y++)
    for (let x = -r - 1; x <= r + 1; x++) if (x * x + y * y <= r * r + r * 0.5) set(cx + x, cy + y, color, bright);
}

function clocks() {
  const gold = "#e7bf5a";
  const goldDark = "#9c7426";
  const face = "#1d3130";
  const cx = ax(612);
  const cy = ay(808);
  const r = Math.round(80 * S);
  disc(cx, cy, r + 1, goldDark, true);
  disc(cx, cy, r, gold, true);
  disc(cx, cy, r - 2, face, false);
  // Roman numerals, reduced to gold ticks.
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2;
    for (const k of [3, 4]) set(cx + Math.sin(a) * (r - k), cy - Math.cos(a) * (r - k), gold, true);
  }
  const hand = (deg, len) => {
    const a = (deg / 180) * Math.PI;
    for (let k = 0; k <= len; k++) set(cx + Math.sin(a) * k, cy - Math.cos(a) * k, gold, true);
  };
  hand(20, r - 7); // hands as in the photo: roughly 12:19
  hand(100, r - 4);
  set(cx, cy, gold, true);
  // Side clock, seen almost edge-on.
  const sx = ax(326);
  const sy = ay(838);
  for (let y = -16; y <= 16; y++)
    for (let x = -4; x <= 4; x++) {
      const d = (x / 4) ** 2 + (y / 16) ** 2;
      if (d <= 1) set(sx + x, sy + y, d > 0.55 ? gold : face, d > 0.55);
    }
}

function towerTop() {
  // Railing and the three diamond signals, too thin to survive the shrink.
  const rail = "#24403a";
  const y0 = ay(440);
  const y1 = ay(500);
  rect(ax(412), y0, ax(772), y0 + 1, rail);
  for (let x = ax(412); x < ax(772); x += 3) rect(x, y0, x + 1, y1, rail);
  for (const [x, y] of [[672, 457], [740, 457], [797, 455]]) {
    const [cx, cy] = [ax(x), ay(y)];
    for (const [dx, dy] of [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]])
      set(cx + dx, cy + dy, "#c9ccd3");
    rect(cx, cy + 3, cx + 1, y0 + 1, rail);
  }
}

function windows() {
  // Window grid of the tower, measured from the photo (x0, x1, y0, y1).
  const glass = "#17242a";
  const frame = "#3b5a55";
  const panes = (x0, x1, y0, y1, cols, rows) => {
    rect(ax(x0), ay(y0), ax(x1), ay(y1), glass);
    for (let c = 1; c < cols; c++) {
      const x = Math.round(ax(x0) + ((ax(x1) - ax(x0)) * c) / cols);
      rect(x, ay(y0), x + 1, ay(y1), frame);
    }
    for (let r = 1; r < rows; r++) {
      const y = Math.round(ay(y0) + ((ay(y1) - ay(y0)) * r) / rows);
      rect(ax(x0), y, ax(x1), y + 1, frame);
    }
  };
  for (const [x0, x1] of [[485, 522], [555, 593], [627, 664], [697, 734]]) panes(x0, x1, 557, 634, 2, 3);
  for (const [x0, x1] of [[430, 493], [572, 637], [716, 745]]) panes(x0, x1, 905, 1016, 3, 3);
  // Round windows beside the clock.
  for (const [x, y, r] of [[463, 806, 30], [730, 815, 26]]) {
    disc(ax(x), ay(y), Math.round(r * S) + 1, "#2b4744", false);
    disc(ax(x), ay(y), Math.round(r * S), glass, false);
  }
}

towerTop();
windows();
clocks();
logos();

// ---- 4. Night grade -----------------------------------------------------------------
function grade([r, g, b], bright) {
  const n = NIGHT;
  // Saturated colours (flags, leaves) keep more light than the pale sky;
  // a uniform darkening would make the blue flags melt into a navy sky.
  const max = Math.max(r, g, b);
  const sat = max ? (max - Math.min(r, g, b)) / max : 0;
  const k = bright ? 0.82 : n.brightness * (n.skyFactor + (1 - n.skyFactor) * Math.min(sat / 0.6, 1.4));
  let c = [r, g, b].map((v) => 255 * (v / 255) ** n.gamma * k);
  const grey = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  c = c.map((v) => grey + (v - grey) * n.saturation);
  if (!bright) c = c.map((v, i) => v * (1 - n.tintStrength * (1 - n.tint[i] / 255)));
  return c.map((v) => Math.max(0, Math.min(255, Math.round(v))));
}

if (MODE === "night") for (let i = 0; i < W * H; i++) img.set(grade(at(i % W, Math.floor(i / W)), keepBright[i]), i * 3);

// ---- Output ---------------------------------------------------------------------------
await mkdir(OUT, { recursive: true });
const art = sharp(Buffer.from(img), { raw: { width: W, height: H, channels: 3 } });
const outputs = [...STEP_WIDTHS.map((w) => [w, art.clone().resize({ width: w, kernel: "mitchell" })]), [W, art.clone()]];
for (const [w, image] of outputs) {
  const file = `${OUT}hero-${w}.png`;
  await image.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(file);
  console.log(`hero-${w}.png  ${w}×${Math.round((w * H) / W)}  ${(await stat(file)).size} B`);
}
