import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";

const mocks = vi.hoisted(() => ({
  checkInstallationSession: vi.fn(),
  initInstallationSession: vi.fn(),
  useApiTransport: vi.fn(),
  installationTransport: vi.fn(() => ({ name: "installation" })),
  installationSignInUrl: vi.fn(() => "https://sid.example.com/account/"),
  auth: { isAuthenticated: false, setInstallationSession: vi.fn() },
}));

vi.mock("@structured-id/ui-core", () => ({
  checkInstallationSession: mocks.checkInstallationSession,
  initInstallationSession: mocks.initInstallationSession,
  installationSignInUrl: mocks.installationSignInUrl,
  installationTransport: mocks.installationTransport,
  useApiTransport: mocks.useApiTransport,
  useAuthStore: () => mocks.auth,
}));

import { guardConsole, setupConsoleTransports } from "./console";

const router = () =>
  createRouter({
    history: createMemoryHistory("/admin/"),
    routes: [{ path: "/users", component: { render: () => null } }],
  });

describe("console set-up", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.auth.isAuthenticated = false;
  });

  // The console's API calls go to the installation its host's config.json
  // names, which may sit on another host of the site than the console.
  it("calls the installation the console's configuration names", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ installationUrl: "https://sid.example.com" }),
      }),
    );
    await setupConsoleTransports();
    expect(mocks.initInstallationSession).toHaveBeenCalledWith(
      "https://sid.example.com",
    );
    expect(mocks.useApiTransport).toHaveBeenCalledWith({
      name: "installation",
    });
    vi.unstubAllGlobals();
  });

  // Without a configuration naming one, the page's own origin is the
  // installation.
  it("falls back to its own origin", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await setupConsoleTransports();
    expect(mocks.initInstallationSession).toHaveBeenCalledWith(
      window.location.origin,
    );
    vi.unstubAllGlobals();
  });

  // A signed-in installation session admits the console with no second
  // sign-in.
  it("admits the installation's session", async () => {
    mocks.checkInstallationSession.mockResolvedValueOnce({
      administrator: true,
      expiresAt: null,
    });
    await guardConsole(router());
    expect(mocks.auth.setInstallationSession).toHaveBeenCalled();
  });

  // Signed out, a page that needs a session sends the user to the
  // installation's sign-in.
  it("sends a signed-out user to the installation's sign-in", async () => {
    mocks.checkInstallationSession.mockResolvedValueOnce(null);
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const r = router();
    await guardConsole(r);
    void r.push("/users");
    await vi.waitFor(() => expect(assign).toHaveBeenCalled());
    expect(assign).toHaveBeenCalledWith("https://sid.example.com/account/");
    expect(mocks.auth.setInstallationSession).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
