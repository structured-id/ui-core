import { describe, it, expect } from "vitest";
import { needsRenewal } from "./vp";
import type { BindingEntry } from "./types";

function makeBinding(certExpiry: Date): BindingEntry {
  return {
    bindingId: "bind_test",
    bindingIndex: 0,
    certChain: new ArrayBuffer(0),
    certExpiry,
    lastUsedAt: new Date(),
  };
}

describe("needsRenewal", () => {
  it("returns true when cert expires in less than 7 days", () => {
    const sixDays = Date.now() + 6 * 24 * 60 * 60 * 1000;
    expect(needsRenewal(makeBinding(new Date(sixDays)))).toBe(true);
  });

  it("returns true when cert is already expired", () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    expect(needsRenewal(makeBinding(new Date(yesterday)))).toBe(true);
  });

  it("returns false when cert expires in more than 7 days", () => {
    const eightDays = Date.now() + 8 * 24 * 60 * 60 * 1000;
    expect(needsRenewal(makeBinding(new Date(eightDays)))).toBe(false);
  });

  it("returns true at exactly 7 days boundary", () => {
    // At exactly 7 days, difference < 7 days in ms because of execution time
    // At exactly 7 days, could be true or false depending on execution timing.
    // We test just under 7 days to be deterministic.
    const justUnder = Date.now() + 7 * 24 * 60 * 60 * 1000 - 1000;
    expect(needsRenewal(makeBinding(new Date(justUnder)))).toBe(true);
  });

  it("returns false for far-future expiry", () => {
    const oneYear = Date.now() + 365 * 24 * 60 * 60 * 1000;
    expect(needsRenewal(makeBinding(new Date(oneYear)))).toBe(false);
  });
});
