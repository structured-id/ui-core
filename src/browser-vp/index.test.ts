import { describe, it, expect } from "vitest";
import { detectStrategy } from "./index";

describe("detectStrategy", () => {
  it("returns null when window is undefined (Node.js)", async () => {
    // Node.js has no window global
    const result = await detectStrategy();
    expect(result).toBeNull();
  });
});
