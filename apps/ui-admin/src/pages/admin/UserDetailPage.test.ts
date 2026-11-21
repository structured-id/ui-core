import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  listCredentials: vi.fn().mockResolvedValue({ response: { credentials: [] } }),
  listSessions: vi.fn().mockResolvedValue({ response: { sessions: [] } }),
}));

vi.mock("@structured-id/ui-core", () => ({
  getAccountTransport: () => ({}),
}));

vi.mock("@structured-id/proto/sid/v1/identity/identity.client", () => ({
  IdentityServiceClient: class {
    getProfile = mocks.getProfile;
    listCredentials = mocks.listCredentials;
    listSessions = mocks.listSessions;
  },
}));

vi.mock("quasar", () => ({
  useQuasar: () => ({ notify: vi.fn(), dialog: vi.fn() }),
}));

import { createRouter, createMemoryHistory } from "vue-router";
import UserDetailPage from "./UserDetailPage.vue";
import { useUsersStore } from "src/stores/users";
import { quasarStubs } from "src/test-utils/quasar-stubs";
import { ProfileId } from "@structured-id/ids";

const PROFILE = ProfileId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d60");

async function mountAt(userId: string) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/admin/users",
        name: "admin-users",
        component: { template: "<div />" },
      },
      {
        path: "/admin/users/:userId",
        name: "admin-user-detail",
        component: UserDetailPage,
      },
    ],
  });
  await router.push(`/admin/users/${userId}`);
  await router.isReady();
  mount(UserDetailPage, {
    global: {
      plugins: [pinia, router],
      stubs: quasarStubs,
      directives: { "close-popup": () => {} },
    },
  });
  await flushPromises();
  return useUsersStore();
}

describe("UserDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the profile the route names by its binary identifier", async () => {
    mocks.getProfile.mockResolvedValue({
      response: { profile: { id: PROFILE.toWire(), principals: [] } },
    });
    const store = await mountAt(PROFILE.toString());
    expect(mocks.getProfile).toHaveBeenCalledWith({
      identifier: { oneofKind: "id", id: { value: PROFILE.toBytes() } },
    });
    expect(mocks.listSessions).toHaveBeenCalledWith({
      profileId: { value: PROFILE.toBytes() },
    });
    expect(store.error).toBeNull();
  });

  // Regression: a route naming no valid profile threw in onMounted and left
  // a blank page. It is refused with an error, and nothing is looked up.
  it("refuses a route that names no valid profile", async () => {
    const store = await mountAt("not-a-profile");
    expect(mocks.getProfile).not.toHaveBeenCalled();
    expect(store.error).toBe("This link names no user.");
  });
});
