import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CredentialId,
  IdError,
  MagicLinkId,
  MissingIdError,
  OtpSessionId,
  ResetSessionId,
  SessionId,
  StepUpChallengeId,
} from "@structured-id/ids";
import {
  StepUpMethod,
  completePasswordReset,
  completeStepUp,
  deleteMfaCredential,
  finishTotpEnrollment,
  requestMagicLink,
  requestStepUp,
  resendOtp,
  verifyMagicLink,
  verifyOtp,
  verifyPasswordReset,
  verifyTotp,
  webAuthnAuthenticationFinish,
} from "./useAuthApi";

// Every AuthService method the tests call, keyed by its client method name.
const rpc: Record<string, ReturnType<typeof vi.fn>> = {};

vi.mock("../../index", () => ({
  getTransport: vi.fn(),
  getAccountTransport: vi.fn(),
}));

vi.mock("@structured-id/proto/sid/v1/authn/auth.client", () => ({
  // Called with `new`: a constructor mock must be a `function`, not an arrow.
  AuthServiceClient: vi.fn().mockImplementation(function () {
    return new Proxy(
      {},
      { get: (_target, name: string) => (rpc[name] ??= vi.fn()) },
    );
  }),
}));

vi.mock("../auth", () => ({
  authMeta: () => ({}),
}));

const SESSION = SessionId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d10");
const CRED = CredentialId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d11");
const OTP = OtpSessionId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d12");
const LINK = MagicLinkId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d13");
const CHALLENGE = StepUpChallengeId.parse(
  "0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d14",
);
const RESET = ResetSessionId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d15");
const OPERATION = new Uint8Array(16).fill(7);
const MALFORMED = { value: new Uint8Array(15) };

/** The RPC `name` answers `response` once. */
function answers(name: string, response: object) {
  rpc[name] ??= vi.fn();
  rpc[name].mockResolvedValueOnce({ response });
}

/** The request the RPC `name` was last called with. */
function sent(name: string): unknown {
  return rpc[name].mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  for (const fn of Object.values(rpc)) fn.mockReset();
});

describe("one-time code", () => {
  // The code is verified against the request it was sent for, named by its
  // binary identifier; the provisional session is read only when verified.
  it("names the request and reads the session it opened", async () => {
    answers("verifyOtp", { verified: true, sessionId: SESSION.toWire() });
    const result = await verifyOtp("12345678", OTP);
    expect(sent("verifyOtp")).toEqual({
      code: "12345678",
      otpSessionId: { value: OTP.toBytes() },
    });
    expect(result.sessionId?.equals(SESSION)).toBe(true);
  });

  it("reads no session from a code that did not verify", async () => {
    answers("verifyOtp", { verified: false });
    expect((await verifyOtp("0", OTP)).sessionId).toBeUndefined();
  });

  it("refuses a malformed session in a verified answer", async () => {
    answers("verifyOtp", { verified: true, sessionId: MALFORMED });
    await expect(verifyOtp("0", OTP)).rejects.toBeInstanceOf(IdError);
  });

  it("resends for the request it names", async () => {
    answers("resendOtp", {});
    await resendOtp(OTP);
    expect(sent("resendOtp")).toEqual({
      otpSessionId: { value: OTP.toBytes() },
    });
  });
});

describe("second factor", () => {
  // A present but malformed session is an error even though the field is
  // optional: an empty message is not an absent one.
  it("refuses a malformed session in an MFA answer", async () => {
    answers("verifyTotp", { verified: true, sessionId: MALFORMED });
    await expect(verifyTotp("123456")).rejects.toBeInstanceOf(IdError);
  });

  it("reads the credential a TOTP enrollment stored and refuses an answer without one", async () => {
    answers("finishTotpEnrollment", {
      credentialId: CRED.toWire(),
      recoveryCodes: [],
    });
    expect(
      (await finishTotpEnrollment("123456")).credentialId.equals(CRED),
    ).toBe(true);
    answers("finishTotpEnrollment", { recoveryCodes: [] });
    await expect(finishTotpEnrollment("123456")).rejects.toBeInstanceOf(
      MissingIdError,
    );
  });

  it("deletes the MFA credential it names in binary", async () => {
    answers("deleteMfaCredential", {});
    await deleteMfaCredential(CRED);
    expect(sent("deleteMfaCredential")).toEqual({
      credentialId: { value: CRED.toBytes() },
    });
  });
});

