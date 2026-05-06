import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/browser-vp/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  splitting: true,
  clean: true,
  external: ["vue", "pinia"],
});
