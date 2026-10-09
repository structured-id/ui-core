import { describe, it, expect, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import SidRegistrationForm from "./SidRegistrationForm.vue";

const quasarStubs = {
  "q-card": { template: "<div><slot /></div>" },
  "q-card-section": { template: "<div><slot /></div>" },
  "q-separator": { template: "<hr />" },
  "q-banner": { template: "<div><slot /></div>" },
  "q-icon": { template: "<span />" },
  "q-chip": { template: "<span />" },
  "q-form": {
    // QForm emits submit with the DOM event; the form's .prevent needs it.
    template:
      "<form @submit.prevent=\"$emit('submit', $event)\"><slot /></form>",
    emits: ["submit"],
  },
  "q-input": {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  "q-btn": { template: '<button type="submit"><slot /></button>' },
  "sid-password-ceremony": {
    name: "SidPasswordCeremony",
    props: ["outcome", "refusedText", "length", "fields"],
    emits: ["settled"],
    template:
      '<div class="ceremony" :data-outcome="outcome" :data-refused="refusedText" :data-length="length" :data-fields="fields" />',
  },
  "sid-principal-input": {
    props: ["modelValue", "disable", "label"],
    emits: ["update:modelValue", "update:principal-type"],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
};

const registerFn = vi.fn().mockResolvedValue(undefined);

function mountForm(props = {}) {
  return mount(SidRegistrationForm, {
    props: { registerFn, ...props },
    global: { stubs: quasarStubs },
  });
}

describe("SidRegistrationForm", () => {
  it("renders with default title", () => {
    const w = mountForm();
    expect(w.text()).toContain("Create account");
  });

  it("renders custom title", () => {
    const w = mountForm({ title: "Join us" });
    expect(w.text()).toContain("Join us");
  });

  it("shows invite warning when required and no code", () => {
    const w = mountForm({ inviteRequired: true });
    expect(w.text()).toContain("Registration requires an invite code");
  });

  it("hides invite field when not required and no code", () => {
    const w = mountForm({ inviteRequired: false });
    expect(w.text()).not.toContain("Invite code");
  });

  it("shows invite field when code provided", () => {
    const w = mountForm({ initialInviteCode: "ABCD1234" });
    // showInviteField computed = true when code exists → invite input rendered
    // q-input stub renders as <input>, look for it in the rendered HTML
    const inputs = w.findAll("input");
    // At minimum: invite, principal, password, confirm = 4 inputs.
    // (given_name dropped — handled via OrgClaimPolicy after first login.)
    expect(inputs.length).toBeGreaterThanOrEqual(4);
  });

  // While the installation has no administrator the claim token is the only
  // admission: the form asks for it and never for an invite code.
  it("asks for the claim token instead of an invite while unclaimed", () => {
    const w = mountForm({ claimRequired: true, inviteRequired: true });
    expect(w.text()).toContain("This installation has no administrator yet");
    expect(w.text()).not.toContain("Registration requires an invite code");
    // claim token, principal, password, confirm; no invite field
    expect(w.findAll("input")).toHaveLength(4);
  });

  it("does not ask for the claim token once claimed", () => {
    const w = mountForm({ claimRequired: false });
    expect(w.text()).not.toContain(
      "This installation has no administrator yet",
    );
    // principal, password, confirm
    expect(w.findAll("input")).toHaveLength(3);
  });

  // The ceremony folds as many rows as the form had password fields.
  it("gives the ceremony the form's password fields", async () => {
    for (const [showConfirmPassword, fields] of [
      [true, "2"],
      [false, "1"],
    ] as const) {
      const w = mountForm({ claimRequired: false, showConfirmPassword });
      const inputs = w.findAll("input");
      await inputs[0].setValue("owner@example.com");
      for (const input of inputs.slice(1))
        await input.setValue("Secret-Pass-123");
      await w.find("form").trigger("submit");
      await flushPromises();
      expect(w.find(".ceremony").attributes("data-fields")).toBe(fields);
    }
  });

  // The pasted token reaches registerFn trimmed, and no invite code with it.
  it("submits the trimmed claim token", async () => {
    registerFn.mockClear();
    const w = mountForm({ claimRequired: true });
    const [claim, principal, password, confirm] = w.findAll("input");
    await claim.setValue("  sidclaim_abc \n");
    await principal.setValue("owner@example.com");
    await password.setValue("Secret-Pass-123");
    await confirm.setValue("Secret-Pass-123");
    await w.find("form").trigger("submit");

    expect(registerFn).toHaveBeenCalledWith(
      "owner@example.com",
      "Secret-Pass-123",
      { claimToken: "sidclaim_abc" },
      expect.any(Function),
    );
  });

  it("submits the invite code when the installation is claimed", async () => {
    registerFn.mockClear();
    const w = mountForm({ initialInviteCode: "ABCD1234" });
    const [, principal, password, confirm] = w.findAll("input");
    await principal.setValue("user@example.com");
    await password.setValue("Secret-Pass-123");
    await confirm.setValue("Secret-Pass-123");
    await w.find("form").trigger("submit");

    expect(registerFn).toHaveBeenCalledWith(
      "user@example.com",
      "Secret-Pass-123",
      { inviteCode: "ABCD1234" },
      expect.any(Function),
    );
  });

  // While the registration runs the ceremony stands in for the fields; the
  // account is announced only once its closing animation has played.
  it("shows the ceremony and announces success after it settles", async () => {
    let finish: () => void = () => {};
    registerFn.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const w = mountForm();
    const [principal, password, confirm] = w.findAll("input");
    await principal.setValue("user@example.com");
    await password.setValue("Secret-Pass-123");
    await confirm.setValue("Secret-Pass-123");
    await w.find("form").trigger("submit");

    const ceremony = w.find(".ceremony");
    expect(ceremony.attributes("data-outcome")).toBe("running");
    expect(ceremony.attributes("data-length")).toBe("15");
    expect(w.find("form").isVisible()).toBe(false);

    finish();
    await flushPromises();
    expect(w.find(".ceremony").attributes("data-outcome")).toBe("accepted");
    expect(w.emitted("success")).toBeUndefined();
    w.findComponent({ name: "SidPasswordCeremony" }).vm.$emit(
      "settled",
      "accepted",
    );
    expect(w.emitted("success")).toHaveLength(1);
  });

  // A refusal names its reason in the ceremony, then gives the fields back
  // with the reason above them.
  it("gives the fields back with the reason after a refusal", async () => {
    registerFn.mockRejectedValueOnce(new Error("This identifier is taken"));
    const w = mountForm();
    const [principal, password, confirm] = w.findAll("input");
    await principal.setValue("user@example.com");
    await password.setValue("Secret-Pass-123");
    await confirm.setValue("Secret-Pass-123");
    await w.find("form").trigger("submit");
    await flushPromises();

    const ceremony = w.find(".ceremony");
    expect(ceremony.attributes("data-outcome")).toBe("refused");
    expect(ceremony.attributes("data-refused")).toBe(
      "This identifier is taken",
    );
    w.findComponent({ name: "SidPasswordCeremony" }).vm.$emit(
      "settled",
      "refused",
    );
    await flushPromises();
    expect(w.find(".ceremony").exists()).toBe(false);
    expect(w.find("form").isVisible()).toBe(true);
    expect(w.text()).toContain("This identifier is taken");
    expect(w.emitted("error")).toHaveLength(1);
  });

  it("renders footer slot", () => {
    const w = mount(SidRegistrationForm, {
      props: { registerFn },
      global: { stubs: quasarStubs },
      slots: { footer: "<div>Sign in instead</div>" },
    });
    expect(w.text()).toContain("Sign in instead");
  });
});
