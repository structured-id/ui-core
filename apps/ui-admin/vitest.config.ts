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
      src: resolve(__dirname, "src"),
      pages: resolve(__dirname, "src/pages"),
      layouts: resolve(__dirname, "src/layouts"),
      components: resolve(__dirname, "src/components"),
      boot: resolve(__dirname, "src/boot"),
      stores: resolve(__dirname, "src/stores"),
    },
  },
});
