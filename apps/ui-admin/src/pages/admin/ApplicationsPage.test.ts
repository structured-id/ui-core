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
  getAccountTransport: () => ({}),
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
import { useApplicationsStore } from "#admin/stores/applications";
import { quasarStubs } from "#admin/test-utils/quasar-stubs";
import { ApplicationId } from "@structured-id/ids";

/** The n-th application identifier: a UUIDv7, as the server issues them. */
function appId(n: number): ApplicationId {
  return ApplicationId.parse(
    `0192f3a4-7c1e-7b2a-9d4e-${String(n).padStart(12, "0")}`,
  );
}

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
    id: appId(1).toWire(),
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
function makeResourceApp(n: number, state: number) {
  return {
    id: appId(100 + n).toWire(),
    name: `Resource r${n}`,
    resource: {
      indicator: `https://api.example.com/r${n}`,
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
          makeApp(
            { id: appId(1).toWire(), name: "Alpha" },
            { clientId: "alpha-1" },
          ),
          makeApp(
            { id: appId(2).toWire(), name: "Beta" },
            { clientId: "beta-2" },
          ),
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
          makeApp({ id: appId(1).toWire(), name: "Alpha" }),
          makeApp({ id: appId(2).toWire(), name: "Beta" }),
        ],
      },
    });
    mocks.deleteApplication.mockResolvedValue({ response: {} });

    await mountPage();
    await flushPromises();
    const store = useApplicationsStore();
    expect(store.applications).toHaveLength(2);

    // Deletion addresses the application by its id, not by a client_id.
    await store.deleteApplication(appId(1));
    expect(mocks.deleteApplication).toHaveBeenCalledWith({
      id: appId(1).toWire(),
    });
    expect(store.applications.map((a) => a.name)).toEqual(["Beta"]);
  });

  it("store.deleteApplication sets error on failure", async () => {
    mocks.deleteApplication.mockRejectedValueOnce(new Error("Forbidden"));
    await mountPage();
    await flushPromises();
    const store = useApplicationsStore();

    try {
      await store.deleteApplication(appId(1));
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
          makeApp(
            { id: appId(1).toWire(), name: "Web App" },
            { type: 1, active: true },
          ),
          makeApp(
            { id: appId(2).toWire(), name: "API App" },
            { type: 3, active: false },
          ),
          makeResourceApp(1, 1),
          makeResourceApp(2, 2),
          makeResourceApp(3, 3),
        ],
      },
    });
    await mountPage();
    await flushPromises();
    const store = useApplicationsStore();
    expect(store.applications).toHaveLength(5);
    expect(store.activeCount).toBe(2);
  });

  // Regression: the list offered Delete on every row, the applications SID
  // itself provisions and keeps (its account pages, this console) included,
  // although their own page hides it and the server refuses it.
  // What is tested: a managed application's row says so and offers no
  // Delete; an ordinary one still does.
  it("offers no delete on an application SID manages", async () => {
    mocks.listApplications.mockResolvedValue({
      response: {
        applications: [
          makeApp({
            id: appId(1).toWire(),
            name: "Account",
            systemIntegration: 1,
          }),
          makeApp({ id: appId(2).toWire(), name: "Notes" }),
        ],
      },
    });
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.findAll('[data-test="delete-application"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-test="managed-application"]')).toHaveLength(
      1,
    );
  });

  it("renders a resource-only application without a client id", async () => {
    mocks.listApplications.mockResolvedValue({
      response: { applications: [makeResourceApp(1, 1)] },
    });
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Resource r1");
  });
});
