import { beforeAll, describe, it, expect, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { initEmail } from "../../utils/email";
import { TEST_PSL } from "../../utils/email.testing";
import { RpcError } from "@protobuf-ts/runtime-rpc";
import { base64encode } from "@protobuf-ts/runtime";
import { Any } from "@structured-id/proto/google/protobuf/any";
import { Status } from "@structured-id/proto/google/rpc/status";
import {
  BadRequest,
  ErrorInfo,
} from "@structured-id/proto/google/rpc/error_details";
import SidRegistrationForm from "./SidRegistrationForm.vue";

// As an application does at start: the email parser loaded, LOCAL namespace.
beforeAll(() => initEmail({ psl: TEST_PSL }));

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
    props: ["modelValue", "error", "errorMessage"],
    emits: ["update:modelValue"],
    // The form re-validates the confirmation through the QInput API.
    methods: { validate: () => true },
    template:
      '<input :value="modelValue" :data-error="error ? errorMessage : undefined" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  "q-btn": {
    props: ["disable"],
    template: '<button type="submit" :disabled="disable"><slot /></button>',
  },
  "sid-password-ceremony": {
    name: "SidPasswordCeremony",
    props: ["outcome", "refusedText", "length", "fields"],
    emits: ["settled"],
    template:
      '<div class="ceremony" :data-outcome="outcome" :data-refused="refusedText" :data-length="length" :data-fields="fields" />',
  },
};

