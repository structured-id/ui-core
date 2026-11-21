import { describe, expect, it } from "vitest";
import { TotpAlgorithm } from "@structured-id/proto/sid/v1/authn/auth";
import { base32, totpKeyUri } from "./totp";

const text = (s: string) => new TextEncoder().encode(s);

describe("base32", () => {
  // RFC 4648 §10 test vectors, without the padding authenticator apps omit.
  it.each([
    ["", ""],
    ["f", "MY"],
    ["fo", "MZXQ"],
    ["foo", "MZXW6"],
    ["foob", "MZXW6YQ"],
    ["fooba", "MZXW6YTB"],
    ["foobar", "MZXW6YTBOI"],
  ])("encodes %j as %j", (input, expected) => {
    expect(base32(text(input))).toBe(expected);
  });
});

describe("totpKeyUri", () => {
  const challenge = {
    // The RFC 6238 Appendix B SHA-1 seed.
    sharedSecret: text("12345678901234567890"),
    issuer: "Acme ID",
    accountName: "alice@example.com",
    algorithm: TotpAlgorithm.SHA1,
    digits: 6,
    periodSeconds: 30,
  };

  // The app must compute the same codes as the server: every parameter the
  // server chose is in the URI, not left to the app's defaults.
  it("carries the label, secret and the server's parameters", () => {
    const uri = new URL(totpKeyUri(challenge));
    expect(uri.protocol).toBe("otpauth:");
    expect(uri.host).toBe("totp");
    expect(decodeURIComponent(uri.pathname)).toBe("/Acme ID:alice@example.com");
    expect(Object.fromEntries(uri.searchParams)).toEqual({
      secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
      issuer: "Acme ID",
      algorithm: "SHA1",
      digits: "6",
      period: "30",
    });
  });

  // An unspecified algorithm means the server gave nothing to enroll with;
  // guessing SHA-1 would enroll codes the server may not accept.
  it("refuses a challenge without an algorithm", () => {
    expect(() =>
      totpKeyUri({ ...challenge, algorithm: TotpAlgorithm.UNSPECIFIED }),
    ).toThrow("no TOTP algorithm");
  });
});
