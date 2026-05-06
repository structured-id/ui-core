import { describe, it, expect } from "vitest";
import { truncate, maskEmail } from "./formatters";

describe("truncate", () => {
  it("returns original if under max", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  it("truncates with ellipsis", () => {
    expect(truncate("hello world", 6)).toBe("hello\u2026");
  });
  it("handles exact length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });
});

describe("maskEmail", () => {
  it("masks middle of local part", () => {
    expect(maskEmail("alice@example.com")).toBe("a***e@example.com");
  });
  it("handles short local part", () => {
    expect(maskEmail("ab@example.com")).toBe("ab@example.com");
  });
  it("limits mask to 3 stars", () => {
    expect(maskEmail("alexander@example.com")).toBe("a***r@example.com");
  });
});
