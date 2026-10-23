// Draws the hero as native pixel art: the TUM Thiersch tower and flags on a
// snowy winter night. Composition follows assets/source/tum-campus.jpg, but
// every pixel is drawn here; the photo itself is never sampled.
// Usage: npm run assets
import { mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// ---- Tweak these ------------------------------------------------------------
const W = 384; // native art size; 48:25 like the old hero, so CSS positions carry over
const H = 200;
const SEED = 7; // changes stars, snowflakes and which windows are lit
const STAR_COUNT = 140;
const SNOW_COUNT = 260;
const LIT_WINDOW_SHARE = 0.55;
const STEP_WIDTHS = [48, 96]; // depixelate stages; the full-size art is the last

const P = {
  sky: ["#070b22", "#0c1434", "#132049", "#1b2c5e", "#263b72", "#334a84"],
  star: "#f4f6ff",
  starDim: "#8f9cd6",
  snow: "#e9eefb",
  snowShade: "#aab8dc",
  snowDeep: "#7584b4",
  patina: "#3f6a66",
  patinaLight: "#5b8c83",
  patinaDark: "#26413f",
  patinaDeep: "#172a2a",
  stoneLine: "#1c3030",
  glass: "#0d1822",
  lit: "#ffd27a",
  litWarm: "#f2a446",
  litDim: "#9b6430",
  gold: "#f0c157",
  goldDark: "#a9792a",
  clockFace: "#14262a",
  flag: "#1f5ca8",
  flagLight: "#2f73c4",
  flagShade: "#174886",
  flagDeep: "#0f3062",
  logo: "#eef4ff",
  rod: "#9aa5bb",
  building: "#141c33",
  buildingEdge: "#1d2847",
  pine: "#0f2229",
  pineMid: "#183640",
  pineEdge: "#22495a",
};

// ---- Tiny raster toolkit ------------------------------------------------------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const buf = new Uint8Array(W * H * 3);
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
/** Ordered dither: true on a share `t` (0..1) of pixels, in a stable pattern. */
const dither = (x, y, t) => t * 16 > BAYER[y & 3][x & 3] + 0.5;

function px(x, y, color) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const [r, g, b] = typeof color === "string" ? hex(color) : color;
  buf.set([r, g, b], (y * W + x) * 3);
}
function rect(x0, y0, x1, y1, color) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px(x, y, color);
}
function disc(cx, cy, r, color) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) px(cx + x, cy + y, color);
}
/** Dithered halo: lights a fading share of pixels around a point. */
function glow(cx, cy, r, color, strength = 0.5) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y) / r;
      if (d < 1 && dither(cx + x, cy + y, (1 - d) ** 2 * strength)) px(cx + x, cy + y, color);
    }
}
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const rand = rng(SEED);

// ---- Sky ----------------------------------------------------------------------
function sky() {
  const stops = P.sky;
  for (let y = 0; y < H; y++) {
    const t = Math.min(y / (H * 0.78), 1) * (stops.length - 1);
    const i = Math.min(Math.floor(t), stops.length - 2);
    for (let x = 0; x < W; x++) px(x, y, dither(x, y, t - i) ? stops[i + 1] : stops[i]);
  }
  for (let i = 0; i < STAR_COUNT; i++) {
    const x = rand() * W;
    const y = rand() ** 1.6 * H * 0.6; // denser near the top
    px(x, y, rand() < 0.3 ? P.star : P.starDim);
  }
  // A few four-point sparkles.
  for (const [x, y, r] of [[300, 30, 4], [62, 30, 2], [190, 92, 2], [356, 60, 2], [20, 52, 1]]) {
    glow(x, y, r * 3, P.starDim, 0.45);
    for (let k = -r; k <= r; k++) {
      px(x + k, y, Math.abs(k) === r ? P.starDim : P.star);
      px(x, y + k, Math.abs(k) === r ? P.starDim : P.star);
    }
  }
}

