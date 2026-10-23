// Builds the pixel-art, night-graded hero images from the source photo.
// Usage: npm run assets
import { mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// ---- Grade: tweak these ---------------------------------------------------
const BRIGHTNESS = 0.42; // 1 = unchanged
const SATURATION = 0.85; // 1 = unchanged
const TINT = { r: 70, g: 95, b: 160 }; // cool navy, multiplied over the image
const TINT_STRENGTH = 0.6; // 0 = no tint, 1 = full multiply
const GAMMA = 1.15; // >1 lifts shadows slightly so the tower keeps detail

// ---- Output ---------------------------------------------------------------
const WIDTHS = [48, 96, 192];
// All sizes share one exact aspect so the stacked layers line up pixel-perfectly
// while cross-fading (48:25 → 48×25, 96×50, 192×100). The source is centre-cropped to it.
const ASPECT = 48 / 25;
// "nearest" picks one source pixel per output pixel; on a photo that turns into
// speckle (see M3 notes). "mitchell" averages first; the pixels still render
// crisp because the browser upscales with `image-rendering: pixelated`.
const KERNEL = process.env.KERNEL ?? "mitchell";

const SRC = fileURLToPath(new URL("../assets/source/tum-campus.jpg", import.meta.url));
const OUT = fileURLToPath(new URL(process.env.OUT_DIR ?? "../public/hero/", import.meta.url));

async function graded() {
  const meta = await sharp(SRC).metadata();
  const width = meta.width;
  const height = Math.round(width / ASPECT);
  const crop = { left: 0, top: Math.round((meta.height - height) / 2), width, height };
  const tint = {
    create: {
      width,
      height,
      channels: 4,
      // Multiply by a colour blended toward white by (1 - strength).
      background: {
        r: Math.round(255 - (255 - TINT.r) * TINT_STRENGTH),
        g: Math.round(255 - (255 - TINT.g) * TINT_STRENGTH),
        b: Math.round(255 - (255 - TINT.b) * TINT_STRENGTH),
        alpha: 1,
      },
    },
  };
  // Grade at full resolution so the downscale samples graded pixels.
  return sharp(SRC)
    .extract(crop)
    .gamma(GAMMA)
    .modulate({ brightness: BRIGHTNESS, saturation: SATURATION })
    .composite([{ input: tint, blend: "multiply" }])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

await mkdir(OUT, { recursive: true });
const { data, info } = await graded();
const raw = { raw: { width: info.width, height: info.height, channels: info.channels } };

for (const width of WIDTHS) {
  const file = `${OUT}hero-${width}.png`;
  await sharp(data, raw)
    .resize({ width, kernel: KERNEL })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(file);
  const { size } = await stat(file);
  const { height } = await sharp(file).metadata();
  console.log(`hero-${width}.png  ${width}×${height}  ${size} B`);
}
