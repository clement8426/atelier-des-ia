import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  main: {},
  preload: {
    build: {
      rollupOptions: {
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    plugins: [react()],
    publicDir: resolve("public"),
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/renderer/index.html"),
          engine: resolve("src/renderer/engine.html"),
        },
      },
    },
    server: { host: "127.0.0.1" },
  },
});
