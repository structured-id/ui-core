import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { createApp, defineComponent } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import {
  abandonUpstream,
  completeUpstream,
  startUpstream,
  useUpstreamCallback,
  type UpstreamApi,
  type UpstreamBrowser,
} from "./useUpstreamSignIn";
import { UPSTREAM_CALLBACK_PATH, peekUpstream } from "../upstream";

vi.mock("../../composables/useBffAuth", () => ({
  checkBffSession: vi.fn().mockResolvedValue(null),
}));

const ORIGIN = "https://ee.sid.example.com";
const ISSUER = "https://sid.example.com";
const RD = `${ISSUER}/i/0123456789abcdef0123456789abcdef/oauth2/authorize?client_id=ops&request_uri=${encodeURIComponent("urn:ietf:params:oauth:request_uri:r")}`;

function api(outcome: "signed-in" | "linking-required" = "signed-in") {
  return {
    list: vi.fn().mockResolvedValue([]),
    initiate: vi.fn().mockResolvedValue({
      authorizationUrl:
        "https://central.sid.example.com/i/h/oauth2/authorize?x=1",
      stateToken: "s1",
    }),
    complete: vi.fn().mockResolvedValue(outcome),
  } satisfies UpstreamApi;
}

function browser(): UpstreamBrowser & { left: string[] } {
  const left: string[] = [];
  return {
    origin: ORIGIN,
    storage: sessionStorage,
    callbackPath: UPSTREAM_CALLBACK_PATH,
    leaveTo: (url) => left.push(url),
    left,
  };
}

beforeEach(() => sessionStorage.clear());

describe("startUpstream", () => {
  // The issuer starts the sign-in for this origin's exact callback page; the
  // browser leaves for the provider with the request kept under its state.
  it("starts at the issuer and leaves for the provider", async () => {
    const calls = api();
    const page = browser();
    await startUpstream("p1", RD, calls, page);
    expect(calls.initiate).toHaveBeenCalledWith(
      "p1",
      `${ORIGIN}${UPSTREAM_CALLBACK_PATH}`,
    );
    expect(page.left).toEqual([
      "https://central.sid.example.com/i/h/oauth2/authorize?x=1",
    ]);
    expect(peekUpstream(sessionStorage, "s1")).toEqual({
      provider: "p1",
      rd: RD,
    });
  });

  // A refused start keeps nothing and leaves nowhere.
  it("keeps nothing when the issuer refuses", async () => {
    const calls = api();
    calls.initiate.mockRejectedValue(new Error("refused"));
    const page = browser();
    await expect(startUpstream("p1", RD, calls, page)).rejects.toThrow(
      "refused",
    );
    expect(page.left).toEqual([]);
    expect(sessionStorage.length).toBe(0);
  });
});

describe("abandonUpstream", () => {
  // A provider's error return (RFC 6749 §4.1.2.1) still carries the state:
  // the kept entry is taken, so the waiting request is offered again and
  // nothing is left behind.
  it("takes the kept request of a refused return", async () => {
    const page = browser();
    await startUpstream("p1", RD, api(), page);
    expect(abandonUpstream("s1", page)).toBe(RD);
    expect(peekUpstream(sessionStorage, "s1")).toBeUndefined();
    expect(abandonUpstream("s1", page)).toBeNull();
  });
});

describe("completeUpstream", () => {
  // The return completes at the issuer with the provider and the callback
  // URI it started with, and continues the kept request.
  it("completes the sign-in this tab started", async () => {
    const calls = api();
    const page = browser();
    await startUpstream("p1", RD, calls, page);
    const done = await completeUpstream("c1", "s1", calls, page);
    expect(calls.complete).toHaveBeenCalledWith(
      "p1",
      "c1",
      "s1",
      `${ORIGIN}${UPSTREAM_CALLBACK_PATH}`,
    );
    expect(done).toEqual({ outcome: "signed-in", rd: RD });
  });

  // A return this tab did not start, or one already completed, asks the
  // issuer nothing.
  it("completes nothing it did not start, and nothing twice", async () => {
    const calls = api();
    const page = browser();
    expect(await completeUpstream("c1", "s1", calls, page)).toEqual({
      outcome: "unknown",
    });
    await startUpstream("p1", RD, calls, page);
    await completeUpstream("c1", "s1", calls, page);
    expect(await completeUpstream("c1", "s1", calls, page)).toEqual({
      outcome: "unknown",
    });
    expect(calls.complete).toHaveBeenCalledTimes(1);
  });

  // An upstream account the issuer does not know is no sign-in.
  it("reports an account that needs linking", async () => {
    const calls = api("linking-required");
    const page = browser();
    await startUpstream("p1", RD, calls, page);
    expect(await completeUpstream("c1", "s1", calls, page)).toEqual({
      outcome: "linking-required",
      rd: RD,
    });
  });
});

