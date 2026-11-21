import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // The package's own modules resolve through its `#admin/*` imports;
    // quasar's client build is named so its SFCs render under jsdom.
    alias: {
      quasar: "quasar/dist/quasar.client.js",
    },
  },
});
