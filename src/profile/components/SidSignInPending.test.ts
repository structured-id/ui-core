import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SidSignInPending from "./SidSignInPending.vue";

const stubs = {
  "q-card": { template: "<div><slot /></div>" },
  "q-card-section": { template: "<div><slot /></div>" },
  "q-separator": { template: "<hr />" },
  "q-skeleton": { template: "<i class='skeleton' />" },
  "q-banner": { template: "<div><slot /><slot name='action' /></div>" },
  "q-btn": {
    props: ["label"],
    emits: ["click"],
    template: "<button @click=\"$emit('click')\">{{ label }}</button>",
  },
};

function shown(props: { failed?: boolean } = {}) {
  return mount(SidSignInPending, {
    props,
    global: { stubs },
    slots: { footer: "<p>Or sign in with a partner</p>" },
  });
}

describe("SidSignInPending", () => {
  // What is tested: while the issuer's offer is awaited the card holds
  // placeholders, no input and no failure, and keeps its footer.
  // Bug prevented: a sign-in field shown before the issuer stated a method.
  it("waits with placeholders and no sign-in field", () => {
    const w = shown();
    expect(w.findAll(".skeleton").length).toBeGreaterThan(0);
    expect(w.find("input").exists()).toBe(false);
    expect(w.find('[data-test="sign-in-offer-failed"]').exists()).toBe(false);
    expect(w.text()).toContain("Or sign in with a partner");
  });

  // What is tested: an issuer that did not answer gets the failure, a retry
  // that reports itself, and still the footer.
  // Bug prevented: a failed page that looks as if it were still loading and
  // offers no way on.
  it("says the options could not be loaded and offers a retry", async () => {
    const w = shown({ failed: true });
    expect(w.findAll(".skeleton")).toHaveLength(0);
    expect(w.text()).toContain("The sign-in options could not be loaded.");
    await w.find("button").trigger("click");
    expect(w.emitted("retry")).toHaveLength(1);
    expect(w.text()).toContain("Or sign in with a partner");
  });
});
