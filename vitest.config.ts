import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    // The library's own tests; each application under apps/ runs its own
    // with its own configuration.
    include: ["src/**/*.test.ts"],
  },
});