// ---- Distant building with lit windows (behind the flags) -------------------------
function backBuilding() {
  const top = 166;
  rect(150, top, W, H, P.building);
  rect(150, top, W, top + 1, P.buildingEdge);
  rect(150, top - 2, W, top, P.snowDeep); // snow on the roof edge
  for (let y = top + 6; y < H; y += 7)
    for (let x = 154; x < W - 2; x += 6) {
      const r = rand();
      if (r < LIT_WINDOW_SHARE * 0.8) rect(x, y, x + 3, y + 4, r < 0.15 ? P.lit : P.litDim);
    }
}

// ---- Thiersch tower -------------------------------------------------------------
// Architecture sits in the lower half so the headline always has calm sky behind it.
const T = { side0: 60, front0: 76, front1: 152, top: 118, clockX: 114, clockY: 166, clockR: 14 };

function towerBody() {
  // Side face (in shadow), front face (moonlit).
  rect(T.side0, T.top, T.front0, H, P.patinaDark);
  rect(T.front0, T.top, T.front1, H, P.patina);
  // Pilasters: lighter vertical strips with a shadow edge.
  for (const x of [T.front0, 100, 126, T.front1 - 4]) {
    rect(x, T.top, x + 4, H, P.patinaLight);
    rect(x + 4, T.top, x + 5, H, P.patinaDark);
  }
  for (const x of [T.side0, 68]) rect(x, T.top, x + 2, H, P.patina);
  // Horizontal stone courses.
  for (const y of [T.top + 23, T.clockY + 22]) {
    rect(T.side0, y, T.front1 + 2, y + 2, P.patinaDark);
    rect(T.front0, y, T.front1 + 2, y + 1, P.patinaLight);
  }
}

function towerTop() {
  // Cornice, wider than the body, then a parapet with railing and corner blocks.
  rect(T.side0 - 3, T.top - 6, T.front1 + 4, T.top, P.patinaLight);
  rect(T.side0 - 3, T.top - 2, T.front1 + 4, T.top, P.patinaDark);
  rect(T.side0 - 3, T.top - 8, T.front1 + 4, T.top - 6, P.snow); // snow on the cornice
  rect(T.side0 - 3, T.top - 6, T.front1 + 4, T.top - 5, P.snowShade);
  // Railing.
  rect(T.side0 + 2, T.top - 20, T.front1 - 2, T.top - 19, P.patinaLight);
  for (let x = T.side0 + 2; x < T.front1 - 2; x += 3) rect(x, T.top - 19, x + 1, T.top - 8, P.patinaDeep);
  // Corner blocks with snow caps.
  for (const [x0, x1] of [[T.side0 - 2, T.side0 + 12], [T.front1 - 12, T.front1 + 2]]) {
    rect(x0, T.top - 22, x1, T.top - 8, P.patina);
    rect(x0, T.top - 22, x0 + 2, T.top - 8, P.patinaLight);
    rect(x0, T.top - 24, x1, T.top - 21, P.snow);
  }
  // Small rooftop hut and the diamond-shaped weather signals from the photo.
  rect(92, T.top - 26, 108, T.top - 19, P.patinaDark);
  rect(91, T.top - 28, 109, T.top - 26, P.snow);
  rect(130, T.top - 34, 131, T.top - 20, P.rod);
  for (const [x, y] of [[124, T.top - 34], [136, T.top - 34], [130, T.top - 38]]) {
    px(x, y - 1, P.rod); px(x - 1, y, P.rod); px(x + 1, y, P.rod); px(x, y + 1, P.rod); px(x, y, P.snowShade);
  }
}

