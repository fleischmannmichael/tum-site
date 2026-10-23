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