/** The callback composable on a real router at `at`. */
async function callbackAt(
  at: string,
  calls: UpstreamApi,
  page: UpstreamBrowser,
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: UPSTREAM_CALLBACK_PATH, component: { template: "<div />" } },
      { path: "/account", component: { template: "<div />" } },
    ],
  });
  await router.push(at);
  await router.isReady();
  const pinia = createPinia();
  setActivePinia(pinia);
  const left: string[] = [];
  let result!: ReturnType<typeof useUpstreamCallback>;
  const app = createApp(
    defineComponent({
      setup() {
        result = useUpstreamCallback("/account", {
          issuerOrigin: ISSUER,
          leaveTo: (url) => left.push(url),
          api: calls,
          browser: page,
        });
        return () => null;
      },
    }),
  );
  app.use(pinia);
  app.use(router);
  app.mount(document.createElement("div"));
  return { result, router, left };
}

describe("useUpstreamCallback", () => {
  // The kept request continues at the issuer.
  it("continues the request kept for the state", async () => {
    const calls = api();
    const page = browser();
    await startUpstream("p1", RD, calls, page);
    const { result, left } = await callbackAt(
      `${UPSTREAM_CALLBACK_PATH}?code=c1&state=s1`,
      calls,
      page,
    );
    await result.complete();
    expect(result.failure.value).toBeNull();
    expect(left).toEqual([RD]);
  });

  // A sign-in started without a request enters the app: an rd added to the
  // callback URL is not continued, whatever it names.
  it("continues no request named only by the callback's own query", async () => {
    const calls = api();
    const page = browser();
    await startUpstream("p1", null, calls, page);
    const { result, router, left } = await callbackAt(
      `${UPSTREAM_CALLBACK_PATH}?code=c1&state=s1&rd=${encodeURIComponent(RD)}`,
      calls,
      page,
    );
    await result.complete();
    expect(left).toEqual([]);
    expect(router.currentRoute.value.path).toBe("/account");
  });

  // A provider error takes the kept entry and keeps its request for signing
  // in another way; nothing is completed at the issuer.
  it("answers a provider error with the waiting request", async () => {
    const calls = api();
    const page = browser();
    await startUpstream("p1", RD, calls, page);
    const { result } = await callbackAt(
      `${UPSTREAM_CALLBACK_PATH}?error=access_denied&state=s1`,
      calls,
      page,
    );
    await result.complete();
    expect(result.failure.value).toBe("provider-error");
    expect(result.continued.value).toBe(RD);
    expect(peekUpstream(sessionStorage, "s1")).toBeUndefined();
    expect(calls.complete).not.toHaveBeenCalled();
  });

  // The issuer failing the completion still answers the waiting request:
  // the kept entry is gone (one-shot), so its rd must reach the page.
  it("keeps the waiting request when the issuer fails", async () => {
    const calls = api();
    calls.complete.mockRejectedValue(new Error("unavailable"));
    const page = browser();
    await startUpstream("p1", RD, calls, page);
    const { result, left } = await callbackAt(
      `${UPSTREAM_CALLBACK_PATH}?code=c1&state=s1`,
      calls,
      page,
    );
    await result.complete();
    expect(result.failure.value).toBe("failed");
    expect(result.continued.value).toBe(RD);
    expect(peekUpstream(sessionStorage, "s1")).toBeUndefined();
    expect(left).toEqual([]);
  });

  // A return this tab did not start signs nobody in.
  it("completes nothing this tab did not start", async () => {
    const calls = api();
    const { result, left } = await callbackAt(
      `${UPSTREAM_CALLBACK_PATH}?code=c1&state=s1`,
      calls,
      browser(),
    );
    await result.complete();
    expect(result.failure.value).toBe("unknown");
    expect(calls.complete).not.toHaveBeenCalled();
    expect(left).toEqual([]);
  });

  // An account that needs linking is reported with its waiting request.
  it("reports linking with the waiting request", async () => {
    const calls = api("linking-required");
    const page = browser();
    await startUpstream("p1", RD, calls, page);
    const { result, left } = await callbackAt(
      `${UPSTREAM_CALLBACK_PATH}?code=c1&state=s1`,
      calls,
      page,
    );
    await result.complete();
    expect(result.failure.value).toBe("linking-required");
    expect(result.continued.value).toBe(RD);
    expect(left).toEqual([]);
  });
});
