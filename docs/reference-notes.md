# Reference notes — generalintelligencecompany.com

**Status: not yet studied.** The cloud environment's network policy blocks
`www.generalintelligencecompany.com` (proxy 403), so no screenshots, CSS or
motion timings have been collected yet. Nothing below is guessed.

Planned method once the host is reachable:

1. Screenshots at 1440 / 768 / 390 px (Playwright + bundled Chromium).
2. Computed styles: font families/weights, type scale, letter-spacing,
   colors, spacing, radii, shadows, `backdrop-filter` values.
3. Motion inventory from CSS transitions/keyframes and scripts
   (duration, delay, easing, stagger).
4. Reference video → frames (`ffmpeg -vf fps=30`) in a temp folder to
   check timings.
5. Map findings onto `src/styles/tokens.css`.

## Built without the study (M3)

M3 used the spec's starting values. Everything that should be checked
against the reference is marked `VERIFY` in `src/styles/tokens.css`:
glass (fill, blur, border, shadow), radii, type families/scale/tracking,
motion durations and easing.

## From the user's screenshot (2000×1125, one frame)

Read off pixels, not CSS, so treat values as estimates:

- **Hero:** full-bleed *illustrated* night scene (anime/pixel-art feel), not a
  photo: deep navy sky, stars with a few four-point sparkles, falling snow,
  snow-capped buildings with warm lit windows, snowy trees framing the bottom.
  The upper ~40% is calm sky for the headline.
- **Headline:** large centered serif, old-style/calligraphic feel, white with
  a soft glow. Two lines, ~60 px cap height at 2000 px wide.
- **Nav:** centered at the top, dark translucent bar with ~12 px radius (a
  rounded rectangle rather than a full pill), small icon tile, three text
  links, one dark CTA chip.
- **Card:** bottom-left frosted glass, lighter fill than ours, heavy blur
  (est. 30–40 px), hairline border, ~16 px radius; serif title, sans body.
- **Extra:** small live clock + city in the top-right corner.

Mapped here: illustrated pixel-art night hero (drawn by
`scripts/draw-hero.mjs`), calm-sky headline zone, glass tiles. Kept from the
spec instead of the screenshot: full-pill nav, darker glass (needed for AA
contrast over the bright flags).
