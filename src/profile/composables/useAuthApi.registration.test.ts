import { beforeEach, describe, expect, it, vi } from "vitest";
import { RpcError } from "@protobuf-ts/runtime-rpc";
import { CredentialId, OtpSessionId } from "@structured-id/ids";
import {
  endEmailRegistration,
  opaqueZkppRegistrationStart,
  passkeyRegistrationFinish,
  passkeyRegistrationStart,
  resendEmailRegistration,
  startEmailRegistration,
  verifyEmailRegistration,
} from "./useAuthApi";

// The AuthService methods of the sign-in surface by client method name.
const rpc: Record<string, ReturnType<typeof vi.fn>> = {};

vi.mock("../../index", () => ({
  getTransport: vi.fn(() => "signIn"),
  getAccountTransport: vi.fn(() => "account"),
}));

vi.mock("@structured-id/proto/sid/v1/authn/auth.client", () => ({
  // Called with `new`: a constructor mock must be a `function`, not an arrow.
  AuthServiceClient: vi.fn().mockImplementation(function (surface: string) {
    if (surface !== "signIn") {
      throw new Error("the registration runs on the sign-in surface only");
    }
    return new Proxy(
      {},
      { get: (_t, name: string) => (rpc[name] ??= vi.fn()) },
    );
  }),
}));

vi.mock("../auth", () => ({
  authMeta: () => ({}),
}));

const CODE_SESSION = OtpSessionId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d20");
const CREDENTIAL = CredentialId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d21");

function call(name: string) {
  return (rpc[name] ??= vi.fn());
}

/** The request and options the RPC `name` was last called with. */
function lastCall(name: string): [unknown, { meta?: unknown } | undefined] {
  return call(name).mock.calls.at(-1) as [unknown, { meta?: unknown }];
}

async function verified() {
  call("verifyEmailRegistration").mockResolvedValueOnce({
    response: { expiresIn: 600n, browserCsrf: "csrf-r" },
  });
  return verifyEmailRegistration(CODE_SESSION, "123456");
}

beforeEach(() => {
  endEmailRegistration();
  for (const fn of Object.values(rpc)) fn.mockReset();
});

describe("a password registration start", () => {
  // Regression: the invite code was dropped here, so invite-only enrollment
  // refused every password registration. Both admissions reach the wire.
  it("sends the principal, the request and the admission evidence", async () => {
    call("opaqueZkppRegistrationStart").mockResolvedValue({ response: {} });
    const request = new Uint8Array([7]);

    await opaqueZkppRegistrationStart("bob@example.com", request, {
      inviteCode: "ABCD1234",
    });
    expect(lastCall("opaqueZkppRegistrationStart")[0]).toEqual({
      principal: "bob@example.com",
      registrationRequest: request,
      claimToken: undefined,
      inviteCode: "ABCD1234",
    });

    await opaqueZkppRegistrationStart("bob@example.com", request, {
      claimToken: "sidclaim_x",
    });
    expect(lastCall("opaqueZkppRegistrationStart")[0]).toEqual({
      principal: "bob@example.com",
      registrationRequest: request,
      claimToken: "sidclaim_x",
      inviteCode: undefined,
    });
  });
});

describe("a passwordless registration", () => {
  // The start sends the address with the claim token or invite the page
  // holds, and reads the code session it answers as a typed reference.
  it("starts with the address and its admission evidence", async () => {
    call("startEmailRegistration").mockResolvedValueOnce({
      response: {
        otpSessionId: CODE_SESSION.toWire(),
        maskedTarget: "a****@example.com",
        expiresInSeconds: 600,
        codeLength: 6,
      },
    });
    const started = await startEmailRegistration("alice@example.com", {
      claimToken: "sidclaim_x",
    });
    expect(started.otpSessionId.equals(CODE_SESSION)).toBe(true);
    expect(started.maskedTarget).toBe("a****@example.com");
    expect(lastCall("startEmailRegistration")[0]).toEqual({
      principal: "alice@example.com",
      inviteCode: undefined,
      claimToken: "sidclaim_x",
    });
  });

  it("resends and verifies the code of its code session", async () => {
    call("resendEmailRegistration").mockResolvedValueOnce({
      response: { expiresInSeconds: 600 },
    });
    await resendEmailRegistration(CODE_SESSION);
    expect(lastCall("resendEmailRegistration")[0]).toEqual({
      otpSessionId: CODE_SESSION.toWire(),
    });
    await verified();
    expect(lastCall("verifyEmailRegistration")[0]).toEqual({
      otpSessionId: CODE_SESSION.toWire(),
      code: "123456",
    });
  });

  // Regression guard: the context's cookie alone does not admit the passkey
  // steps; each sends the CSRF token the verification answered.
  it("sends the context's CSRF token with both passkey steps", async () => {
    await verified();
    call("passkeyRegistrationStart").mockResolvedValueOnce({
      response: {
        challenge: new Uint8Array([1]),
        options: new Uint8Array([2]),
      },
    });
    call("passkeyRegistrationFinish").mockResolvedValueOnce({
      response: { credentialId: CREDENTIAL.toWire() },
    });

    await passkeyRegistrationStart("Laptop");
    const finished = await passkeyRegistrationFinish(new Uint8Array([3]));

    expect(lastCall("passkeyRegistrationStart")).toEqual([
      { label: "Laptop" },
      { meta: { "x-csrf-token": "csrf-r" } },
    ]);
    expect(lastCall("passkeyRegistrationFinish")[1]).toEqual({
      meta: { "x-csrf-token": "csrf-r" },
    });
    expect(finished.credentialId.equals(CREDENTIAL)).toBe(true);
  });

  // An unknown finish outcome may have committed: the context stays, so the
  // same finish is repeated with the same token and answers the recorded
  // credential.
  it("keeps the context when the finish's outcome is unknown", async () => {
    await verified();
    call("passkeyRegistrationFinish")
      .mockRejectedValueOnce(new RpcError("lost", "UNAVAILABLE"))
      .mockResolvedValueOnce({
        response: { credentialId: CREDENTIAL.toWire() },
      });

    await expect(
      passkeyRegistrationFinish(new Uint8Array([3])),
    ).rejects.toThrow();
    await passkeyRegistrationFinish(new Uint8Array([3]));

    expect(lastCall("passkeyRegistrationFinish")[1]).toEqual({
      meta: { "x-csrf-token": "csrf-r" },
    });
  });

  // The registration is consumed by its commit: nothing is sent for it
  // afterwards.
  it("ends with the committed passkey", async () => {
    await verified();
    call("passkeyRegistrationFinish").mockResolvedValueOnce({
      response: { credentialId: CREDENTIAL.toWire() },
    });
    await passkeyRegistrationFinish(new Uint8Array([3]));
    await expect(passkeyRegistrationStart()).rejects.toThrow(
      "no confirmed registration",
    );
  });

  // Without a verified address there is no context to send.
  it("refuses the passkey steps before the address is confirmed", async () => {
    await expect(passkeyRegistrationStart()).rejects.toThrow(
      "no confirmed registration",
    );
    expect(call("passkeyRegistrationStart")).not.toHaveBeenCalled();
  });
});
