import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

// Hoisted mocks
const mocks = vi.hoisted(() => ({
  listApplications: vi.fn().mockResolvedValue({
    response: { applications: [] },
  }),
  deleteApplication: vi.fn().mockResolvedValue({ response: {} }),
  createApplication: vi.fn(),
  getApplication: vi.fn(),
  updateApplication: vi.fn(),
}));

vi.mock("@structured-id/ui-core", () => ({
  getTransport: () => ({}),
  Timestamp: {
    toDate: (ts: { seconds: bigint }) => new Date(Number(ts.seconds) * 1000),
  },
}));

vi.mock("@structured-id/proto/sid/v1/projects/projects.client", () => ({
  ProjectServiceClient: class {
    listApplications = mocks.listApplications;
    deleteApplication = mocks.deleteApplication;
    createApplication = mocks.createApplication;
    getApplication = mocks.getApplication;
    updateApplication = mocks.updateApplication;
  },
}));

// Mock quasar composables
vi.mock("quasar", () => ({
  useQuasar: () => ({ notify: vi.fn() }),
  copyToClipboard: vi.fn(),
}));

import { createRouter, createMemoryHistory } from "vue-router";
import ApplicationsPage from "./ApplicationsPage.vue";
import { useApplicationsStore } from "src/stores/applications";
import { quasarStubs } from "src/test-utils/quasar-stubs";

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      {
        path: "/admin/applications/create",
        name: "admin-application-create",
        component: { template: "<div />" },
      },
      {
        path: "/admin/applications/:id",
        name: "admin-application-detail",
        component: { template: "<div />" },
      },
    ],
  });
}

/** An application with a client role; `client` overrides that role's fields. */
function makeApp(
  overrides: Partial<Record<string, unknown>> = {},
  client: Partial<Record<string, unknown>> = {},
) {
  return {
    id: "app-1",
    name: "Test App",
    client: {
      clientId: "client-1",
      type: 1,
      active: true,
      redirectUris: [],
      grantTypes: [],
      responseTypes: [],
      dynamicallyRegistered: false,
      ...client,
    },
    createdAt: { seconds: BigInt(1700000000), nanos: 0 },
    ...overrides,
  };
}

/** An application with only a protected-resource role. */
function makeResourceApp(id: string, state: number) {
  return {
    id,
    name: `Resource ${id}`,
    resource: {
      id: `res-${id}`,
      indicator: `https://api.example.com/${id}`,
      issuer: "https://sid.example.com/i/main",
      scopes: [],
      state,
    },
    createdAt: { seconds: BigInt(1700000000), nanos: 0 },
  };
}

async function mountPage() {
  const router = createTestRouter();
  await router.push("/");
  await router.isReady();
  return mount(ApplicationsPage, {
    global: {
      plugins: [createPinia(), router],
      stubs: {
        ...quasarStubs,
        RouterLink: { template: "<a><slot /></a>" },
      },
      directives: { "close-popup": () => {} },
    },
  });
}

describe("ApplicationsPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.listApplications.mockResolvedValue({
      response: { applications: [] },
    });
  });

  it("renders the page heading", async () => {
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Applications");
  });

  it("calls fetchApplications on mount", async () => {
    await mountPage();
    await flushPromises();
    expect(mocks.listApplications).toHaveBeenCalledOnce();
  });

  it("shows empty state when no applications", async () => {
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("No applications");
  });

  it("renders applications in table when store has data", async () => {
    mocks.listApplications.mockResolvedValue({
      response: { applications: [makeApp()] },
    });
    const wrapper = await mountPage();
    await flushPromises();
    const store = useApplicationsStore();
    // Store should be populated after fetch
    expect(store.applications).toHaveLength(1);
    expect(wrapper.text()).toContain("Test App");
  });

  it("store starts with loading=true during fetch", async () => {
    // Delay resolution to observe loading state
    let resolveApps: (v: unknown) => void;
    mocks.listApplications.mockReturnValue(
      new Promise((r) => {
        resolveApps = r;
      }),
    );
    await mountPage();
    const store = useApplicationsStore();
    expect(store.loading).toBe(true);
    resolveApps!({ response: { applications: [] } });
    await flushPromises();
    expect(store.loading).toBe(false);
  });

  it("shows error banner when store has error", async () => {
    mocks.listApplications.mockRejectedValueOnce(new Error("Network error"));
    const wrapper = await mountPage();
    await flushPromises();
    const store = useApplicationsStore();
    expect(store.error).toBeTruthy();
    expect(wrapper.find(".q-banner").exists()).toBe(true);
  });

  it("filters applications by search text", async () => {
    mocks.listApplications.mockResolvedValue({
      response: {
        applications: [
          makeApp({ id: "a1", name: "Alpha" }, { clientId: "alpha-1" }),
          makeApp({ id: "a2", name: "Beta" }, { clientId: "beta-2" }),
        ],
      },
    });
    const wrapper = await mountPage();
    await flushPromises();

    const store = useApplicationsStore();
    expect(store.applications).toHaveLength(2);

    // The search matches the client role's client_id, not only the name.
    (wrapper.vm as unknown as { search: string }).search = "beta-2";
    await flushPromises();
    expect(wrapper.text()).toContain("Beta");
    expect(wrapper.text()).not.toContain("Alpha");
  });

  it("has Create Application button", async () => {
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Create Application");
  });

  it("store.deleteApplication calls gRPC and removes from list", async () => {
    mocks.listApplications.mockResolvedValue({
      response: {
        applications: [
          makeApp({ id: "app-1", name: "Alpha" }),
          makeApp({ id: "app-2", name: "Beta" }),
        ],
      },
    });
    mocks.deleteApplication.mockResolvedValue({ response: {} });

    await mountPage();
    await flushPromises();
    const store = useApplicationsStore();
    expect(store.applications).toHaveLength(2);

    // Deletion addresses the application by its id, not by a client_id.
    await store.deleteApplication("app-1");
    expect(mocks.deleteApplication).toHaveBeenCalledWith({ id: "app-1" });
    expect(store.applications.map((a) => a.id)).toEqual(["app-2"]);
  });

  it("store.deleteApplication sets error on failure", async () => {
    mocks.deleteApplication.mockRejectedValueOnce(new Error("Forbidden"));
    await mountPage();
    await flushPromises();
    const store = useApplicationsStore();

    try {
      await store.deleteApplication("app-1");
    } catch {
      // store re-throws after setting error
    }
    expect(store.error).toBe("Forbidden");
  });

  // An application counts as active while its client is active or its
  // resource is ACTIVE (ResourceState 1); INACTIVE (2) and RETIRED (3) do not.
  it("activeCount covers both roles", async () => {
    mocks.listApplications.mockResolvedValue({
      response: {
        applications: [
          makeApp({ id: "a1", name: "Web App" }, { type: 1, active: true }),
          makeApp({ id: "a2", name: "API App" }, { type: 3, active: false }),
          makeResourceApp("r1", 1),
          makeResourceApp("r2", 2),
          makeResourceApp("r3", 3),
        ],
      },
    });
    await mountPage();
    await flushPromises();
    const store = useApplicationsStore();
    expect(store.applications).toHaveLength(5);
    expect(store.activeCount).toBe(2);
  });

  it("renders a resource-only application without a client id", async () => {
    mocks.listApplications.mockResolvedValue({
      response: { applications: [makeResourceApp("r1", 1)] },
    });
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Resource r1");
  });
});
