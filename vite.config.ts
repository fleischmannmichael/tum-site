import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { defineConfig, type Plugin } from "vite";

const root = import.meta.dirname;
const src = resolve(root, "src");

/** Extension build only: writes manifest.json, with the version taken from package.json. */
function extensionManifest(): Plugin {
  return {
    name: "extension-manifest",
    generateBundle() {
      const manifest = JSON.parse(readFileSync(resolve(root, "extension/manifest.json"), "utf8"));
      const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
      this.emitFile({ type: "asset", fileName: "manifest.json", source: JSON.stringify({ ...manifest, version }, null, 2) });
    },
  };
}

/** Extension build only: toolbar/store icons as PNG (Chrome doesn't take SVG), rendered from the favicon. */
function extensionIcons(): Plugin {
  return {
    name: "extension-icons",
    async generateBundle() {
      const svg = readFileSync(resolve(root, "public/favicon.svg"));
      for (const size of [16, 32, 48, 128]) {
        const source = await sharp(svg, { density: 72 * (size / 16) }).resize(size, size).png().toBuffer();
        this.emitFile({ type: "asset", fileName: `icons/icon-${size}.png`, source });
      }
    },
  };
}

// One multi-page build, two targets:
//   vite build                   → dist/      the website (GitHub Pages)
//   vite build --mode extension  → dist-ext/  the Chrome new-tab extension
// public/ (hero pictures, favicon) is copied into both.
export default defineConfig(({ mode }) => {
  const extension = mode === "extension";
  return {
    root: src,
    publicDir: resolve(root, "public"),
    base: "./", // relative URLs: works at any path, including /tum-site/
    plugins: extension ? [extensionManifest(), extensionIcons()] : [],
    build: {
      outDir: resolve(root, extension ? "dist-ext" : "dist"),
      emptyOutDir: true,
      target: "es2022", // top-level await
      modulePreload: false,
      rollupOptions: {
        input: {
          index: resolve(src, "index.html"),
          settings: resolve(src, "settings/index.html"),
          // Toolbar popup and badge worker exist only in the extension.
          ...(extension && {
            popup: resolve(src, "popup/index.html"),
            background: resolve(src, "extension/background.ts"),
          }),
        },
        output: {
          // The manifest points at background.js, so it can't carry a hash.
          entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js"),
        },
      },
    },
  };
});
