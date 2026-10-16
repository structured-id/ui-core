import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import SidPrincipalInput from "./SidPrincipalInput.vue";
import { REQUIRED_FIELD_TEXT } from "../utils/validators";

const stubs = {
  "q-input": defineComponent({
    name: "QInputStub",
    props: ["modelValue", "rules", "lazyRules"],
    template: "<div><slot name='prepend' /><slot name='append' /></div>",
  }),
  "q-icon": { template: "<span />" },
  "q-chip": { template: "<span><slot /></span>" },
};

function input(props: Record<string, unknown> = {}) {
  return mount(SidPrincipalInput, {
    props: { modelValue: "", ...props },
    global: { stubs },
  }).findComponent({ name: "QInputStub" });
}

type Rule = (v: string) => unknown;

describe("SidPrincipalInput", () => {
  // Regression: the identifier turned red while still being typed; it is
  // checked once left, unless a form asks for checking from the start.
  it("validates once left by default", () => {
    expect(input().props("lazyRules")).toBe(true);
    expect(input({ lazyRules: false }).props("lazyRules")).toBe(false);
  });

  // One text for an empty required field, the same the password field uses.
  it("says the shared text of an empty required field", () => {
    const [required] = input().props("rules") as Rule[];
    expect(required("")).toBe(REQUIRED_FIELD_TEXT);
    expect(required("alice")).toBe(true);
    const [custom] = input({ requiredText: "Enter it" }).props(
      "rules",
    ) as Rule[];
    expect(custom("")).toBe("Enter it");
  });

  it("does not require an optional field", () => {
    const [required] = input({ required: false }).props("rules") as Rule[];
    expect(required("")).toBe(true);
  });
});
