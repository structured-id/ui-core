import { describe, it, expect } from "vitest";
import { detectLoginInputType, normalizePrincipal } from "./normalizePrincipal";

describe("detectLoginInputType", () => {
  it("detects email", () => {
    expect(detectLoginInputType("alice@example.com")).toBe("email");
    expect(detectLoginInputType("user+tag@mail.co")).toBe("email");
  });

  it("detects phone", () => {
    expect(detectLoginInputType("+380501234567")).toBe("phone");
    expect(detectLoginInputType("+1555")).toBe("phone");
  });

  it("detects username (default minLength=3)", () => {
    expect(detectLoginInputType("sid")).toBe("username");
    expect(detectLoginInputType("alice")).toBe("username");
    expect(detectLoginInputType("bob_smith")).toBe("username");
    expect(detectLoginInputType("dev42")).toBe("username");
    // Uppercase accepted in detection (will be lowercased on normalize)
    expect(detectLoginInputType("Admin123")).toBe("username");
  });

  it("detects username with minLength=6 (registration)", () => {
    expect(detectLoginInputType("alice", 6)).toBe("unknown"); // too short
    expect(detectLoginInputType("alicew", 6)).toBe("username"); // exactly 6
    expect(detectLoginInputType("alice_wonder", 6)).toBe("username");
  });

  it("rejects usernames starting/ending with underscore", () => {
    expect(detectLoginInputType("_alice")).toBe("unknown");
    expect(detectLoginInputType("alice_")).toBe("unknown");
  });

  it("accepts digits in username (arch allows ^[a-z0-9_])", () => {
    expect(detectLoginInputType("1abc")).toBe("username"); // digit start is OK per arch
    expect(detectLoginInputType("42dev")).toBe("username");
  });

  it("rejects username exceeding max length (32)", () => {
    const long = "a".repeat(33);
    expect(detectLoginInputType(long)).toBe("unknown");
    // Exactly 32 is OK
    expect(detectLoginInputType("a".repeat(32))).toBe("username");
  });

  it("returns unknown for empty or whitespace input", () => {
    expect(detectLoginInputType("")).toBe("unknown");
    expect(detectLoginInputType("  ")).toBe("unknown");
    expect(detectLoginInputType("ab")).toBe("unknown"); // too short (default min=3)
  });

  it("phone takes priority over username for +", () => {
    expect(detectLoginInputType("+abc")).toBe("phone");
  });

  it("email takes priority for @", () => {
    expect(detectLoginInputType("a@b")).toBe("email");
  });

  // ── Federated username (user#domain) ──

  it("detects federated username", () => {
    expect(detectLoginInputType("alice#acme.corp")).toBe("username");
    expect(detectLoginInputType("bob#example.com")).toBe("username");
    expect(detectLoginInputType("dev42#internal.net")).toBe("username");
  });

  it("detects federated username with uppercase", () => {
    expect(detectLoginInputType("Alice#Acme.Corp")).toBe("username");
  });

  it("accepts short login part in federated username (org admin decides)", () => {
    expect(detectLoginInputType("ab#acme.corp")).toBe("username"); // 2 chars OK
    expect(detectLoginInputType("a#acme.corp")).toBe("username"); // 1 char OK
  });

  it("rejects federated username with empty login part", () => {
    expect(detectLoginInputType("#acme.corp")).toBe("unknown");
  });

  it("rejects federated username with empty domain", () => {
    expect(detectLoginInputType("alice#")).toBe("unknown");
  });

  it("rejects federated username with leading underscore in login part", () => {
    expect(detectLoginInputType("_alice#acme.corp")).toBe("unknown");
  });

  it("# takes priority over plain username detection", () => {
    expect(detectLoginInputType("alice#domain")).toBe("username");
  });

  it("ignores minUsernameLength for federated username", () => {
    // minUsernameLength=6 only applies to global usernames, not federated
    expect(detectLoginInputType("alice#acme.corp", 6)).toBe("username"); // 5 chars OK
    expect(detectLoginInputType("ab#acme.corp", 6)).toBe("username"); // 2 chars OK
  });
});

describe("normalizePrincipal", () => {
  it("normalizes email: lowercase + strip dots + strip alias", () => {
    const result = normalizePrincipal("Alice.Bob+tag@Example.COM");
    expect(result.type).toBe("email");
    expect(result.value).toBe("alicebob@example.com");
    expect(result.display).toBe("alicebob@example.com");
  });

  it("normalizes phone to E.164", () => {
    const result = normalizePrincipal("+380 50 123 45 67");
    expect(result.type).toBe("phone");
    expect(result.value).toBe("+380501234567");
    expect(result.display).toBe("+380501234567");
  });

  it("normalizes username: value=lowercase, display=original casing", () => {
    const result = normalizePrincipal("Alice_Bob");
    expect(result.type).toBe("username");
    expect(result.value).toBe("alice_bob");
    expect(result.display).toBe("Alice_Bob");
  });

  it("rejects username with leading/trailing underscore (detected as unknown)", () => {
    // Leading/trailing _ blocked at detection level → "Cannot determine"
    expect(() => normalizePrincipal("_alice_bob")).toThrow("Cannot determine");
    expect(() => normalizePrincipal("alice_")).toThrow("Cannot determine");
  });

  it("rejects username with consecutive underscores", () => {
    // Detected as username (passes detection regex), but fails validation
    expect(() => normalizePrincipal("alice__bob")).toThrow("Invalid username");
  });

  it("respects minUsernameLength for registration (6)", () => {
    // 5-char username OK with default (3) but fails with minLength=6
    expect(normalizePrincipal("alice").type).toBe("username");
    expect(() => normalizePrincipal("alice", 6)).toThrow("Cannot determine");
  });

  it("throws on invalid email", () => {
    expect(() => normalizePrincipal("alice@")).toThrow("Invalid email");
  });

  it("throws on invalid phone", () => {
    expect(() => normalizePrincipal("+000")).toThrow("Invalid phone");
  });

  it("throws on unknown type", () => {
    expect(() => normalizePrincipal("ab")).toThrow("Cannot determine");
  });

  // ── Federated username normalization ──

  it("normalizes federated username: lowercase both parts", () => {
    const result = normalizePrincipal("Alice#Acme.Corp");
    expect(result.type).toBe("username");
    expect(result.value).toBe("alice#acme.corp");
    expect(result.display).toBe("Alice#Acme.Corp");
  });

  it("normalizes federated username with numbers", () => {
    const result = normalizePrincipal("dev42#internal.net");
    expect(result.type).toBe("username");
    expect(result.value).toBe("dev42#internal.net");
  });

  it("rejects federated username with consecutive underscores in login part", () => {
    expect(() => normalizePrincipal("alice__bob#acme.corp")).toThrow(
      "Invalid username",
    );
  });

  it("rejects federated username with invalid domain chars", () => {
    expect(() => normalizePrincipal("alice#acme corp")).toThrow(
      "Invalid federated domain",
    );
  });

  it("rejects federated username with empty domain", () => {
    expect(() => normalizePrincipal("alice#")).toThrow("Cannot determine");
  });

  it("preserves display form for federated username", () => {
    const result = normalizePrincipal("Bob_Smith#MyCompany.com");
    expect(result.display).toBe("Bob_Smith#MyCompany.com");
    expect(result.value).toBe("bob_smith#mycompany.com");
  });
});
