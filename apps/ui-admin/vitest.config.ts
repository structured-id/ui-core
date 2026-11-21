import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // The workspace installs one copy of vue, pinia and vue-router; quasar's
    // client build is named so its SFCs render under jsdom.
    alias: {
      quasar: "quasar/dist/quasar.client.js",
      src: resolve(import.meta.dirname, "src"),
      pages: resolve(import.meta.dirname, "src/pages"),
      layouts: resolve(import.meta.dirname, "src/layouts"),
      boot: resolve(import.meta.dirname, "src/boot"),
      stores: resolve(import.meta.dirname, "src/stores"),
    },
  },
});
