// The account's security page adds a passkey to the signed-in account: the
// registration is started at the installation, the device creates the
// passkey, the registration is finished and the list is read again. A
// ceremony the user cancels finishes nothing and reports no success; a
// refusal of the installation is shown. Bug prevented: a page that lists and
// removes passkeys but offers no way to add one, or that reports a passkey
// the installation never stored.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  fetchCredentials: vi.fn(),
  fetchPrincipals: vi.fn(),
  webAuthnRegistrationStart: vi.fn(),
  webAuthnRegistrationFinish: vi.fn(),
  createPasskey: vi.fn(),
  notify: vi.fn(),
}));

const PasskeyError = vi.hoisted(
  () =>
    class PasskeyError extends Error {
      constructor(readonly failure: string) {
        super(failure);
      }
    },
);

vi.mock("@structured-id/ui-core/profile", () => ({
  SecuritySettings: {
    name: "SecuritySettings",
    props: ["credentials"],
    template: "<div><slot name='actions' /></div>",
  },
  WrongCurrentPasswordError: class extends Error {},
  fetchCredentials: api.fetchCredentials,
  fetchPrincipals: api.fetchPrincipals,
  revokeCredential: vi.fn(),
  updateCredentialLabel: vi.fn(),
  useSecurityLevel: () => ({
    securityLabel: { value: "" },
    securityColor: { value: "" },
    securityProgress: { value: 0 },
    factorCount: { value: 0 },
    categories: { value: new Set() },
    recoverabilityLabel: { value: "" },
    recoverabilityColor: { value: "" },
    recoverabilityProgress: { value: 0 },
    recoveryMethods: { value: [] },
  }),
  webAuthnRegistrationStart: api.webAuthnRegistrationStart,
  webAuthnRegistrationFinish: api.webAuthnRegistrationFinish,
}));

vi.mock("@structured-id/ui-core", () => ({
  PasskeyError,
  createPasskey: api.createPasskey,
  refusalMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.mock("quasar", () => ({
  useQuasar: () => ({ notify: api.notify, dialog: vi.fn() }),
}));

vi.mock("src/composables/useAuth", () => ({
  useAuth: () => ({ changePassword: vi.fn(), prewarm: vi.fn() }),
}));

import SecurityPage from "./SecurityPage.vue";

const passthrough = { template: "<div><slot /></div>" };

async function mountPage() {
  const page = mount(SecurityPage, {
    global: {
      stubs: {
        QPage: passthrough,
        QCard: passthrough,
        QCardSection: passthrough,
        QForm: passthrough,
        QInput: true,
        QLinearProgress: true,
        QBtn: {
          props: ["label"],
          emits: ["click"],
          template: "<button @click=\"$emit('click')\">{{ label }}</button>",
        },
      },
    },
  });
  await flushPromises();
  return page;
}

const OPTIONS = new Uint8Array([1]);
const CREATED = new Uint8Array([2]);

describe("SecurityPage, adding a passkey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("PublicKeyCredential", class {});
    api.fetchCredentials.mockResolvedValue([]);
    api.fetchPrincipals.mockResolvedValue([]);
    api.webAuthnRegistrationStart.mockResolvedValue({ options: OPTIONS });
    api.webAuthnRegistrationFinish.mockResolvedValue({});
    api.createPasskey.mockResolvedValue(CREATED);
  });

  it("finishes the registration the device completed and reads the list again", async () => {
    const page = await mountPage();
    expect(api.fetchCredentials).toHaveBeenCalledTimes(1);

    await page.get('[data-test="add-passkey"]').trigger("click");
    await flushPromises();

    expect(api.createPasskey).toHaveBeenCalledWith(OPTIONS);
    expect(api.webAuthnRegistrationFinish).toHaveBeenCalledWith(CREATED);
    expect(api.notify).toHaveBeenCalledWith({
      type: "positive",
      message: "Passkey added",
    });
    expect(api.fetchCredentials).toHaveBeenCalledTimes(2);
    expect(page.find('[data-test="add-passkey-error"]').exists()).toBe(false);
  });

  it("reports no success when the user cancels on the device", async () => {
    api.createPasskey.mockRejectedValue(new PasskeyError("cancelled"));
    const page = await mountPage();

    await page.get('[data-test="add-passkey"]').trigger("click");
    await flushPromises();

    expect(api.webAuthnRegistrationFinish).not.toHaveBeenCalled();
    expect(api.notify).not.toHaveBeenCalled();
    expect(api.fetchCredentials).toHaveBeenCalledTimes(1);
    expect(page.get('[data-test="add-passkey-error"]').text()).toBe(
      "No passkey was added: the request was cancelled or timed out",
    );
  });

  it("shows the installation's refusal and adds nothing", async () => {
    api.webAuthnRegistrationStart.mockRejectedValue(new Error("refused"));
    const page = await mountPage();

    await page.get('[data-test="add-passkey"]').trigger("click");
    await flushPromises();

    expect(api.createPasskey).not.toHaveBeenCalled();
    expect(api.notify).not.toHaveBeenCalled();
    expect(page.get('[data-test="add-passkey-error"]').text()).toBe(
      "The passkey was not added",
    );
  });

  it("offers nothing in a browser without passkeys", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("PublicKeyCredential", undefined);
    const page = await mountPage();
    expect(page.find('[data-test="add-passkey"]').exists()).toBe(false);
  });
});
