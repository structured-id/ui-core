import { beforeEach, describe, expect, it, vi } from "vitest";
import { RpcError } from "@protobuf-ts/runtime-rpc";
import { base64encode } from "@protobuf-ts/runtime";
import { SessionId } from "@structured-id/ids";
import { Any } from "@structured-id/proto/google/protobuf/any";
import { Status } from "@structured-id/proto/google/rpc/status";
import { ErrorInfo } from "@structured-id/proto/google/rpc/error_details";
import { ErrorReason } from "@structured-id/proto/sid/v1/common/errors";

const SESSION = SessionId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d20");

vi.mock("./useAuthApi", () => ({
  webAuthnAuthenticationStart: vi.fn(),
  webAuthnAuthenticationFinish: vi.fn(),
}));

// The browser's ceremony is stubbed; the refusals and their texts stay real.
const getPasskey = vi.hoisted(() => vi.fn());
vi.mock("../../index", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPasskey,
}));

import { PasskeyError, REFUSAL_TEXTS } from "../../index";
import {
  webAuthnAuthenticationFinish,
  webAuthnAuthenticationStart,
} from "./useAuthApi";
import { usePasskeySignIn } from "./usePasskeySignIn";

const encode = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value));

/** The server's options: the RequestChallengeResponse JSON, `publicKey` inside. */
const serverOptions = encode({
  publicKey: { challenge: "AQID", rpId: "sid.example.com" },
});

/** The developer's message a refusal carries; the page never shows it. */
const MESSAGE = "challenge%20store%20unreachable%20at%2010.0.0.7";

/** A call refused with SID's `reason`, as the gRPC-Web transport raises it. */
function refused(reason: string): RpcError {
  const status = Status.create({
    code: 14,
    message: MESSAGE,
    details: [
      Any.pack(
        ErrorInfo.create({ domain: "structured.id", reason, metadata: {} }),
        ErrorInfo,
      ),
    ],
  });
  return new RpcError(MESSAGE, "UNAVAILABLE", {
    "grpc-status-details-bin": base64encode(Status.toBinary(status)),
  });
}

/** A ceremony the server completes with `assertion`. */
function served(assertion: Uint8Array) {
  vi.mocked(webAuthnAuthenticationStart).mockResolvedValue({
    options: serverOptions,
  } as never);
  vi.mocked(webAuthnAuthenticationFinish).mockResolvedValue({
    sessionId: SESSION,
    pending: null,
  } as never);
  getPasskey.mockResolvedValue(assertion);
}

describe("usePasskeySignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // What is tested: the finish carries the browser's own response JSON, and
  // the caller hears of the sign-in only once the server verified it.
  // Bug prevented: a hand-built assertion without clientExtensionResults,
  // which the issuer's strict WebAuthn reading refuses.
  it("finishes with the browser's own assertion, then reports success", async () => {
    const assertion = encode({ id: "cred", clientExtensionResults: {} });
    served(assertion);
    const onSuccess = vi.fn();

    const { signInWithPasskey, loading, error } = usePasskeySignIn({
      onSuccess,
    });
    await signInWithPasskey();

    expect(getPasskey).toHaveBeenCalledWith(serverOptions);
    expect(vi.mocked(webAuthnAuthenticationFinish).mock.calls[0]).toEqual([
      assertion,
      undefined,
    ]);
    expect(onSuccess).toHaveBeenCalledWith({
      sessionId: SESSION,
      pending: null,
    });
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  // What is tested: a typed login goes to start and finish unchanged, and an
  // empty field sends none, which asks for a discoverable passkey.
  // Bug prevented: an empty login sent as a login, which resolves to no
  // account instead of letting the passkey name its own.
  it("signs in for the typed login as typed, or discoverable without one", async () => {
    const assertion = encode({ id: "cred", clientExtensionResults: {} });
    served(assertion);

    const { signInWithPasskey } = usePasskeySignIn({ onSuccess: vi.fn() });
    await signInWithPasskey("devauth-admin");
    expect(vi.mocked(webAuthnAuthenticationStart).mock.calls[0]).toEqual([
      "devauth-admin",
    ]);
    expect(vi.mocked(webAuthnAuthenticationFinish).mock.calls[0]).toEqual([
      assertion,
      "devauth-admin",
    ]);

    for (const empty of [null, undefined, ""]) {
      vi.mocked(webAuthnAuthenticationStart).mockClear();
      vi.mocked(webAuthnAuthenticationFinish).mockClear();
      await signInWithPasskey(empty);
      expect(vi.mocked(webAuthnAuthenticationStart).mock.calls[0]).toEqual([
        undefined,
      ]);
      expect(vi.mocked(webAuthnAuthenticationFinish).mock.calls[0]).toEqual([
        assertion,
        undefined,
      ]);
    }
  });

  // What is tested: a typed login the issuer does not resolve is a refused
  // sign-in, shown by its reason.
  // Bug prevented: a quiet retry as a discoverable passkey, which could sign
  // in another account than the one typed.
  it("refuses an unresolved login without trying another passkey", async () => {
    vi.mocked(webAuthnAuthenticationStart).mockRejectedValue(
      refused("AUTHENTICATION_FAILED"),
    );
    const onSuccess = vi.fn();
    const { signInWithPasskey, error } = usePasskeySignIn({ onSuccess });
    await signInWithPasskey("nobody-here");

    expect(webAuthnAuthenticationStart).toHaveBeenCalledTimes(1);
    expect(getPasskey).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(error.value).toBe(REFUSAL_TEXTS[ErrorReason.AUTHENTICATION_FAILED]);
  });

  // What is tested: a cancelled prompt is reported and nothing is finished.
  // Bug prevented: a cancelled prompt reported as a sign-in.
  it("reports a cancelled prompt without signing in", async () => {
    vi.mocked(webAuthnAuthenticationStart).mockResolvedValue({
      options: serverOptions,
    } as never);
    getPasskey.mockRejectedValue(new PasskeyError("cancelled", "cancelled"));
    const onSuccess = vi.fn();

    const { signInWithPasskey, error } = usePasskeySignIn({ onSuccess });
    await signInWithPasskey();

    expect(onSuccess).not.toHaveBeenCalled();
    expect(webAuthnAuthenticationFinish).not.toHaveBeenCalled();
    expect(error.value).toBe("Request was cancelled or timed out");
  });

  // What is tested: a refusal is shown by its reason.
  // Bug prevented: the server's developer message, with its internal detail,
  // shown to the user signing in.
  it("shows a refusal by its reason, never the server's message", async () => {
    vi.mocked(webAuthnAuthenticationStart).mockRejectedValue(
      refused("DEPENDENCY_UNAVAILABLE"),
    );
    const { signInWithPasskey, error } = usePasskeySignIn({
      onSuccess: vi.fn(),
    });
    await signInWithPasskey();

    expect(error.value).toBe(REFUSAL_TEXTS[ErrorReason.DEPENDENCY_UNAVAILABLE]);
    expect(error.value).not.toContain("10.0.0.7");
  });
});
