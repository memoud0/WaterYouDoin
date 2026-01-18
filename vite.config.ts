

import { defineConfig } from "vite";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "extension/scripts/background.ts"),
        content: resolve(__dirname, "extension/scripts/content.ts"),
        popup: resolve(__dirname, "extension/pages/popup/popup.html"),
        options: resolve(__dirname, "extension/pages/options/options.html")
      },
      output: {
        entryFileNames: "[name].js",
        assetFileNames: "[name][extname]"
      }
    }
  },

  test: {
    environment: "node",
    globals: true
  },

  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "extension/manifest.json",
          dest: "."
        },
        {
          src: "extension/assets",
          dest: "extension"
        }
      ]
    })
  ]
});

