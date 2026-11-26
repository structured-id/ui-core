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

/** The registration mode choice: a test picks a mode by emitting it. */
const ModeChoice = {
  template: "<div />",
  props: ["modelValue", "options"],
  emits: ["update:modelValue"],
};

async function mountPage() {
  const page = mount(EnrollmentPolicyPage, {
    global: {
      plugins: [createPinia()],
      stubs: {
        ...quasarStubs,
        QOptionGroup: ModeChoice,
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

type Page = Awaited<ReturnType<typeof mountPage>>;

async function press(page: Page, label: string) {
  const button = page
    .findAll("button")
    .find((candidate) => candidate.text() === label);
  expect(button, `the ${label} button`).toBeDefined();
  await button!.trigger("click");
  await flushPromises();
}

const save = (page: Page) => press(page, "Save Policy");

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

  // An update replaces the whole policy. While the stored policy was never
  // read the form holds only its own initial values (open, one use, no
  // expiry): saving them would open registration and overwrite the real
  // invite terms. Nothing is sent until a read succeeds; then a mode change
  // keeps the stored terms.
  it("sends nothing until the stored policy is read", async () => {
    mocks.getEnrollmentPolicy.mockRejectedValueOnce(new Error("unavailable"));
    const page = await mountPage();
    expect(page.find('[data-test="policy-unread"]').text()).toContain(
      "unavailable",
    );

    await save(page);
    expect(mocks.updateEnrollmentPolicy).not.toHaveBeenCalled();

    mocks.getEnrollmentPolicy.mockResolvedValue({
      response: stored(EnrollmentMode.INVITE_ONLY),
    });
    mocks.updateEnrollmentPolicy.mockResolvedValue({
      response: stored(EnrollmentMode.ADMIN_ONLY),
    });
    await press(page, "Retry");
    expect(page.find('[data-test="policy-unread"]').exists()).toBe(false);

    page
      .findComponent(ModeChoice)
      .vm.$emit("update:modelValue", EnrollmentMode.ADMIN_ONLY);
    await flushPromises();
    await save(page);

    expect(mocks.updateEnrollmentPolicy).toHaveBeenCalledTimes(1);
    const sent = mocks.updateEnrollmentPolicy.mock.calls[0][0].policy;
    expect(sent.mode).toBe(EnrollmentMode.ADMIN_ONLY);
    expect(sent.invite).toEqual({ defaultMaxUses: 5, defaultExpiryHours: 24 });
  });
});
