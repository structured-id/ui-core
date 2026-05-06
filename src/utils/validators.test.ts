import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  isValidPhone,
  isValidUuid,
  isValidUsername,
  minLength,
  maxLength,
  isRequired,
} from "./validators";

describe("isValidEmail", () => {
  it("accepts valid emails", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("a.b+c@d.co")).toBe(true);
  });
  it("rejects invalid emails", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("noat")).toBe(false);
    expect(isValidEmail("@no-local.com")).toBe(false);
    expect(isValidEmail("spaces in@email.com")).toBe(false);
  });
});

describe("isValidPhone", () => {
  it("accepts E.164 format", () => {
    expect(isValidPhone("+380501234567")).toBe(true);
    expect(isValidPhone("+14155552671")).toBe(true);
  });
  it("rejects non-E.164", () => {
    expect(isValidPhone("0501234567")).toBe(false);
    expect(isValidPhone("+0123")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});

describe("isValidUuid", () => {
  it("accepts valid UUIDs", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUuid("019577A0-2D3E-7B8E-9F1C-4A5B6C7D8E9F")).toBe(true);
  });
  it("rejects invalid UUIDs", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("")).toBe(false);
  });
});

describe("isValidUsername", () => {
  it("accepts valid usernames", () => {
    expect(isValidUsername("alice")).toBe(true);
    expect(isValidUsername("bob-123")).toBe(true);
    expect(isValidUsername("a_b")).toBe(true);
  });
  it("rejects invalid usernames", () => {
    expect(isValidUsername("ab")).toBe(false); // too short
    expect(isValidUsername("has spaces")).toBe(false);
    expect(isValidUsername("special!char")).toBe(false);
  });
});

describe("minLength / maxLength / isRequired", () => {
  it("minLength works", () => {
    expect(minLength("abc", 3)).toBe(true);
    expect(minLength("ab", 3)).toBe(false);
  });
  it("maxLength works", () => {
    expect(maxLength("abc", 3)).toBe(true);
    expect(maxLength("abcd", 3)).toBe(false);
  });
  it("isRequired works", () => {
    expect(isRequired("hello")).toBe(true);
    expect(isRequired("  ")).toBe(false);
    expect(isRequired("")).toBe(false);
  });
});
