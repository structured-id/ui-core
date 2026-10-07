import { describe, it, expect } from "vitest";
import pkg from "../package.json";

/**
 * The root entry and the source subpaths (`./profile`, `./components`,
 * `./quasar`) must load the same module graph for an ES module consumer.
 * The subpaths are shipped as sources and import the root through
 * `src/index.ts`; if the root resolved to the built `dist` instead, the app
 * would hold two copies of the module state: the transports `initGrpc` and
 * `initAccountApi` set, the BFF configuration `initBff` sets, and the
 * profile composables would read the copy nobody initialized.
 */
describe("package exports", () => {
  it("resolves the root to the sources the subpaths import", () => {
    expect(pkg.exports["."].import).toBe("./src/index.ts");
    expect(pkg.exports["./profile"].import).toBe("./src/profile/index.ts");
  });
});
