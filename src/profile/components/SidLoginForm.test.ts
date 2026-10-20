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
  "q-btn": { template: '<button type="submit"><slot /></button>' },
  "sid-principal-input": defineComponent({
    props: ["modelValue", "disable"],
    emits: ["update:modelValue", "update:principal-type"],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  }),
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

  // Regression: the password turned red on the first keystroke and its empty
  // error read "Required" beside the identifier's "This field is required".
  it("validates the password once left, with the shared required text", () => {
    const w = mountLogin();
    const password = w.findComponent({ name: "QInputStub" });
    const lazy = password.props("lazyRules");
    expect(lazy === "" || lazy === true).toBe(true);
    const [required] = password.props("rules") as ((v: string) => unknown)[];
    expect(required("")).toBe(REQUIRED_FIELD_TEXT);
    expect(required("secret")).toBe(true);
  });
});
