# Exam countdown

A calm countdown to my TUM exams (ETIT, WS 2026/27): every exam at a glance
with days · hours · minutes · seconds, the rules for each exam, and study links
per module. Runs as a **website** (GitHub Pages); the same code also builds a
Chrome new-tab **extension**.

Live: https://fleischmannmichael.github.io/tum-site/

## Develop

```sh
npm install
npm run dev        # website at http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # typecheck + website → dist/
npm run preview    # serve dist/ locally
```

Every push to `main` runs the tests, builds the site and deploys it to GitHub
Pages (`.github/workflows/pages.yml`). This needs **Settings → Pages → Source:
GitHub Actions**; with "Deploy from a branch", GitHub serves this README instead
of the site.

## Data

Exam dates and rules start from `src/lib/seed.ts`. Edits made in Settings are
saved **in your browser** (localStorage on the website, Chrome sync storage in
the extension) — use Settings → Backup to export/import them or move them to
another browser.

## Extension (optional)

```sh
npm run build:ext  # → dist-ext/
```

`chrome://extensions` → Developer mode → Load unpacked → select `dist-ext`.
The manifest lives in `extension/manifest.json`; its version comes from
`package.json`.

## Hero pictures

Pictures live in `assets/heroes/`, named after their season:
`spring.jpg`, `summer-lake.png`, `autumn.jpg` (or `fall-….jpg`),
`winter-snow.webp`, or `any-….jpg` for all year. Then:

```sh
npm run assets   # → public/hero/<name>/ (full.webp + 48/96 px load-in versions)
```

The site shows a picture for the current season (Munich, meteorological
seasons: Mar–May, Jun–Aug, Sep–Nov, Dec–Feb), rotating daily if there are
several, and falls back to `any-…` pictures, then to whatever exists.
