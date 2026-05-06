import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SidMfaChallenge from "./SidMfaChallenge.vue";
import type { MfaMethod } from "./SidMfaChallenge.vue";

/** Exposed API declared via defineExpose() in SidMfaChallenge.vue. */
interface MfaChallengeExposed {
  setSuccess: () => void;
  setError: (message: string) => void;
  reset: () => void;
}

const quasarStubs = {
  "q-card": { template: "<div><slot /></div>" },
  "q-card-section": { template: "<div><slot /></div>" },
  "q-separator": { template: "<hr />" },
  "q-banner": { template: "<div><slot /></div>" },
  "q-icon": { template: "<span />" },
  "q-list": { template: "<div><slot /></div>" },
  "q-item": {
    template: "<div @click=\"$emit('click')\"><slot /></div>",
    emits: ["click"],
  },
  "q-item-section": { template: "<div><slot /></div>" },
  "q-item-label": { template: "<div><slot /></div>" },
  "q-badge": { template: "<span />" },
  "q-form": {
    template: "<form @submit.prevent=\"$emit('submit')\"><slot /></form>",
    emits: ["submit"],
  },
  "q-input": {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  "q-btn": { template: '<button type="submit"><slot /></button>' },
  "q-spinner-dots": { template: "<span />" },
};

const methods: MfaMethod[] = [
  {
    type: "totp",
    icon: "sym_o_timer",
    label: "Authenticator app",
    description: "Use your TOTP app",
    color: "primary",
    recommended: true,
  },
  {
    type: "webauthn",
    icon: "sym_o_passkey",
    label: "Passkey",
    description: "Use a passkey",
    color: "purple",
  },
  {
    type: "recovery",
    icon: "sym_o_key",
    label: "Recovery code",
    description: "Use a recovery code",
    color: "warning",
  },
];

function mountChallenge(props = {}) {
  return mount(SidMfaChallenge, {
    props: { methods, ...props },
    global: { stubs: quasarStubs },
  });
}

describe("SidMfaChallenge", () => {
  it("renders method selection by default", () => {
    const w = mountChallenge();
    expect(w.text()).toContain("Authenticator app");
    expect(w.text()).toContain("Passkey");
    expect(w.text()).toContain("Recovery code");
  });

  it("renders default title", () => {
    const w = mountChallenge();
    expect(w.text()).toContain("Additional verification required");
  });

  it("renders custom title", () => {
    const w = mountChallenge({ title: "Verify identity" });
    expect(w.text()).toContain("Verify identity");
  });

  it("renders custom reason", () => {
    const w = mountChallenge({ reason: "Deleting your account" });
    expect(w.text()).toContain("Deleting your account");
  });

  it("exposes phase control methods", () => {
    const w = mountChallenge();
    expect(typeof w.vm.setLoading).toBe("function");
    expect(typeof w.vm.setError).toBe("function");
    expect(typeof w.vm.setSuccess).toBe("function");
    expect(typeof w.vm.reset).toBe("function");
  });

  it("setSuccess transitions to success phase", async () => {
    const w = mountChallenge();
    (w.vm as unknown as MfaChallengeExposed).setSuccess();
    await w.vm.$nextTick();
    expect(w.text()).toContain("Verified");
  });

  it("setError shows error banner", async () => {
    const w = mountChallenge();
    (w.vm as unknown as MfaChallengeExposed).setError("Invalid code");
    await w.vm.$nextTick();
    expect(w.text()).toContain("Invalid code");
  });

  it("reset returns to method selection", async () => {
    const w = mountChallenge();
    (w.vm as unknown as MfaChallengeExposed).setSuccess();
    await w.vm.$nextTick();
    expect(w.text()).toContain("Verified");
    (w.vm as unknown as MfaChallengeExposed).reset();
    await w.vm.$nextTick();
    expect(w.text()).toContain("Authenticator app");
  });
});
