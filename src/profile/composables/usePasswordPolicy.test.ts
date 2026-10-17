import { describe, it, expect } from "vitest";
import { flushPromises } from "@vue/test-utils";
import {
  defaultPasswordRuleText,
  failedPasswordRule,
  usePasswordPolicy,
} from "./usePasswordPolicy";

const ceDefault = {
  minLength: 8,
  minUppercase: 1,
  minLowercase: 1,
  minDigit: 1,
  minSymbol: 0,
};

describe("failedPasswordRule", () => {
  it("passes a password that meets every minimum", () => {
    expect(failedPasswordRule("HrenVam1", ceDefault)).toBeNull();
  });

  // The first failed minimum is reported, in a fixed order, with the
  // policy's number for it.
  it("reports the first failed minimum with its number", () => {
    expect(failedPasswordRule("hV1", ceDefault)).toEqual({
      rule: "length",
      count: 8,
    });
    expect(failedPasswordRule("hrenvam1", ceDefault)).toEqual({
      rule: "uppercase",
      count: 1,
    });
    expect(failedPasswordRule("HRENVAM1", ceDefault)).toEqual({
      rule: "lowercase",
      count: 1,
    });
    expect(failedPasswordRule("HrenVamX", ceDefault)).toEqual({
      rule: "digit",
      count: 1,
    });
  });

  // Counts, not presence: a minimum of 2 needs two of the class.
  it("counts the characters of a class", () => {
    const policy = { ...ceDefault, minDigit: 2 };
    expect(failedPasswordRule("HrenVam1", policy)?.rule).toBe("digit");
    expect(failedPasswordRule("HrenVam12", policy)).toBeNull();
  });

  // The proof's classes are ASCII: a non-ASCII letter is none of them, a
  // space is not a symbol, and every other printable ASCII non-alphanumeric
  // character is.
  it("classifies characters as the proof does", () => {
    const policy = {
      minLength: 0,
      minUppercase: 0,
      minLowercase: 0,
      minDigit: 0,
      minSymbol: 1,
    };
    expect(failedPasswordRule(" ", policy)?.rule).toBe("symbol");
    expect(failedPasswordRule("Ж", policy)?.rule).toBe("symbol");
    for (const symbol of "!/:@[`{~") {
      expect(failedPasswordRule(symbol, policy)).toBeNull();
    }
    expect(
      failedPasswordRule("ЖЖЖЖЖЖЖЖ", { ...ceDefault, minLength: 8 })?.rule,
    ).toBe("uppercase");
  });

  // Length counts characters, so a character outside the BMP is one.
  it("counts length in characters", () => {
    const policy = { ...ceDefault, minUppercase: 0, minDigit: 0, minLength: 3 };
    expect(failedPasswordRule("a😀b", policy)).toBeNull();
    expect(failedPasswordRule("a😀", policy)?.rule).toBe("length");
  });
});

describe("defaultPasswordRuleText", () => {
  it("names the rule and its number", () => {
    expect(defaultPasswordRuleText("length", 8)).toBe("At least 8 characters");
    expect(defaultPasswordRuleText("uppercase", 1)).toBe(
      "At least 1 uppercase letter",
    );
    expect(defaultPasswordRuleText("lowercase", 2)).toBe(
      "At least 2 lowercase letters",
    );
    expect(defaultPasswordRuleText("digit", 2)).toBe("At least 2 digits");
    expect(defaultPasswordRuleText("symbol", 1)).toBe("At least 1 symbol");
  });
});

describe("usePasswordPolicy", () => {
  it("holds the policy once loaded", async () => {
    const { policy } = usePasswordPolicy(() => Promise.resolve(ceDefault));
    expect(policy.value).toBeNull();
    await flushPromises();
    expect(policy.value).toEqual(ceDefault);
  });

  // A policy that cannot be loaded leaves the checks to the server.
  it("stays unknown when the policy cannot be loaded", async () => {
    const { policy } = usePasswordPolicy(() =>
      Promise.reject(new Error("unavailable")),
    );
    await flushPromises();
    expect(policy.value).toBeNull();
  });
});
