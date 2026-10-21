import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import SidLoginForm from "./SidLoginForm.vue";
import { REQUIRED_FIELD_TEXT } from "../../utils/validators";

// Stub all Quasar components as divs
const quasarStubs = {
  "q-card": { template: "<div><slot /></div>" },
  "q-card-section": { template: "<div><slot /></div>" },
  "q-separator": { template: "<hr />" },
  "q-banner": { template: "<div><slot /></div>" },
  "q-linear-progress": { template: "<div />" },
  "q-icon": { template: "<span />" },
  "q-form": {
    template: "<form @submit.prevent=\"$emit('submit')\"><slot /></form>",
    emits: ["submit"],
  },
  "q-input": defineComponent({
    name: "QInputStub",
    props: ["modelValue", "type", "label", "disable", "rules", "lazyRules"],
    emits: ["update:modelValue"],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  }),
  "q-btn": {
    props: ["disable"],
    template: '<button type="submit" :disabled="disable"><slot /></button>',
  },
  "q-chip": { template: "<span><slot /></span>" },
  "router-link": { template: "<a><slot /></a>" },
};

const loginFn = vi.fn().mockResolvedValue({
  accessToken: "tok",
  expiresIn: 3600,
  sessionId: "sess-1",
});

function mountLogin(props = {}) {
  return mount(SidLoginForm, {
    props: { loginFn, ...props },
    global: { stubs: quasarStubs },
  });
}

describe("SidLoginForm", () => {
  it("renders with default title", () => {
    const w = mountLogin();
    expect(w.text()).toContain("Sign in");
  });

  it("renders custom title via prop", () => {
    const w = mountLogin({ title: "Welcome back" });
    expect(w.text()).toContain("Welcome back");
  });

  it("renders header slot", () => {
    const w = mount(SidLoginForm, {
      props: { loginFn },
      global: { stubs: quasarStubs },
      slots: { header: "<div>Custom Header</div>" },
    });
    expect(w.text()).toContain("Custom Header");
  });

  it("renders footer slot", () => {
    const w = mount(SidLoginForm, {
      props: { loginFn },
      global: { stubs: quasarStubs },
      slots: { footer: "<div>Custom Footer</div>" },
    });
    expect(w.text()).toContain("Custom Footer");
  });

  it("shows zero-knowledge explainer", () => {
    const w = mountLogin();
    expect(w.text()).toContain("Your password never leaves this device");
  });

  // The default subtitle names only the types the field accepts: a form
  // restricted to email must not invite a phone or a username.
  it("names the accepted types in the default subtitle", () => {
    expect(mountLogin().text()).toContain(
      "Enter your email, phone, or username to continue",
    );
    expect(mountLogin({ principalTypes: ["email"] }).text()).toContain(
      "Enter your email to continue",
    );
    expect(
      mountLogin({ principalTypes: ["email"], subtitle: "Hello" }).text(),
    ).toContain("Hello");
  });

  // Fewer than three characters are nobody yet: the form cannot sign in
  // with them, so its button stays disabled until a third is typed.
  it("cannot sign in with fewer than three characters", async () => {
    const w = mountLogin();
    const [principal, password] = w.findAll("input");
    await password.setValue("secret");
    for (const [value, disabled] of [
      ["al", true],
      [" al ", true],
      ["ali", false],
    ] as const) {
      await principal.setValue(value);
      expect(w.find("button").attributes("disabled") !== undefined, value).toBe(
        disabled,
      );
    }
  });

  // Regression: with "ali.ce" shown as not a username the button was still
  // enabled, since the form only counted characters. It stays disabled until
  // the identifier is a well-formed principal of an accepted type, without
  // waiting for the field's error to appear.
  it("cannot sign in until the identifier is well-formed", async () => {
    const w = mountLogin({ principalTypes: ["email", "username"] });
    const [principal, password] = w.findAll("input");
    await password.setValue("secret");
    for (const [value, disabled] of [
      ["ali", false],
      ["ali.ce", true],
      ["ali ce", true],
      ["+380501234567", true],
      ["alice@", true],
      ["alice@sid.example.com", false],
    ] as const) {
      await principal.setValue(value);
      expect(w.find("button").attributes("disabled") !== undefined, value).toBe(
        disabled,
      );
    }
  });

  // Regression: the password turned red on the first keystroke and its empty
  // error read "Required" beside the identifier's "This field is required".
  it("validates the password once left, with the shared required text", () => {
    const w = mountLogin();
    const password = w.findAllComponents({ name: "QInputStub" })[1];
    const lazy = password.props("lazyRules");
    expect(lazy === "" || lazy === true).toBe(true);
    const [required] = password.props("rules") as ((v: string) => unknown)[];
    expect(required("")).toBe(REQUIRED_FIELD_TEXT);
    expect(required("secret")).toBe(true);
  });
});
