import { beforeAll, describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import SidPrincipalInput from "./SidPrincipalInput.vue";
import { principalRecognizable } from "./principalInputTexts";
import { initEmail } from "../utils/email";

// As an application does at start: the email parser loaded, LOCAL namespace.
beforeAll(() => initEmail());

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
  "q-icon": { props: ["name"], template: "<span :data-icon='name' />" },
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

  // Until the input is long enough to be a principal of some type nothing
  // is shown as wrong, an empty field included: the form keeps its button
  // disabled instead.
  it("shows nothing wrong before a type is recognized", () => {
    const [type] = input().props("rules") as Rule[];
    for (const value of ["", "a", "al"]) {
      expect(type(value), JSON.stringify(value)).toBe(true);
    }
  });

  // A field that accepts only some principal types refuses the others before
  // any call, naming what it accepts: a registration that takes email only
  // must not let a username reach the server.
  it("refuses a principal type it does not accept", () => {
    const [type] = input({ types: ["email"] }).props("rules") as Rule[];
    expect(type("alice_wonder")).toBe("Enter an email address");
    expect(type("+380501234567")).toBe("Enter an email address");
    expect(type("alice@sid.example.com")).toBe(true);
    const [two] = input({ types: ["email", "username"] }).props(
      "rules",
    ) as Rule[];
    expect(two("+380501234567")).toBe("Enter an email address or a username");
    expect(two("alice_wonder")).toBe(true);
  });

  // Regression: a username shorter than the minimum was not recognized as a
  // username and the field asked for "email, phone, or username" instead of
  // saying the minimum.
  it("tells a too-short username the minimum length", () => {
    const [type] = input({ minUsernameLength: 6 }).props("rules") as Rule[];
    expect(type("sid")).toBe("A username has at least 6 characters");
    expect(type("sidsid")).toBe(true);
    const [login] = input().props("rules") as Rule[];
    expect(login("sid")).toBe(true);
  });

  // One or two characters are nobody yet: no type is recognized from them,
  // the field stays a login field with the neutral icon, and nothing is
  // shown as wrong (the form only keeps its button disabled).
  it("recognizes no type from fewer than three characters", () => {
    for (const short of ["a", "al", "+3", "a@", "ЩЩ", " a "]) {
      const field = mount(SidPrincipalInput, {
        props: { modelValue: short, types: ["email", "username"] },
        global: { stubs },
      });
      const stub = field.findComponent({ name: "QInputStub" });
      expect(stub.props("label"), short).toBe("Login");
      expect(field.html(), short).toContain('data-icon="sym_o_login"');
      const [type] = stub.props("rules") as Rule[];
      expect(type(short), short).toBe(true);
    }
    expect(principalRecognizable("al")).toBe(false);
    expect(principalRecognizable(" al ")).toBe(false);
    expect(principalRecognizable("ali")).toBe(true);
    expect(principalRecognizable("Щук")).toBe(true);
  });

  // Regression: a username with a letter outside a-z was taken for no type
  // and refused before the server could apply its repertoire; its length is
  // counted in code points of its NFC form, as the server counts it.
  it("takes a username in any script and counts its code points", () => {
    const [type] = input({
      types: ["email", "username"],
      minUsernameLength: 6,
    }).props("rules") as Rule[];
    expect(type("Иван_Петров")).toBe(true);
    expect(type("Щукин")).toBe("A username has at least 6 characters");
    expect(type("Jürgen")).toBe(true); // 7 code points, 6 in NFC
    // Whitespace, inside or around, is refused, not trimmed into a name, and
    // the refusal says what is wrong.
    for (const spaced of ["Иван Петров", " Иван_Петров", "Иван_Петров "]) {
      expect(type(spaced)).toBe("A username cannot contain spaces");
    }
  });

  // Regression: a username with a character it cannot hold (a dot, a dash,
  // a symbol) was taken for no type at all and told to "enter an email
  // address or a username", which names no problem. Input without `@` and
  // `+` is a username attempt, and the refusal names the characters allowed.
  it("tells a username which characters it can hold", () => {
    const [two] = input({ types: ["email", "username"] }).props(
      "rules",
    ) as Rule[];
    for (const odd of ["ali.ce", "ali-ce", "😀😀😀", "alice#acme.corp"]) {
      expect(two(odd)).toBe(
        "A username can contain only letters, digits and underscores",
      );
    }
    // A field that takes no username still asks for what it takes.
    const [email] = input({ types: ["email"] }).props("rules") as Rule[];
    expect(email("ali.ce")).toBe("Enter an email address");
    expect(
      input({ types: ["email", "username"], modelValue: "ali.ce" }).props(
        "label",
      ),
    ).toBe("Username");
  });

  // Regression: the label already names the recognized type, and a chip
  // repeated it beside the icon. The chip is shown only when the form's own
  // label does not name the type.
  it("names the type once", () => {
    const named = mount(SidPrincipalInput, {
      props: { modelValue: "alice@sid.example.com" },
      global: { stubs },
    });
    expect(named.findComponent({ name: "QInputStub" }).props("label")).toBe(
      "Email",
    );
    expect(named.text()).not.toContain("email");
    const own = mount(SidPrincipalInput, {
      props: { modelValue: "alice@sid.example.com", label: "Sign in with" },
      global: { stubs },
    });
    expect(own.text()).toContain("email");
  });

  // Regression: a phone number on a field that takes no phone got the phone
  // icon and chip, as if it were accepted. A type the field refuses shows
  // the neutral login icon and no chip.
  it("does not dress a refused type as accepted", () => {
    const w = mount(SidPrincipalInput, {
      props: {
        modelValue: "+380501234567",
        types: ["email", "username"],
        label: "Sign in with",
      },
      global: { stubs },
    });
    expect(w.html()).toContain('data-icon="sym_o_login"');
    expect(w.text()).not.toContain("phone");
  });

  // Regression: an email-only field showed the generic login icon until an
  // address was typed, beside its "Email" label. A field of one type shows
  // that type's icon from the start, greyed until the input is recognized.
  it("shows a single-type field's icon from the start", () => {
    const empty = mount(SidPrincipalInput, {
      props: { modelValue: "", types: ["email"] },
      global: { stubs },
    });
    expect(empty.html()).toContain('data-icon="sym_o_mail"');
    expect(
      mount(SidPrincipalInput, {
        props: { modelValue: "", types: ["email", "username"] },
        global: { stubs },
      }).html(),
    ).toContain('data-icon="sym_o_login"');
  });

  // The label names the accepted types unless the form gives its own.
  // A field of one type is named by it. A field of several is a login
  // field until the input shows which type it is, then it names that type;
  // a recognized type the field does not accept leaves it a login field.
  it("labels the field by the types it accepts", () => {
    expect(input({ types: ["email"] }).props("label")).toBe("Email");
    expect(input({ types: ["username"] }).props("label")).toBe("Username");
    expect(input().props("label")).toBe("Login");
    const two = { types: ["email", "username"] };
    expect(input(two).props("label")).toBe("Login");
    expect(
      input({ ...two, modelValue: "alice@sid.example.com" }).props("label"),
    ).toBe("Email");
    expect(input({ ...two, modelValue: "alice_wonder" }).props("label")).toBe(
      "Username",
    );
    expect(input({ ...two, modelValue: "+380501234567" }).props("label")).toBe(
      "Login",
    );
    expect(input({ ...two, texts: { login: "Логин" } }).props("label")).toBe(
      "Логин",
    );
    expect(
      input({ types: ["email"], label: "Your email" }).props("label"),
    ).toBe("Your email");
    // An explicitly empty label is the form's choice of no label.
    expect(
      input({ types: ["email", "username"], label: "" }).props("label"),
    ).toBe("");
  });

  // The chip naming the detected type is a text like the others: a
  // translated form does not switch back to English when a type is found.
  it("takes the type chip's text from the texts", () => {
    const w = mount(SidPrincipalInput, {
      props: {
        modelValue: "alice@sid.example.com",
        label: "Sign in with",
        texts: { typeChip: (t: string) => `chip:${t}` },
      },
      global: { stubs },
    });
    expect(w.text()).toContain("chip:email");
  });

  // The form disables its submit on this, before any error is shown: only a
  // recognized, accepted, well-formed value, not refused by the server, is
  // valid.
  it("tells the form whether the value can be submitted", () => {
    const valid = (props: { modelValue: string; fieldError?: string }) => {
      const w = mount(SidPrincipalInput, {
        props: { types: ["email", "username"], ...props },
        global: { stubs },
      });
      return w.emitted("update:valid")?.at(-1)?.[0];
    };
    expect(valid({ modelValue: "" })).toBe(false);
    expect(valid({ modelValue: "al" })).toBe(false);
    expect(valid({ modelValue: "ali" })).toBe(true);
    expect(valid({ modelValue: "ali.ce" })).toBe(false);
    expect(valid({ modelValue: "+380501234567" })).toBe(false);
    expect(valid({ modelValue: "alice@" })).toBe(false);
    expect(valid({ modelValue: "alice@sid.example.com" })).toBe(true);
    expect(
      valid({ modelValue: "alice@sid.example.com", fieldError: "Taken" }),
    ).toBe(false);
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
