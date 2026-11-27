import type { Router } from "vue-router";

/** The target a fresh load was already tried for, kept across that load. */
const RELOADED = "sid.staleChunkReload";

/**
 * A route chunk the server no longer has: the page was loaded from an earlier
 * deployment. Chromium, Firefox and Safari each word the failed import
 * differently, always as a TypeError.
 */
export function isStaleChunk(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    /dynamically imported module|Importing a module script failed/.test(
      error.message,
    )
  );
}

/**
 * Loads the target page afresh when its chunk is gone, so the new build serves
 * it. Once per target: a fresh load that still misses the chunk is a broken
 * deployment, and its failure is left to surface.
 */
export function reloadOnStaleChunk(
  router: Router,
  load: (href: string) => void = (href) => window.location.assign(href),
): void {
  router.onError((error, to) => {
    if (!isStaleChunk(error)) return;
    const href = router.resolve(to.fullPath).href;
    try {
      if (sessionStorage.getItem(RELOADED) === href) return;
      sessionStorage.setItem(RELOADED, href);
    } catch {
      // Without storage a repeated failure could not be told apart, and the
      // page would reload forever.
      return;
    }
    load(href);
  });
  router.afterEach((_to, _from, failure) => {
    if (failure) return;
    try {
      sessionStorage.removeItem(RELOADED);
    } catch {
      // Nothing was stored.
    }
  });
}