describe("passkey sign-in", () => {
  // The server finds the ceremony by the challenge the assertion signs, so
  // no state key is sent; the answer must name its session.
  it("sends the assertion alone and reads the session", async () => {
    answers("webAuthnAuthenticationFinish", {
      sessionId: SESSION.toWire(),
      expiresIn: 60n,
      secondFactors: [],
      enrollableFactors: [],
    });
    const credential = new Uint8Array([1, 2]);
    const result = await webAuthnAuthenticationFinish(credential, "a@b.c");
    expect(sent("webAuthnAuthenticationFinish")).toEqual({
      credential,
      principal: "a@b.c",
    });
    expect(result.sessionId.equals(SESSION)).toBe(true);
  });

  it("refuses an answer without its session", async () => {
    answers("webAuthnAuthenticationFinish", { expiresIn: 60n });
    await expect(
      webAuthnAuthenticationFinish(new Uint8Array()),
    ).rejects.toBeInstanceOf(MissingIdError);
  });
});

describe("magic link", () => {
  it("reads the link it requested and refuses an answer without one", async () => {
    answers("requestMagicLink", { magicLinkId: LINK.toWire(), expiresIn: 600 });
    expect(
      (
        await requestMagicLink("a@b.c", "app", "https://app/")
      ).magicLinkId.equals(LINK),
    ).toBe(true);
    answers("requestMagicLink", { expiresIn: 600 });
    await expect(
      requestMagicLink("a@b.c", "app", "https://app/"),
    ).rejects.toBeInstanceOf(MissingIdError);
  });

  it("verifies the link it names and reads the session it opened", async () => {
    answers("verifyMagicLink", { sessionId: SESSION.toWire(), expiresIn: 60n });
    const result = await verifyMagicLink(LINK, "token");
    expect(sent("verifyMagicLink")).toEqual({
      magicLinkId: { value: LINK.toBytes() },
      token: "token",
    });
    expect(result.sessionId.equals(SESSION)).toBe(true);
  });
});

describe("step-up", () => {
  // The session stepped up is the bearer token's own: it is never named in
  // the request, and the challenge is named by its binary identifier.
  it("requests a challenge without naming a session", async () => {
    answers("requestStepUp", {
      method: StepUpMethod.WEBAUTHN,
      challengeId: CHALLENGE.toWire(),
      challenge: { oneofKind: undefined },
    });
    const result = await requestStepUp(StepUpMethod.WEBAUTHN);
    expect(sent("requestStepUp")).toEqual({ method: StepUpMethod.WEBAUTHN });
    expect(result.challengeId?.equals(CHALLENGE)).toBe(true);
  });

  it("completes with the challenge in binary, or none for a 1-phase method", async () => {
    answers("completeStepUp", {});
    await completeStepUp(StepUpMethod.WEBAUTHN, CHALLENGE, {
      webauthnAssertion: new Uint8Array([1]),
    });
    expect(sent("completeStepUp")).toMatchObject({
      method: StepUpMethod.WEBAUTHN,
      challengeId: { value: CHALLENGE.toBytes() },
    });
    expect(sent("completeStepUp")).not.toHaveProperty("sessionId");

    answers("completeStepUp", {});
    await completeStepUp(StepUpMethod.TOTP, undefined, { totpCode: "123456" });
    expect(sent("completeStepUp")).toMatchObject({ challengeId: undefined });
  });
});

describe("password reset", () => {
  it("verifies the reset it names in binary", async () => {
    answers("verifyPasswordReset", { expiresIn: 600 });
    await verifyPasswordReset(RESET, "token");
    expect(sent("verifyPasswordReset")).toEqual({
      resetSessionId: { value: RESET.toBytes() },
      token: "token",
    });
  });

  // The completion is named by its operation, which carries the verified
  // reset's authority; the session it may open is optional.
  it("completes by the operation alone and reads the optional session", async () => {
    answers("completePasswordReset", { sessionId: SESSION.toWire() });
    const record = new Uint8Array([1]);
    const done = await completePasswordReset(OPERATION, record);
    expect(sent("completePasswordReset")).toEqual({
      operationId: { value: OPERATION },
      registrationRecord: record,
      proof: undefined,
    });
    expect(done.sessionId?.equals(SESSION)).toBe(true);

    answers("completePasswordReset", {});
    expect(
      (await completePasswordReset(OPERATION, record)).sessionId,
    ).toBeUndefined();
  });
});
