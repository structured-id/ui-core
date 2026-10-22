import { beforeAll, describe, it, expect } from "vitest";
import { detectLoginInputType, normalizePrincipal } from "./normalizePrincipal";
import { initEmail } from "./email";
import { TEST_PSL } from "./email.testing";

// As an application does at start: the email parser loaded, LOCAL namespace.
beforeAll(() => initEmail({ psl: TEST_PSL }));

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
    // Uppercase accepted; the server derives the key.
    expect(detectLoginInputType("Admin123")).toBe("username");
  });

  it("detects a username in any script, counted in code points", () => {
    expect(detectLoginInputType("Иван")).toBe("username");
    expect(detectLoginInputType("Иван_Петров", 6)).toBe("username");
    expect(detectLoginInputType("Щукин", 6)).toBe("unknown"); // 5 < 6
    expect(detectLoginInputType("ЩЩ")).toBe("unknown"); // 2 < 3
    expect(detectLoginInputType("Иван Петров")).toBe("unknown"); // a space
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
  // Regression: the client folded the address (case, dots, +tag) before
  // sending it, so the server never saw the mailbox the user typed and
  // stored the folded key as the address to mail. The server derives the
  // lookup key and keeps the spelling; the client sends it as typed.
  it("sends an email as typed, only trimmed", () => {
    const result = normalizePrincipal("  Alice.Bob+tag@Example.COM ");
    expect(result.type).toBe("email");
    expect(result.value).toBe("Alice.Bob+tag@Example.COM");
    expect(result.display).toBe("Alice.Bob+tag@Example.COM");
  });

  // Admission is the server's policy: an installation's internal mail
  // domain and a quoted local part are not refused by the client.
  it("leaves email admission to the server", () => {
    expect(normalizePrincipal("admin@printer").value).toBe("admin@printer");
    expect(normalizePrincipal('"a b"@example.com').value).toBe(
      '"a b"@example.com',
    );
  });

  it("normalizes phone to E.164", () => {
    const result = normalizePrincipal("+380 50 123 45 67");
    expect(result.type).toBe("phone");
    expect(result.value).toBe("+380501234567");
    expect(result.display).toBe("+380501234567");
  });

  // Regression: the client lowercased a username before sending it, so the
  // server never saw the spelling the user typed and could not keep it as
  // the display form. The server derives the key, as it does for email.
  it("sends a username as typed, case kept", () => {
    const result = normalizePrincipal("Alice_Bob");
    expect(result.type).toBe("username");
    expect(result.value).toBe("Alice_Bob");
    expect(result.display).toBe("Alice_Bob");
  });

  // Whitespace is never part of a name and is not repaired: a username with
  // surrounding spaces is refused, not trimmed into another name.
  it("refuses a username with surrounding whitespace", () => {
    for (const input of ["  Alice_Bob ", "Alice_Bob ", "\tAlice_Bob"]) {
      expect(() => normalizePrincipal(input)).toThrow("Cannot determine");
    }
  });

  // Regression: a letter outside a-z made the name no type at all, so the
  // field refused it before the server could apply its repertoire.
  it("sends a username in any script as typed", () => {
    for (const name of ["Иван_Петров", "Ωmega42", "Jürgen"]) {
      const result = normalizePrincipal(name);
      expect(result.type).toBe("username");
      expect(result.value).toBe(name);
    }
  });

  it("sends a username unnormalized and counts it after NFC", () => {
    // "Jürgen" with ü as u + combining diaeresis: 7 code points, 6 in NFC.
    const decomposed = "Jürgen";
    const result = normalizePrincipal(decomposed, 6);
    expect(result.value).toBe(decomposed);
    expect(() => normalizePrincipal("Щукин", 6)).toThrow("Cannot determine");
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

  it("throws on an email with no local part or domain", () => {
    expect(() => normalizePrincipal("alice@")).toThrow("Invalid email");
    expect(() => normalizePrincipal("@example.com")).toThrow("Invalid email");
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