/** A refusal as the gRPC-Web transport raises it, with field violations. */
function refusedFields(
  violations: { field: string; description: string }[],
): RpcError {
  const bad = Any.pack(
    BadRequest.create({
      fieldViolations: violations.map((v) => ({ ...v, reason: "" })),
    }),
    BadRequest,
  );
  const info = Any.pack(
    ErrorInfo.create({
      reason: "INVALID_FIELD_VALUE",
      domain: "structured.id",
      metadata: {},
    }),
    ErrorInfo,
  );
  const status = Status.create({
    code: 3,
    message: "invalid",
    details: [info, bad],
  });
  return new RpcError("invalid", "INVALID_ARGUMENT", {
    "grpc-status-details-bin": base64encode(Status.toBinary(status)),
  });
}

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

  // The registration cannot start until the identifier is a well-formed
  // principal this scenario admits: fewer than three characters are nobody
  // yet, and a username shorter than this registration's minimum, or with a
  // character a username cannot hold, keeps the button disabled too.
  it("cannot register until the identifier is well-formed", async () => {
    const w = mountForm({ claimRequired: false });
    const [principal, password, confirm] = w.findAll("input");
    await password.setValue("Secret-Pass-123");
    await confirm.setValue("Secret-Pass-123");
    for (const [value, disabled] of [
      ["ow", true],
      [" ow ", true],
      ["owner", true],
      ["owner.one", true],
      ["owner_one", false],
      ["owner@example.com", false],
    ] as const) {
      await principal.setValue(value);
      expect(w.find("button").attributes("disabled") !== undefined, value).toBe(
        disabled,
      );
    }
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
  // account is announced only once its closing animation has played, and the
  // form then settles on its success text, without the fields.
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
    await flushPromises();
    expect(w.find(".ceremony").exists()).toBe(false);
    expect(w.text()).toContain("Account created. Signing you in");
    expect(w.find("form").isVisible()).toBe(false);
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

  // An application that draws its own progress keeps the `progress` slot:
  // it replaces the ceremony and receives the progress while the operation
  // runs. The final report comes right before the operation resolves, so
  // the slot keeps it for a painted frame; with no closing animation to wait
  // for, the form then announces the result.
  it("lets a progress slot stand in for the ceremony", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      frames.push(cb),
    );
    const paint = async () => {
      for (const cb of frames.splice(0)) cb(0);
      await flushPromises();
    };
    let report: (p: { fraction: number; label: string }) => void = () => {};
    let finish: () => void = () => {};
    registerFn.mockImplementationOnce(
      (_id, _pw, _extras, onProgress) =>
        new Promise<void>((resolve) => {
          report = onProgress;
          finish = () => {
            onProgress({ fraction: 1, label: "Done" });
            resolve();
          };
        }),
    );
    const w = mount(SidRegistrationForm, {
      props: { registerFn },
      global: { stubs: quasarStubs },
      slots: {
        progress: `<template #progress="{ progress }">
          <div class="own-gauge">{{ progress?.label }}</div>
        </template>`,
      },
    });
    const [principal, password, confirm] = w.findAll("input");
    await principal.setValue("user@example.com");
    await password.setValue("Secret-Pass-123");
    await confirm.setValue("Secret-Pass-123");
    await w.find("form").trigger("submit");

    report({ fraction: 0.4, label: "Building the proof" });
    await flushPromises();
    expect(w.find(".ceremony").exists()).toBe(false);
    expect(w.find(".own-gauge").text()).toBe("Building the proof");

    finish();
    await flushPromises();
    expect(w.find(".own-gauge").text()).toBe("Done");
    expect(w.emitted("success")).toBeUndefined();

    await paint();
    await paint();
    expect(w.emitted("success")).toHaveLength(1);
    expect(w.find(".own-gauge").exists()).toBe(false);
    expect(w.text()).toContain("Account created. Signing you in");
    vi.unstubAllGlobals();
  });

  // A background tab may never run animation frames: the result is still
  // announced, once, after a short timer, so a parent's sign-in or
  // navigation is never held back by a paint that does not come.
  it("announces the result without animation frames", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", () => 0);
    registerFn.mockResolvedValueOnce(undefined);
    const w = mount(SidRegistrationForm, {
      props: { registerFn },
      global: { stubs: quasarStubs },
      slots: { progress: `<div class="own-gauge" />` },
    });
    const [principal, password, confirm] = w.findAll("input");
    await principal.setValue("user@example.com");
    await password.setValue("Secret-Pass-123");
    await confirm.setValue("Secret-Pass-123");
    await w.find("form").trigger("submit");
    await flushPromises();
    expect(w.emitted("success")).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1000);
    expect(w.emitted("success")).toHaveLength(1);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("password rules", () => {
    // A q-input that shows the first rule its value fails, as QInput does.
    const ruleStubs = {
      ...quasarStubs,
      "q-input": {
        props: ["modelValue", "rules"],
        emits: ["update:modelValue"],
        computed: {
          failed(): string {
            const self = this as unknown as {
              modelValue?: string;
              rules?: ((v: string) => true | string)[];
            };
            for (const rule of self.rules ?? []) {
              const result = rule(self.modelValue ?? "");
              if (result !== true) return result;
            }
            return "";
          },
        },
        template:
          '<label><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /><span class="failed">{{ failed }}</span></label>',
      },
    };
    const ceDefault = {
      minLength: 8,
      minUppercase: 1,
      minLowercase: 1,
      minDigit: 1,
      minSymbol: 0,
    };

    async function passwordError(
      value: string,
      passwordPolicyFn: () => Promise<typeof ceDefault>,
    ): Promise<string> {
      const w = mount(SidRegistrationForm, {
        props: { registerFn, passwordPolicyFn, showConfirmPassword: false },
        global: { stubs: ruleStubs },
      });
      await flushPromises();
      const password = w.find('[data-test="password"]');
      await password.find("input").setValue(value);
      return password.find(".failed").text();
    }

    // The rules are the server's policy: an 8-character password with an
    // uppercase letter, a lowercase letter and a digit meets the CE default.
    it("accepts a password that meets the server policy", async () => {
      expect(
        await passwordError("HrenVam1", () => Promise.resolve(ceDefault)),
      ).toBe("");
    });

    // Each minimum names itself: a missing uppercase letter is not reported
    // as a short password.
    it("names the rule a password fails", async () => {
      const policy = () => Promise.resolve(ceDefault);
      expect(await passwordError("hrenvam1", policy)).toBe(
        "At least 1 uppercase letter",
      );
      expect(await passwordError("HrenVamX", policy)).toBe("At least 1 digit");
      expect(await passwordError("HrenVa1", policy)).toBe(
        "At least 8 characters",
      );
    });

    // Symbols are the printable ASCII characters that are not letters or
    // digits, as the proof counts them; a space is not one.
    it("checks the symbol minimum", async () => {
      const policy = () => Promise.resolve({ ...ceDefault, minSymbol: 1 });
      expect(await passwordError("Hren Vam1", policy)).toBe(
        "At least 1 symbol",
      );
      expect(await passwordError("Hren-Vam1", policy)).toBe("");
    });

    // Until the server answers only an empty password is refused: the
    // proof, not the form, enforces the policy.
    it("checks only presence until the policy is known", async () => {
      const never = () => new Promise<typeof ceDefault>(() => {});
      expect(await passwordError("a", never)).toBe("");
      expect(await passwordError("", never)).toBe("This field is required");
    });
  });

  describe("principal", () => {
    function principalInput(props = {}) {
      return mountForm(props).findComponent({ name: "SidPrincipalInput" });
    }

    // The field takes only the types the instance or the scenario admits.
    it("passes the admitted principal types to the field", () => {
      expect(
        principalInput({ principalTypes: ["email"] }).props("types"),
      ).toEqual(["email"]);
      expect(principalInput().props("types")).toEqual([
        "email",
        "phone",
        "username",
      ]);
    });

    // A short username is admitted only in the registration that presents
    // the installation's claim token (its first administrator); an ordinary
    // registration keeps the registration minimum.
    it("admits a short username only with the claim token", () => {
      expect(principalInput().props("minUsernameLength")).toBe(6);
      expect(
        principalInput({ claimRequired: true }).props("minUsernameLength"),
      ).toBe(3);
    });

    // Regression: a refusal that named the identifier field reached the
    // user only as an undecoded banner. It is shown under the field it
    // concerns, and the claim token's under the token.
    it("shows each field violation under its field", async () => {
      registerFn.mockRejectedValueOnce(
        refusedFields([
          { field: "principal", description: "Registration here takes email" },
          {
            field: "claim_token",
            description: "Not this installation's token",
          },
        ]),
      );
      const w = mountForm({ claimRequired: true });
      const [claim, principal, password, confirm] = w.findAll("input");
      await claim.setValue("sidclaim_x");
      await principal.setValue("sid");
      await password.setValue("Secret-Pass-123");
      await confirm.setValue("Secret-Pass-123");
      await w.find("form").trigger("submit");
      await flushPromises();
      w.findComponent({ name: "SidPasswordCeremony" }).vm.$emit(
        "settled",
        "refused",
      );
      await flushPromises();

      const [claimAfter, principalAfter] = w.findAll("input");
      expect(principalAfter.attributes("data-error")).toBe(
        "Registration here takes email",
      );
      expect(claimAfter.attributes("data-error")).toBe(
        "Not this installation's token",
      );
      expect(w.text()).not.toContain("invalid");

      // Editing the field clears what the server said about it.
      await principalAfter.setValue("owner@sid.example.com");
      expect(w.findAll("input")[1].attributes("data-error")).toBeUndefined();
    });

    async function refuse(
      violations: { field: string; description: string }[],
      props = {},
    ) {
      registerFn.mockRejectedValueOnce(refusedFields(violations));
      const w = mountForm(props);
      const [principal, password, confirm] = w.findAll("input");
      await principal.setValue("user@sid.example.com");
      await password.setValue("Secret-Pass-123");
      await confirm.setValue("Secret-Pass-123");
      await w.find("form").trigger("submit");
      await flushPromises();
      w.findComponent({ name: "SidPasswordCeremony" }).vm.$emit(
        "settled",
        "refused",
      );
      await flushPromises();
      return w;
    }

    // Several requirements of one field are all shown at once, not only the
    // last one the server listed.
    it("keeps every violation of one field", async () => {
      const w = await refuse([
        { field: "password", description: "At least 1 digit" },
        { field: "password", description: "At least 1 symbol" },
      ]);
      expect(w.findAll("input")[1].attributes("data-error")).toBe(
        "At least 1 digit; At least 1 symbol",
      );
    });

    // Regression: a refusal bound to the password stayed under it after the
    // password was edited.
    it("clears the password's refusal when the password changes", async () => {
      const w = await refuse([
        { field: "password", description: "Not accepted" },
      ]);
      await w.findAll("input")[1].setValue("Another-Pass-456");
      expect(w.findAll("input")[1].attributes("data-error")).toBeUndefined();
    });

    // A violation of a field the form does not show (the invite code while
    // no invite is asked for) stays in the banner instead of disappearing.
    it("keeps a hidden field's violation in the banner", async () => {
      const w = await refuse([
        { field: "invite_code", description: "This invite has expired" },
      ]);
      expect(w.text()).toContain("This invite has expired");
    });
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
