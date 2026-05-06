import { describe, it, expect } from "vitest";
import { isIndexedDbAvailable } from "./storage";

describe("isIndexedDbAvailable", () => {
  it("returns false in Node.js environment (no indexedDB global)", () => {
    // Node.js doesn't have indexedDB
    expect(isIndexedDbAvailable()).toBe(false);
  });
});
