import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({
  listApplications: vi.fn().mockResolvedValue({
    response: { applications: [] },
  }),
  getApplication: vi.fn(),
}));

vi.mock("@structured-id/ui-core", () => ({
  getAccountTransport: () => ({}),
}));

vi.mock("@structured-id/proto/sid/v1/projects/projects.client", () => ({
  ProjectServiceClient: class {
    listApplications = mocks.listApplications;
    getApplication = mocks.getApplication;
  },
}));

vi.mock("quasar", () => ({
  useQuasar: () => ({ notify: vi.fn() }),
  copyToClipboard: vi.fn(),
}));

import { createRouter, createMemoryHistory } from "vue-router";
import ApplicationDetailPage from "./ApplicationDetailPage.vue";
import { quasarStubs } from "#admin/test-utils/quasar-stubs";

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/admin/applications",
        name: "admin-applications",
        component: { template: "<div />" },
      },
      {
        path: "/admin/applications/:id",
        name: "admin-application-detail",
        component: ApplicationDetailPage,
      },
    ],
  });
  await router.push(path);
  await router.isReady();
  return mount(ApplicationDetailPage, {
    global: {
      plugins: [createPinia(), router],
      stubs: {
        ...quasarStubs,
        RouterLink: { template: "<a><slot /></a>" },
        ClientAccessPanel: { template: "<div />" },
      },
      directives: { "close-popup": () => {} },
    },
  });
}

describe("ApplicationDetailPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: an address whose last part is no application identifier
  // threw out of the page's mount, leaving an empty page and an error in
  // the log.
  // What is tested: the page says the address names no application and
  // asks the server for none.
  it("says an address that names no application", async () => {
    const wrapper = await mountAt("/admin/applications/not-an-identifier");
    await flushPromises();
    expect(wrapper.text()).toContain("This address names no application.");
    expect(mocks.getApplication).not.toHaveBeenCalled();
  });
});
