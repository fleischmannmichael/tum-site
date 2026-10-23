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

## Using it

- **Countdown** — every exam as a tile; click one for its pop-out: the live
  clock, date, room, retake, what you can bring, notes and the module's links.
- **Modules** — one page per module with a **checklist of its contents**: add
  topics (paste a list — bullets, numbers and Markdown `- [x]` work), tick them
  off as you learn them, see progress on the Modules overview.
- **Focus** — a Pomodoro timer drawn as the Thiersch tower clock: Classic
  25 · 5, Deep work 50 · 10, or your own focus/break lengths and rounds. Below
  it, a **study log heatmap** of the last year. Finished sessions are logged
  automatically; you can also log time by hand, click a day to see or remove
  its entries, and **upload** your own records as CSV or JSON (date, minutes
  or hours or h:mm, optional module — German headers and `23.10.2026` dates
  work too) or download the log as CSV. Keys: Space start/pause, R reset,
  S skip. The timer survives reloads and stays in step across tabs.
- **Settings** — grouped like the site: Countdown (exams, headline, seconds),
  Modules (links, checklists), Focus (timer, study log), General (language,
  accent colour, backup).
- **English / Deutsch** — Settings → General → Language switches the whole
  interface (and the motivational lines and quotes). Exam details stay as
  entered.

## Extension (optional)

```sh
npm run build:ext  # → dist-ext/
```

`chrome://extensions` → Developer mode → Load unpacked → select `dist-ext`.

The extension adds what a website can't: it replaces the new tab page, shows
the days to the next exam as a **toolbar badge** (`113d`, `1d`, `!` on exam
day; warm when ≤ 7 days), and its **toolbar popup** lists the next 3 exams.
The badge is kept current by `src/extension/background.ts` (on start, on data
changes, every 30 min and right after midnight).

The manifest lives in `extension/manifest.json`; its version comes from
`package.json`, and the PNG icons are rendered from `public/favicon.svg` at
build time.

## Hero pictures

Pictures live in `assets/heroes/`, named after their season or theme:
`fall_hero.jpg`, `winter_hero_16x9.jpg`, `spring-lake.png`, `non-theme-hero-16x9.jpg`
(all year). Two themes show by themselves: `Halloween_…` in the last week of
October and `Christmas_…` from 1 to 26 December. Otherwise the site follows the
meteorological seasons (Munich), rotating daily if there are several, then
falls back to all-year pictures.

Each picture can come in three shapes, same name plus a suffix: `_16x9` (main,
suffix optional), `_mobile` for phones and portrait windows, `_21x9` for
ultrawide screens. The site picks the one that fits the window (also on rotate
or resize).

A video (`.mp4`) becomes a **live** background: muted, looping, sound removed
and shrunk by ffmpeg, with its first frame as the still. It's never picked
automatically.

**Settings → General → Background picture** is a gallery of all of them:
preview any picture in its desktop, phone or 21:9 shape, then "Use this
picture" — or go back to Automatic.

Uploading to `assets/heroes/` on github.com is enough: the deploy runs
`npm run assets` (`→ public/hero/<name>/`: full.webp, 48/96 px load-in
versions, a gallery thumbnail, and the crops in mobile/ and wide/).

## Personal messages

Settings → Countdown: put in **your name** and the line above the headline
greets you ("Good evening, Michael"). Pick **Personal messages** for the
headline and it talks to you about what's going on — exam day, tomorrow's
exam, how many days are left, what you studied today, your streak, how much of
the next module's checklist is ticked off, the weekday, a late night — taking
turns every few seconds with a soft fade. The Focus timer cheers you on by name
too. English and German.
