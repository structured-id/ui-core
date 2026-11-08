import { beforeEach, describe, expect, it, vi } from "vitest";
import { RpcError } from "@protobuf-ts/runtime-rpc";
import { OpaqueLoginId, SessionId } from "@structured-id/ids";
import {
  StepUpMethod,
  opaqueLoginFinish,
  startTotpEnrollment,
  verifyRecoveryCode,
  verifyTotp,
} from "./useAuthApi";
import { pendingSignIn } from "../pendingSignIn";

// The AuthService methods by client method name, separately for the sign-in
// surface and the account API.
const rpc: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {
  signIn: {},
  account: {},
};

vi.mock("../../index", () => ({
  getTransport: vi.fn(() => "signIn"),
  getAccountTransport: vi.fn(() => "account"),
}));

vi.mock("@structured-id/proto/sid/v1/authn/auth.client", () => ({
  // Called with `new`: a constructor mock must be a `function`, not an arrow.
  AuthServiceClient: vi.fn().mockImplementation(function (surface: string) {
    const methods = rpc[surface];
    return new Proxy(
      {},
      { get: (_target, name: string) => (methods[name] ??= vi.fn()) },
    );
  }),
}));

vi.mock("../auth", () => ({
  authMeta: () => ({}),
}));

const SESSION = SessionId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d10");
const LOGIN = OpaqueLoginId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d16");

function call(surface: "signIn" | "account", name: string) {
  return (rpc[surface][name] ??= vi.fn());
}

/** The options the RPC `name` was last called with. */
function metaOf(surface: "signIn" | "account", name: string): unknown {
  return call(surface, name).mock.calls.at(-1)?.[1]?.meta;
}

async function signInOwingTotp() {
  call("signIn", "opaqueLoginFinish").mockResolvedValueOnce({
    response: {
      sessionId: SESSION.toWire(),
      expiresIn: 300n,
      secondFactors: [StepUpMethod.TOTP],
      enrollableFactors: [],
      browserCsrf: "csrf-1",
    },
  });
  return opaqueLoginFinish("alice", new Uint8Array(), LOGIN);
}

beforeEach(() => {
  sessionStorage.clear();
  for (const surface of Object.values(rpc)) {
    for (const fn of Object.values(surface)) fn.mockReset();
  }
});

describe("a browser sign-in owing its second factor", () => {
  // Regression: the answer's factors and CSRF token were dropped, so the
  // completion went without the token and the server refused it.
  it("is kept from the password sign-in's answer", async () => {
    const finished = await signInOwingTotp();
    expect(finished.pending).toEqual({
      secondFactors: [StepUpMethod.TOTP],
      enrollableFactors: [],
    });
    expect(pendingSignIn()).toEqual(finished.pending);
  });

  it("sends its CSRF token with the completion and ends with the session", async () => {
    await signInOwingTotp();
    call("signIn", "verifyTotp").mockResolvedValueOnce({
      response: { verified: true, sessionId: SESSION.toWire() },
    });

    await verifyTotp("123456");

    expect(metaOf("signIn", "verifyTotp")).toEqual({
      "x-csrf-token": "csrf-1",
    });
    expect(pendingSignIn()).toBeNull();
  });

  // An unknown outcome may have committed: the record stays, so the same
  // completion is repeated with the same token and receives the sign-in.
  it("keeps the record when the completion's outcome is unknown", async () => {
    await signInOwingTotp();
    call("signIn", "verifyRecoveryCode").mockRejectedValueOnce(
      new RpcError("lost", "UNAVAILABLE"),
    );

    await expect(verifyRecoveryCode("AAAA-BBBB-CCCC")).rejects.toThrow();

    expect(pendingSignIn()).not.toBeNull();
    expect(metaOf("signIn", "verifyRecoveryCode")).toEqual({
      "x-csrf-token": "csrf-1",
    });
  });

  // The first TOTP enrollment of a sign-in goes to the sign-in surface with
  // the pending token; from the account pages it stays on the account API.
  it("enrolls its first factor on the sign-in surface", async () => {
    await signInOwingTotp();
    call("signIn", "startTotpEnrollment").mockResolvedValueOnce({
      response: {},
    });
    call("account", "startTotpEnrollment").mockResolvedValueOnce({
      response: {},
    });

    await startTotpEnrollment("sign-in");
    await startTotpEnrollment();

    expect(metaOf("signIn", "startTotpEnrollment")).toEqual({
      "x-csrf-token": "csrf-1",
    });
    expect(metaOf("account", "startTotpEnrollment")).toEqual({});
  });
});