function towerWindows() {
  // Upper row: four tall windows between the pilasters.
  const lit = () => (rand() < LIT_WINDOW_SHARE ? (rand() < 0.5 ? P.lit : P.litWarm) : P.glass);
  for (const x of [82, 91, 107, 116, 131, 140]) {
    const c = lit();
    rect(x, T.top + 4, x + 6, T.top + 19, c);
    rect(x, T.top + 11, x + 6, T.top + 12, P.stoneLine); // transom
    if (c !== P.glass) glow(x + 3, T.top + 11, 9, c, 0.25);
  }
  // Side face windows (narrow, in shadow).
  for (let y = T.top + 4; y < H; y += 26) rect(63, y, 67, y + 14, rand() < 0.4 ? P.litDim : P.glass);
  // Round windows flanking the clock.
  for (const x of [88, 140]) {
    disc(x, T.clockY - 2, 5, P.patinaDeep);
    disc(x, T.clockY - 2, 4, rand() < 0.6 ? P.litWarm : P.glass);
    rect(x - 4, T.clockY - 2, x + 5, T.clockY - 1, P.stoneLine);
  }
  // Lower row.
  for (const x of [82, 107, 131]) {
    const c = lit();
    const y0 = T.clockY + 26;
    rect(x, y0, x + 15, H, c);
    for (let k = x + 4; k < x + 15; k += 5) rect(k, y0, k + 1, H, P.stoneLine);
    if (c !== P.glass) glow(x + 7, y0 + 6, 12, c, 0.2);
  }
}

function clock() {
  const { clockX: cx, clockY: cy, clockR: r } = T;
  glow(cx, cy, r + 12, P.goldDark, 0.55);
  disc(cx, cy, r + 2, P.patinaDeep);
  disc(cx, cy, r, P.gold);
  disc(cx, cy, r - 2, P.goldDark);
  disc(cx, cy, r - 3, P.clockFace);
  // Hour marks (the photo's roman numerals, reduced to ticks).
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2;
    const len = h % 3 === 0 ? 3 : 2;
    for (let k = 0; k < len; k++) px(cx + Math.sin(a) * (r - 4 - k), cy - Math.cos(a) * (r - 4 - k), P.gold);
  }
  // Hands at ten past ten.
  const hand = (a, len) => {
    for (let k = 0; k <= len; k++) px(cx + Math.sin(a) * k, cy - Math.cos(a) * k, P.gold);
  };
  hand((-2 / 12) * Math.PI * 2, 6);
  hand((2 / 12) * Math.PI * 2, 9);
  px(cx, cy, P.lit);
  // Second clock on the side face, foreshortened to an ellipse.
  for (let y = -12; y <= 12; y++)
    for (let x = -4; x <= 4; x++) {
      const d = (x / 4.5) ** 2 + (y / 12.5) ** 2;
      if (d <= 1) px(68 + x, cy + y, d > 0.6 ? P.goldDark : P.clockFace);
    }
}

// ---- TUM flags ------------------------------------------------------------------
// The logo as a 15×5 bitmap: T, then U and M sharing strokes.
const LOGO = ["#####.#########", "..#...#...#...#", "..#...#...#...#", "..#...#...#...#", "..#####...#...#"];

function flag(x0, x1, top, scale) {
  const w = x1 - x0;
  for (let y = top; y < H; y++)
    for (let x = x0; x < x1; x++) {
      // Fabric folds: soft vertical light/dark bands, darker toward the right edge.
      const fold = Math.sin(((x - x0) / w) * Math.PI * 3.2);
      const tones = [P.flagDeep, P.flagShade, P.flag, P.flagLight];
      let i = fold > 0.6 ? 3 : fold < -0.6 ? 1 : 2;
      if (dither(x, y, (y - (H - 60)) / 16)) i -= 1; // night falls toward the ground
      if (x > x1 - 3) i = 0;
      px(x, y, tones[Math.max(i, 0)]);
    }
  rect(x0 - 2, top - 2, x1 + 2, top, P.rod); // top rod
  rect(x0 - 2, top - 3, x1 + 2, top - 2, P.snow);
  const lw = LOGO[0].length * scale;
  const lx = x0 + Math.round((w - lw) / 2);
  const ly = top + Math.round(w * 0.32);
  LOGO.forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      if (ch === "#") rect(lx + rx * scale, ly + ry * scale, lx + (rx + 1) * scale, ly + (ry + 1) * scale, P.logo);
    }),
  );
}

