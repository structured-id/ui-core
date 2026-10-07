import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { createApp, defineComponent } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import { authorizationContinuation, useLoginSuccess } from "./useLoginSuccess";
import { useAuthStore } from "../../stores/auth";

// Mock checkBffSession from BFF composable
vi.mock("../../composables/useBffAuth", () => ({
  checkBffSession: vi.fn(),
}));

import { checkBffSession } from "../../composables/useBffAuth";
const mockCheckBffSession = vi.mocked(checkBffSession);

// Helper: run composable inside a real Vue app with router + pinia, the
// current route at `at`.
async function withApp<T>(
  fn: () => T,
  at = "/",
): Promise<{ result: T; router: ReturnType<typeof createRouter> }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      { path: "/login", component: { template: "<div />" } },
      { path: "/account", component: { template: "<div />" } },
      { path: "/admin", component: { template: "<div />" } },
    ],
  });
  await router.push(at);
  await router.isReady();

  const pinia = createPinia();
  setActivePinia(pinia);

  let result: T;
  const App = defineComponent({
    setup() {
      result = fn();
      return () => null;
    },
  });

  const app = createApp(App);
  app.use(pinia);
  app.use(router);
  app.mount(document.createElement("div"));

  return { result: result!, router };
}

const ISSUER = "https://sid.example.com";
const HANDLE = "0123456789abcdef0123456789abcdef";
const CONTINUATION = `${ISSUER}/i/${HANDLE}/oauth2/authorize?client_id=app&request_uri=${encodeURIComponent("urn:ietf:params:oauth:request_uri:ref_1")}`;

describe("authorizationContinuation", () => {
  it("accepts the continuation of a request at the issuer", () => {
    expect(authorizationContinuation(CONTINUATION, ISSUER)).toBe(CONTINUATION);
    // The origin may be given as any URL of the installation.
    expect(authorizationContinuation(CONTINUATION, `${ISSUER}/account`)).toBe(
      CONTINUATION,
    );
  });

  // Each substitution an attacker could make in `rd` is refused: another
  // origin, scheme or port, credentials, a fragment, another path, a full
  // request instead of a reference, extra or missing parameters.
  it("refuses everything else", () => {
    const ref = encodeURIComponent("urn:ietf:params:oauth:request_uri:ref_1");
    const at = (base: string) =>
      `${base}/i/${HANDLE}/oauth2/authorize?client_id=app&request_uri=${ref}`;
    for (const rd of [
      undefined,
      ["x"],
      "",
      "not a url",
      "javascript:alert(1)",
      at("https://evil.example.com"),
      at("http://sid.example.com"),
      at("https://sid.example.com:8443"),
      at("https://user:pw@sid.example.com"),
      `${CONTINUATION}#x`,
      `${ISSUER}/i/${HANDLE}/oauth2/token?client_id=app&request_uri=${ref}`,
      `${ISSUER}/i/NOTAHANDLE/oauth2/authorize?client_id=app&request_uri=${ref}`,
      `${ISSUER}/i/${HANDLE}/oauth2/authorize?client_id=app&redirect_uri=https%3A%2F%2Fevil.example.com`,
      `${CONTINUATION}&redirect_uri=https%3A%2F%2Fevil.example.com`,
      `${ISSUER}/i/${HANDLE}/oauth2/authorize?client_id=app&request_uri=https%3A%2F%2Fevil`,
      `${ISSUER}/i/${HANDLE}/oauth2/authorize?client_id=&request_uri=${ref}`,
    ]) {
      expect(authorizationContinuation(rd, ISSUER), String(rd)).toBeNull();
    }
    expect(authorizationContinuation(CONTINUATION, "not a url")).toBeNull();
  });
});

describe("useLoginSuccess (BFF cookie mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls checkBffSession and populates auth store on success", async () => {
    mockCheckBffSession.mockResolvedValue({
      sub: "profile-uuid-1",
      name: "Alice Smith",
      email: "alice@example.com",
      preferred_username: "alice",
    });

    const { result } = await withApp(() => useLoginSuccess("/account"));
    const auth = useAuthStore();

    await result.onLoginSuccess();

    expect(mockCheckBffSession).toHaveBeenCalled();
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.profileId).toBe("profile-uuid-1");
    expect(auth.displayName).toBe("Alice Smith");
    expect(auth.email).toBe("alice@example.com");
  });

  it("navigates to redirectTo after BFF session check", async () => {
    mockCheckBffSession.mockResolvedValue({ sub: "p1" });

    const { result, router } = await withApp(() => useLoginSuccess("/admin"));

    await result.onLoginSuccess();

    await router.isReady();
    expect(router.currentRoute.value.path).toBe("/admin");
  });

  it("navigates even if BFF session check fails", async () => {
    mockCheckBffSession.mockRejectedValue(new Error("Network error"));

    const { result, router } = await withApp(() => useLoginSuccess("/account"));
    const auth = useAuthStore();

    await result.onLoginSuccess();

    await router.isReady();
    expect(router.currentRoute.value.path).toBe("/account");
    // Auth state not set (session check failed)
    expect(auth.isAuthenticated).toBe(false);
  });

  // A sign-in an authorization request sent the user to returns the browser
  // to that request's continuation, and does not touch the app's session.
  it("returns to the authorization request it was sent from", async () => {
    const leaveTo = vi.fn();
    const { result, router } = await withApp(
      () => useLoginSuccess("/account", { issuerOrigin: ISSUER, leaveTo }),
      `/login?rd=${encodeURIComponent(CONTINUATION)}`,
    );

    await result.onLoginSuccess();

    expect(leaveTo).toHaveBeenCalledWith(CONTINUATION);
    expect(mockCheckBffSession).not.toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe("/login");
  });

  // An `rd` that is not exactly a continuation at this installation's issuer
  // is ignored: the user lands in the app, never at the given address.
  it("ignores an rd it did not validate", async () => {
    mockCheckBffSession.mockResolvedValue(null);
    const leaveTo = vi.fn();
    const { result, router } = await withApp(
      () => useLoginSuccess("/account", { issuerOrigin: ISSUER, leaveTo }),
      `/login?rd=${encodeURIComponent("https://evil.example.com/")}`,
    );

    await result.onLoginSuccess();

    expect(leaveTo).not.toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe("/account");
  });

  // Without an issuer origin no rd is followed at all.
  it("follows no rd without an issuer origin", async () => {
    mockCheckBffSession.mockResolvedValue(null);
    const leaveTo = vi.fn();
    const { result, router } = await withApp(
      () => useLoginSuccess("/account", { leaveTo }),
      `/login?rd=${encodeURIComponent(CONTINUATION)}`,
    );

    await result.onLoginSuccess();

    expect(leaveTo).not.toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe("/account");
  });

  it("navigates when BFF session returns null (cookie not yet set)", async () => {
    mockCheckBffSession.mockResolvedValue(null);

    const { result, router } = await withApp(() => useLoginSuccess("/account"));
    const auth = useAuthStore();

    await result.onLoginSuccess();

    await router.isReady();
    expect(router.currentRoute.value.path).toBe("/account");
    expect(auth.isAuthenticated).toBe(false);
  });
});
