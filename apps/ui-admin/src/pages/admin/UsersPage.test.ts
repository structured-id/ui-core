import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

// Hoisted mocks
const mocks = vi.hoisted(() => ({
  listProfiles: vi.fn().mockResolvedValue({
    response: { profiles: [] },
  }),
  createProfile: vi.fn().mockResolvedValue({
    response: {
      id: "new-1",
      username: "newuser",
      status: 1,
      createdAt: { seconds: BigInt(1700000000), nanos: 0 },
    },
  }),
  deleteProfile: vi.fn().mockResolvedValue({ response: {} }),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  listCredentials: vi.fn().mockResolvedValue({ response: { credentials: [] } }),
  revokeCredential: vi.fn(),
  listSessions: vi.fn().mockResolvedValue({ response: { sessions: [] } }),
  revokeSession: vi.fn(),
}));

vi.mock("@structured-id/ui-core", () => ({
  getAccountTransport: () => ({}),
  Timestamp: {
    toDate: (ts: { seconds: bigint }) => new Date(Number(ts.seconds) * 1000),
  },
}));

vi.mock("@structured-id/proto/sid/v1/identity/identity.client", () => ({
  IdentityServiceClient: class {
    listProfiles = mocks.listProfiles;
    createProfile = mocks.createProfile;
    deleteProfile = mocks.deleteProfile;
    getProfile = mocks.getProfile;
    updateProfile = mocks.updateProfile;
    listCredentials = mocks.listCredentials;
    revokeCredential = mocks.revokeCredential;
    listSessions = mocks.listSessions;
    revokeSession = mocks.revokeSession;
  },
}));

vi.mock("quasar", () => ({
  useQuasar: () => ({ notify: vi.fn() }),
}));

import { createRouter, createMemoryHistory } from "vue-router";
import UsersPage from "./UsersPage.vue";
import { useUsersStore } from "src/stores/users";
import { quasarStubs } from "src/test-utils/quasar-stubs";
import { ProfileId } from "@structured-id/ids";

const PROFILE = ProfileId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d30");
const UNKNOWN = ProfileId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d31");

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      {
        path: "/admin/users/:id",
        name: "admin-user-detail",
        component: { template: "<div />" },
      },
    ],
  });
}

function makeProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: PROFILE.toWire(),
    username: "alice",
    email: "alice@sid.example.com",
    emailVerified: true,
    givenName: "Alice",
    familyName: "Smith",
    status: 1, // ACTIVE
    createdAt: { seconds: BigInt(1700000000), nanos: 0 },
    lastLoginAt: { seconds: BigInt(1700100000), nanos: 0 },
    ...overrides,
  };
}

async function mountPage() {
  const router = createTestRouter();
  await router.push("/");
  await router.isReady();
  return mount(UsersPage, {
    global: {
      plugins: [createPinia(), router],
      stubs: quasarStubs,
      directives: { "close-popup": () => {} },
    },
  });
}

describe("UsersPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.listProfiles.mockResolvedValue({
      response: { profiles: [] },
    });
  });

  it("renders the page heading", async () => {
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Users");
  });

  it("calls fetchProfiles on mount", async () => {
    await mountPage();
    await flushPromises();
    expect(mocks.listProfiles).toHaveBeenCalledOnce();
  });

  it("shows empty state when no users", async () => {
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("No users");
  });

  it("renders profiles when store has data", async () => {
    mocks.listProfiles.mockResolvedValue({
      response: { profiles: [makeProfile()] },
    });
    const wrapper = await mountPage();
    await flushPromises();
    const store = useUsersStore();
    expect(store.profiles).toHaveLength(1);
    expect(wrapper.text()).toContain("alice");
  });

  it("shows error banner on fetch failure", async () => {
    mocks.listProfiles.mockRejectedValueOnce(new Error("Network error"));
    const wrapper = await mountPage();
    await flushPromises();
    const store = useUsersStore();
    expect(store.error).toBeTruthy();
    expect(wrapper.find(".q-banner").exists()).toBe(true);
  });

  it("has Create User button", async () => {
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Create User");
  });

  it("has status tabs (All, Active, Suspended)", async () => {
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("All");
    expect(wrapper.text()).toContain("Active");
    expect(wrapper.text()).toContain("Suspended");
  });

  it("populates store with fetched profiles", async () => {
    const profiles = [
      makeProfile({ id: "p1", username: "alice" }),
      makeProfile({ id: "p2", username: "bob", status: 2 }),
    ];
    mocks.listProfiles.mockResolvedValue({
      response: { profiles },
    });
    await mountPage();
    await flushPromises();
    const store = useUsersStore();
    expect(store.profiles).toHaveLength(2);
  });

  it("store.createProfile calls gRPC and adds to list", async () => {
    mocks.createProfile.mockResolvedValue({
      response: { profile: makeProfile({ id: "new-1", username: "newuser" }) },
    });
    await mountPage();
    await flushPromises();
    const store = useUsersStore();

    await store.createProfile({
      username: "newuser",
      email: "new@sid.example.com",
      givenName: "New",
      familyName: "User",
      profileType: 0,
    });
    expect(mocks.createProfile).toHaveBeenCalledOnce();
    expect(store.profiles).toHaveLength(1);
  });

  it("store.deleteProfile calls gRPC", async () => {
    mocks.listProfiles.mockResolvedValue({
      response: { profiles: [makeProfile()] },
    });
    mocks.deleteProfile.mockResolvedValue({ response: {} });
    await mountPage();
    await flushPromises();
    const store = useUsersStore();
    expect(store.profiles).toHaveLength(1);

    await store.deleteProfile(PROFILE);
    // The profile is named by its binary identifier and leaves the list.
    expect(mocks.deleteProfile).toHaveBeenCalledWith({
      id: { value: PROFILE.toBytes() },
    });
    expect(store.profiles).toHaveLength(0);
  });

  it("store.deleteProfile sets error on failure", async () => {
    mocks.deleteProfile.mockRejectedValueOnce(new Error("Not found"));
    await mountPage();
    await flushPromises();
    const store = useUsersStore();

    try {
      await store.deleteProfile(UNKNOWN);
    } catch {
      // store re-throws after setting error
    }
    expect(store.error).toBe("Not found");
  });
});
