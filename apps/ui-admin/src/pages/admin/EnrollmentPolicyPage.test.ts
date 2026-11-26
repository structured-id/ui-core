import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

// The page's only boundary is the enrollment client.
const mocks = vi.hoisted(() => ({
  getEnrollmentPolicy: vi.fn(),
  updateEnrollmentPolicy: vi.fn(),
  listInvites: vi.fn().mockResolvedValue({
    response: { invites: [], nextPageToken: "", totalCount: 0 },
  }),
  getRegistrationStats: vi.fn().mockResolvedValue({ response: {} }),
}));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/admin/enrollment.client", () => ({
  EnrollmentServiceClient: class {
    getEnrollmentPolicy = mocks.getEnrollmentPolicy;
    updateEnrollmentPolicy = mocks.updateEnrollmentPolicy;
    listInvites = mocks.listInvites;
    getRegistrationStats = mocks.getRegistrationStats;
  },
}));

vi.mock("quasar", () => ({
  useQuasar: () => ({ notify: vi.fn(), dialog: vi.fn() }),
  copyToClipboard: vi.fn(),
}));

import EnrollmentPolicyPage from "./EnrollmentPolicyPage.vue";
import { EnrollmentMode } from "#admin/stores/enrollment";
import { quasarStubs } from "#admin/test-utils/quasar-stubs";

/** The policy as the installation stores it: the invite defaults are kept in every mode. */
function stored(mode: EnrollmentMode) {
  return {
    mode,
    invite: { defaultMaxUses: 5, defaultExpiryHours: 24 },
    allowedDomains: [],
    trackSource: true,
  };
}

async function mountPage() {
  const page = mount(EnrollmentPolicyPage, {
    global: {
      plugins: [createPinia()],
      stubs: {
        ...quasarStubs,
        QOptionGroup: { template: "<div />", props: ["modelValue", "options"] },
        QTabs: { template: "<div><slot /></div>" },
        QTab: { template: "<div />" },
        QSpace: { template: "<div />" },
        QBtnToggle: { template: "<div />", props: ["modelValue", "options"] },
        QAvatar: { template: "<div><slot /></div>" },
        QExpansionItem: { template: "<div><slot /></div>" },
      },
      directives: { "close-popup": () => {} },
    },
  });
  await flushPromises();
  return page;
}

async function save(page: Awaited<ReturnType<typeof mountPage>>) {
  const button = page
    .findAll("button")
    .find((candidate) => candidate.text() === "Save Policy");
  expect(button, "the Save Policy button").toBeDefined();
  await button!.trigger("click");
  await flushPromises();
}

describe("EnrollmentPolicyPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // The installation refuses a policy without its invite defaults (they are
  // kept across modes, never read as a default). The page sent them only in
  // invite-only mode, so no other mode could be saved from the console.
  it.each([
    ["open", EnrollmentMode.OPEN],
    ["admin-only", EnrollmentMode.ADMIN_ONLY],
    ["invite-only", EnrollmentMode.INVITE_ONLY],
  ])("saves a %s policy with its invite defaults", async (_name, mode) => {
    mocks.getEnrollmentPolicy.mockResolvedValue({ response: stored(mode) });
    mocks.updateEnrollmentPolicy.mockResolvedValue({ response: stored(mode) });
    const page = await mountPage();

    await save(page);

    expect(mocks.updateEnrollmentPolicy).toHaveBeenCalledTimes(1);
    const sent = mocks.updateEnrollmentPolicy.mock.calls[0][0].policy;
    expect(sent.mode).toBe(mode);
    expect(sent.invite).toEqual({ defaultMaxUses: 5, defaultExpiryHours: 24 });
  });
});
