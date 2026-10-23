# Exam Tab

Dark new-tab Chrome extension (Manifest V3) with an exam countdown.
Lives in its own folder; independent of the website in the repo root.

```sh
cd exam-tab
npm install
npm run build      # → dist/
npm run dev        # rebuild on change; then hit ↻ on chrome://extensions
```

Load: `chrome://extensions` → Developer mode → Load unpacked → select `exam-tab/dist`.

## Hero pictures

Pictures live in `assets/heroes/`, named after their season:
`spring.jpg`, `summer-lake.png`, `autumn.jpg`, `winter-snow.webp`, or
`any-….jpg` for all year. Then:

```sh
npm run assets   # → public/hero/<name>/ (full.webp + 48/96 px load-in versions)
npm run build
```

The new tab shows a picture for the current season (Munich, meteorological
seasons: Mar–May, Jun–Aug, Sep–Nov, Dec–Feb), rotating daily if there are
several, and falls back to `any-…` pictures, then to whatever exists.
