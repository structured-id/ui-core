import { beforeAll, describe, expect, it } from "vitest";
import {
  CORPORATE_BASELINE,
  GLOBAL_PERSONAL,
  LOCAL,
  checkEmail,
  emailPolicy,
  initEmail,
  isValidEmail,
} from "./email";

// The admission the server applies (sid_authn::email): the same parser, the
// same configuration per namespace, so the field refuses what the server
// would refuse and accepts what it would accept.

describe("before the parser is loaded", () => {
  // Nothing is judged without the parser: a hand-written guess would accept
  // what the server refuses.
  it("says pending and never valid", () => {
    expect(checkEmail("user@example.com", LOCAL)).toBe("pending");
    expect(isValidEmail("user@example.com", LOCAL)).toBe(false);
  });
});

describe("with the parser", () => {
  beforeAll(async () => {
    await initEmail();
  });

  it("accepts an ordinary mailbox in every namespace", () => {
    for (const policy of [GLOBAL_PERSONAL, CORPORATE_BASELINE, LOCAL]) {
      expect(checkEmail("a.b+c@example.com", policy)).toBe("valid");
    }
  });

  it("refuses what is never an address", () => {
    for (const input of [
      "",
      "noat",
      "@no-local.com",
      "user@",
      "spaces in@email.com",
      "user@exa mple.com",
    ]) {
      expect(checkEmail(input, LOCAL), input).toBe("invalid");
    }
  });

  // RFC 5321 §4.1.2: a quoted local part is a mailbox; comments and display
  // names are header syntax and are not.
  it("accepts a quoted local part, refuses header syntax", () => {
    expect(checkEmail('"a b"@example.com', LOCAL)).toBe("valid");
    expect(checkEmail('"a@b"@example.com', LOCAL)).toBe("valid");
    expect(checkEmail("a(comment)@example.com", LOCAL)).toBe("invalid");
    expect(checkEmail("Name <a@example.com>", LOCAL)).toBe("invalid");
  });

  it("refuses a local part left empty by the equality rules", () => {
    expect(checkEmail("+tag@example.com", LOCAL)).toBe("invalid");
  });

  describe("the global Personal namespace", () => {
    it("refuses non-ASCII in either part", () => {
      expect(checkEmail("алиса@example.com", GLOBAL_PERSONAL)).toBe("invalid");
      expect(checkEmail("user@münchen.de", GLOBAL_PERSONAL)).toBe("invalid");
    });

    it("refuses an A-label domain", () => {
      expect(checkEmail("user@xn--mnchen-3ya.de", GLOBAL_PERSONAL)).toBe(
        "invalid",
      );
    });

    it("requires a public suffix", () => {
      expect(checkEmail("admin@printer", GLOBAL_PERSONAL)).toBe("invalid");
      expect(checkEmail("user@example.notatld", GLOBAL_PERSONAL)).toBe(
        "invalid",
      );
    });
  });

  describe("an installation's own accounts", () => {
    it("admits internal and internationalized mail domains", () => {
      expect(checkEmail("admin@printer", LOCAL)).toBe("valid");
      expect(checkEmail("user@münchen.de", LOCAL)).toBe("valid");
      expect(checkEmail("алиса@example.com", LOCAL)).toBe("valid");
    });
  });

  it("corporate baseline admits an internal domain, ASCII only", () => {
    expect(checkEmail("admin@printer", CORPORATE_BASELINE)).toBe("valid");
    expect(checkEmail("user@münchen.de", CORPORATE_BASELINE)).toBe("invalid");
  });
});

describe("the application's namespace", () => {
  it("is LOCAL unless the application names its own", async () => {
    await initEmail();
    expect(emailPolicy()).toBe(LOCAL);
    await initEmail({ policy: GLOBAL_PERSONAL });
    expect(emailPolicy()).toBe(GLOBAL_PERSONAL);
    expect(isValidEmail("admin@printer")).toBe(false);
    await initEmail({ policy: LOCAL });
    expect(isValidEmail("admin@printer")).toBe(true);
  });
});
