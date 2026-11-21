import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";

const mocks = vi.hoisted(() => ({
  startBffLogin: vi.fn(),
  checkBffSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@structured-id/ui-core", () => ({
  checkBffSession: mocks.checkBffSession,
  initAccountApi: vi.fn(),
  initBff: vi.fn(),
  startBffLogin: mocks.startBffLogin,
  useAuthStore: () => ({ isAuthenticated: false, setBffSession: vi.fn() }),
}));

import { guardConsole } from "./console";

describe("console guard", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: with the console mounted at /admin/, opening /admin/users
  // without a session returned to /users after sign-in: the router's path
  // leaves out its base, while the sign-in return path is origin-local.
  it("returns to the requested page including the console base", async () => {
    const router = createRouter({
      history: createMemoryHistory("/admin/"),
      routes: [{ path: "/users", component: { render: () => null } }],
    });
    await guardConsole(router);

    void router.push("/users?page=2");
    await vi.waitFor(() => expect(mocks.startBffLogin).toHaveBeenCalled());

    expect(mocks.startBffLogin).toHaveBeenCalledWith(
      undefined,
      "/admin/users?page=2",
    );
  });
});
