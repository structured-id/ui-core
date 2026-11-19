import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  webAuthnAuthenticationFinish,
  webAuthnAuthenticationStart,
} from "./useAuthApi";

// The AuthService methods of the sign-in surface by client method name.
const rpc: Record<string, ReturnType<typeof vi.fn>> = {};

vi.mock("../../index", () => ({
  getTransport: vi.fn(() => "signIn"),
  getAccountTransport: vi.fn(() => "account"),
}));

vi.mock("@structured-id/proto/sid/v1/authn/auth.client", () => ({
  // Called with `new`: a constructor mock must be a `function`, not an arrow.
  AuthServiceClient: vi.fn().mockImplementation(function () {
    return new Proxy(
      {},
      { get: (_t, name: string) => (rpc[name] ??= vi.fn()) },
    );
  }),
}));

vi.mock("../auth", () => ({
  authMeta: () => ({}),
}));

function call(name: string) {
  return (rpc[name] ??= vi.fn());
}

beforeEach(() => {
  for (const fn of Object.values(rpc)) fn.mockReset();
});

// `principal` is an optional field: absent asks for a discoverable passkey,
// whose account the server resolves from the credential. Bug prevented: an
// absent login was sent as the empty string, which the server refuses as an
// empty principal, so a passkey sign-in without a typed login never started.
describe("passkey sign-in", () => {
  it("asks for a discoverable passkey when no login is given", async () => {
    call("webAuthnAuthenticationStart").mockResolvedValueOnce({
      response: { challenge: new Uint8Array([1]), options: new Uint8Array() },
    });
    await webAuthnAuthenticationStart();
    expect(call("webAuthnAuthenticationStart").mock.calls[0][0]).toEqual({});
  });

  it("names the login it is given", async () => {
    call("webAuthnAuthenticationStart").mockResolvedValueOnce({
      response: { challenge: new Uint8Array([1]), options: new Uint8Array() },
    });
    await webAuthnAuthenticationStart("alice");
    expect(call("webAuthnAuthenticationStart").mock.calls[0][0]).toEqual({
      principal: "alice",
    });
  });

  it("finishes a discoverable passkey without a principal", async () => {
    const credential = new Uint8Array([7]);
    call("webAuthnAuthenticationFinish").mockRejectedValueOnce(
      new Error("stop after the request"),
    );
    await expect(webAuthnAuthenticationFinish(credential)).rejects.toThrow();
    expect(call("webAuthnAuthenticationFinish").mock.calls[0][0]).toEqual({
      credential,
    });
  });
});
