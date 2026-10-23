import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = import.meta.dirname;
const src = resolve(root, "src");

// Plain multi-page build: each extension page is its own HTML entry.
// public/ (manifest.json, hero images) is copied to dist/ as-is.
export default defineConfig({
  root: src,
  publicDir: resolve(root, "public"),
  base: "./",
  build: {
    outDir: resolve(root, "dist"),
    emptyOutDir: true,
    target: "chrome120",
    modulePreload: false,
    rollupOptions: {
      input: {
        newtab: resolve(src, "newtab/index.html"),
      },
    },
  },
});
