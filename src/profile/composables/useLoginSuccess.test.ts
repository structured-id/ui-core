import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { createApp, defineComponent } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import { useLoginSuccess } from "./useLoginSuccess";
import { useAuthStore } from "../../stores/auth";

// Mock checkBffSession from BFF composable
vi.mock("../../composables/useBffAuth", () => ({
  checkBffSession: vi.fn(),
}));

import { checkBffSession } from "../../composables/useBffAuth";
const mockCheckBffSession = vi.mocked(checkBffSession);

// Helper: run composable inside a real Vue app with router + pinia
async function withApp<T>(
  fn: () => T,
): Promise<{ result: T; router: ReturnType<typeof createRouter> }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      { path: "/account", component: { template: "<div />" } },
      { path: "/admin", component: { template: "<div />" } },
    ],
  });
  await router.push("/");
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