function flags() {
  rect(352, 70, 354, H, P.rod); // flag pole
  rect(351, 68, 355, 70, P.rod);
  flag(156, 190, 150, 2);
  flag(194, 236, 128, 2);
  flag(242, 292, 104, 3);
  flag(296, 350, 80, 3);
}

// ---- Snowy pines and foreground --------------------------------------------------
function pine(cx, base, height, width) {
  const tiers = Math.max(3, Math.round(height / 16));
  const tierH = height / tiers;
  for (let t = 0; t < tiers; t++) {
    const yTop = base - height + t * tierH * 0.8;
    const yBot = yTop + tierH * 1.35;
    const halfW = (width / 2) * (0.35 + 0.65 * ((t + 1) / tiers));
    const slope = (yBot - yTop) / halfW;
    for (let x = Math.round(cx - halfW); x <= cx + halfW; x++) {
      const edgeY = yTop + Math.abs(x - cx) * slope; // top surface of this tier
      const snowDepth = 2 + (rand() < 0.35 ? 1 : 0) + (rand() < 0.12 ? 2 : 0); // occasional drips
      for (let y = Math.ceil(edgeY); y < yBot; y++) {
        const right = x > cx;
        let c = right ? P.pine : P.pineMid;
        if (x >= cx + halfW - 1) c = P.pineEdge;
        if (y - edgeY < snowDepth) c = y - edgeY < 1 && !right ? P.snow : right ? P.snowShade : P.snow;
        else if (y - edgeY < snowDepth + 1) c = P.snowDeep;
        px(x, y, c);
      }
    }
  }
  rect(cx - 1, base - 4, cx + 2, base, P.pine);
}

function bushes() {
  // Snow-covered shrubs along the bottom edge: snow on top, shade, then dark.
  for (let x = -8; x < W + 8; x += 14 + Math.floor(rand() * 10)) {
    const r = 8 + Math.floor(rand() * 7);
    const cy = H - 2 + Math.floor(rand() * 4);
    for (let y = -r; y <= r; y++)
      for (let k = -r - 3; k <= r + 3; k++) {
        if ((k / (r + 3)) ** 2 + (y / r) ** 2 > 1) continue;
        const f = (y + r) / (2 * r); // 0 top → 1 bottom
        const c = f < 0.3 ? (k < 0 ? P.snow : P.snowShade) : f < 0.42 ? P.snowShade : f < 0.5 ? P.snowDeep : P.pine;
        px(x + k, cy + y, c);
      }
  }
}

function snowfall() {
  for (let i = 0; i < SNOW_COUNT; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const big = rand() < 0.12;
    px(x, y, rand() < 0.5 ? P.snow : P.snowShade);
    if (big) {
      px(x + 1, y, P.snowShade);
      px(x, y + 1, P.snowShade);
    }
  }
}

// ---- Compose -------------------------------------------------------------------------
sky();
backBuilding();
towerBody();
towerTop();
towerWindows();
clock();
flags();
pine(22, H + 6, 130, 56);
pine(372, H + 4, 104, 48);
pine(46, H + 8, 70, 30);
bushes();
snowfall();

const OUT = fileURLToPath(new URL(process.env.OUT_DIR ?? "../public/hero/", import.meta.url));
await mkdir(OUT, { recursive: true });
const art = sharp(Buffer.from(buf), { raw: { width: W, height: H, channels: 3 } });
const outputs = [
  ...STEP_WIDTHS.map((w) => [w, art.clone().resize({ width: w, kernel: "mitchell" })]),
  [W, art.clone()],
];
for (const [w, img] of outputs) {
  const file = `${OUT}hero-${w}.png`;
  await img.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(file);
  console.log(`hero-${w}.png  ${w}×${Math.round((w * H) / W)}  ${(await stat(file)).size} B`);
}
