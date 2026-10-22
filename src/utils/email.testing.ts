import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { PslSource } from "./email";

/**
 * The trie the application would serve, read from the installed package, for
 * tests running without the application's host. Not cached, so a test never
 * reads another run's copy.
 */
export const TEST_PSL: PslSource = {
  url: "psl.bin",
  cache: false,
  fetch: (async () => {
    const path = createRequire(import.meta.url).resolve(
      "@structured-world/structured-public-domains/psl.bin",
    );
    return new Response(await readFile(path));
  }) as typeof fetch,
};
