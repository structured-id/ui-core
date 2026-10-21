import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import SidPrincipalInput from "./SidPrincipalInput.vue";
import { REQUIRED_FIELD_TEXT } from "../utils/validators";

const stubs = {
  "q-input": defineComponent({
    name: "QInputStub",
    props: [
      "modelValue",
      "rules",
      "lazyRules",
      "label",
      "error",
      "errorMessage",
    ],
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

  // A field that accepts only some principal types refuses the others before
  // any call, naming what it accepts: a registration that takes email only
  // must not let a username reach the server.
  it("refuses a principal type it does not accept", () => {
    const [, type] = input({ types: ["email"] }).props("rules") as Rule[];
    expect(type("alice_wonder")).toBe("Enter an email address");
    expect(type("+380501234567")).toBe("Enter an email address");
    expect(type("alice@sid.example.com")).toBe(true);
    const [, two] = input({ types: ["email", "username"] }).props(
      "rules",
    ) as Rule[];
    expect(two("+380501234567")).toBe("Enter an email address or a username");
    expect(two("alice_wonder")).toBe(true);
  });

  // Regression: a username shorter than the minimum was not recognized as a
  // username and the field asked for "email, phone, or username" instead of
  // saying the minimum.
  it("tells a too-short username the minimum length", () => {
    const [, type] = input({ minUsernameLength: 6 }).props("rules") as Rule[];
    expect(type("sid")).toBe("A username has at least 6 characters");
    expect(type("sidsid")).toBe(true);
    const [, login] = input().props("rules") as Rule[];
    expect(login("sid")).toBe(true);
    expect(login("si")).toBe("A username has at least 3 characters");
  });

  // Regression: a username with a letter outside a-z was taken for no type
  // and refused before the server could apply its repertoire; its length is
  // counted in code points of its NFC form, as the server counts it.
  it("takes a username in any script and counts its code points", () => {
    const [, type] = input({
      types: ["email", "username"],
      minUsernameLength: 6,
    }).props("rules") as Rule[];
    expect(type("Иван_Петров")).toBe(true);
    expect(type("Щукин")).toBe("A username has at least 6 characters");
    expect(type("Jürgen")).toBe(true); // 7 code points, 6 in NFC
    expect(type("Иван Петров")).toBe("Enter an email address or a username");
  });

  // The label names the accepted types unless the form gives its own.
  it("labels the field by the types it accepts", () => {
    expect(input().props("label")).toBe("Email, phone, or username");
    expect(input({ types: ["email"] }).props("label")).toBe("Email");
    expect(input({ types: ["email", "username"] }).props("label")).toBe(
      "Email or username",
    );
    expect(
      input({ types: ["email"], label: "Your email" }).props("label"),
    ).toBe("Your email");
  });

  // The chip naming the detected type is a text like the others: a
  // translated form does not switch back to English when a type is found.
  it("takes the type chip's text from the texts", () => {
    const w = mount(SidPrincipalInput, {
      props: {
        modelValue: "alice@sid.example.com",
        texts: { typeChip: (t: string) => `chip:${t}` },
      },
      global: { stubs },
    });
    expect(w.text()).toContain("chip:email");
  });

  // A refusal the server bound to this field is shown on it.
  it("shows an error given from outside", () => {
    const shown = input({
      fieldError: "Registration here takes an email address",
    });
    expect(shown.props("error")).toBe(true);
    expect(shown.props("errorMessage")).toBe(
      "Registration here takes an email address",
    );
    expect(input().props("error")).toBe(false);
  });
});
