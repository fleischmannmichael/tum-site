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
