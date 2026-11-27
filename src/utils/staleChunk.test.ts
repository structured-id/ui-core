import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter, type Router } from "vue-router";

import { isStaleChunk, reloadOnStaleChunk } from "./staleChunk";

const Page = { render: () => null };

/** The messages browsers raise when a route's chunk is gone from the server. */
const GONE = [
  "Failed to fetch dynamically imported module: https://sid.example.com/assets/RegisterPage-CP2BEnvp.js",
  "error loading dynamically imported module: https://sid.example.com/assets/RegisterPage-CP2BEnvp.js",
  "Importing a module script failed.",
];

/** A router whose `/register` chunk belongs to an earlier deployment. */
function staleRouter(failure: unknown = new TypeError(GONE[0])): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/continue", component: Page },
      { path: "/register", component: () => Promise.reject(failure) },
    ],
  });
}

describe("isStaleChunk", () => {
  it("recognises a missing route chunk in every browser's wording", () => {
    for (const message of GONE) {
      expect(isStaleChunk(new TypeError(message))).toBe(true);
    }
  });

  it("leaves other failures to the router", () => {
    expect(isStaleChunk(new TypeError("x is not a function"))).toBe(false);
    expect(isStaleChunk(new Error(GONE[0]))).toBe(false);
    expect(isStaleChunk(GONE[0])).toBe(false);
  });
});

// A page opened before a deployment asked the server for a chunk the new
// build no longer has, so every link to a lazy route did nothing until the
// visitor reloaded the page by hand.
describe("reloadOnStaleChunk", () => {
  beforeEach(() => {
    const kept = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => kept.get(key) ?? null,
      setItem: (key: string, value: string) => kept.set(key, value),
      removeItem: (key: string) => kept.delete(key),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the target page afresh when its chunk is gone", async () => {
    const router = staleRouter();
    const load = vi.fn();
    reloadOnStaleChunk(router, load);
    await router.push("/continue");

    await router.push("/register?reference=abc").catch(() => undefined);

    expect(load).toHaveBeenCalledExactlyOnceWith("/register?reference=abc");
  });

  // A fresh load that still misses the chunk is a broken deployment: loading
  // the page again would loop forever.
  it("loads a target afresh only once", async () => {
    const load = vi.fn();
    const before = staleRouter();
    reloadOnStaleChunk(before, load);
    await before.push("/register").catch(() => undefined);

    const after = staleRouter();
    reloadOnStaleChunk(after, load);
    await after.push("/register").catch(() => undefined);

    expect(load).toHaveBeenCalledOnce();
  });

  // A later deployment can make the same page stale again.
  it("allows a new fresh load once a navigation succeeded", async () => {
    const load = vi.fn();
    const first = staleRouter();
    reloadOnStaleChunk(first, load);
    await first.push("/register").catch(() => undefined);

    const next = staleRouter();
    reloadOnStaleChunk(next, load);
    await next.push("/continue");
    await next.push("/register").catch(() => undefined);

    expect(load).toHaveBeenCalledTimes(2);
  });

  // Without storage a repeated failure cannot be recognised, so the page is
  // not reloaded at all rather than possibly forever.
  it("does not reload when the session storage is unavailable", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    const router = staleRouter();
    const load = vi.fn();
    reloadOnStaleChunk(router, load);

    await router.push("/register").catch(() => undefined);

    expect(load).not.toHaveBeenCalled();
  });

  it("leaves other navigation failures alone", async () => {
    const router = staleRouter(new TypeError("x is not a function"));
    const load = vi.fn();
    reloadOnStaleChunk(router, load);

    await router.push("/register").catch(() => undefined);

    expect(load).not.toHaveBeenCalled();
  });
});
