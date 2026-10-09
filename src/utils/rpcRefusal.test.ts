import { describe, it, expect } from "vitest";
import { RpcError } from "@protobuf-ts/runtime-rpc";
import { base64encode } from "@protobuf-ts/runtime";
import { Any } from "@structured-id/proto/google/protobuf/any";
import { Status } from "@structured-id/proto/google/rpc/status";
import {
  ErrorInfo,
  LocalizedMessage,
} from "@structured-id/proto/google/rpc/error_details";
import { ErrorReason } from "@structured-id/proto/sid/v1/common/errors";
import {
  REFUSAL_TEXTS,
  refusalMessage,
  rpcReason,
  rpcRefusal,
} from "./rpcRefusal";

/** A refused call as the gRPC-Web transport raises it: the status in the trailer. */
function refused(
  details: Any[],
  message = "this%20password%20was%20used%20before",
): RpcError {
  const status = Status.create({ code: 9, message, details });
  return new RpcError(message, "FAILED_PRECONDITION", {
    "grpc-status-details-bin": base64encode(Status.toBinary(status)),
  });
}

const info = Any.pack(
  ErrorInfo.create({
    reason: "PASSWORD_REUSED",
    domain: "structured.id",
    metadata: {},
  }),
  ErrorInfo,
);

describe("rpcRefusal", () => {
  // The contract a page branches on is the (domain, reason) pair of ErrorInfo.
  it("reads the domain and reason from the status details", () => {
    expect(rpcRefusal(refused([info]))).toMatchObject({
      code: "FAILED_PRECONDITION",
      domain: "structured.id",
      reason: "PASSWORD_REUSED",
    });
    expect(rpcReason(refused([info]))).toBe("PASSWORD_REUSED");
  });

  // A reason is defined only within its domain: the same name from another
  // service (a proxied upstream, another edition) is not SID's reason, so a
  // page must not branch on it as if it were.
  it("reports a reason only for the domain asked about", () => {
    const foreign = Any.pack(
      ErrorInfo.create({
        reason: "PASSWORD_REUSED",
        domain: "upstream.example.com",
        metadata: {},
      }),
      ErrorInfo,
    );
    expect(rpcReason(refused([foreign]))).toBeNull();
    expect(rpcReason(refused([foreign]), "upstream.example.com")).toBe(
      "PASSWORD_REUSED",
    );
  });

  // gRPC percent-encodes the status message on the wire; people read it decoded.
  it("decodes the percent-encoded status message", () => {
    expect(rpcRefusal(refused([]))?.message).toBe(
      "this password was used before",
    );
  });

  it("prefers the server's text for people", () => {
    const localized = Any.pack(
      LocalizedMessage.create({ locale: "en", message: "Choose another." }),
      LocalizedMessage,
    );
    expect(refusalMessage(refused([info, localized]))).toBe("Choose another.");
  });

  // The status message is written for developers: people see the client's
  // text for the reason, never the message.
  it("shows the client's text for the reason", () => {
    expect(refusalMessage(refused([info]))).toBe(
      REFUSAL_TEXTS[ErrorReason.PASSWORD_REUSED],
    );
    expect(rpcRefusal(refused([info]))?.reasonCode).toBe(
      ErrorReason.PASSWORD_REUSED,
    );
  });

  // A refusal without SID's reason (a transport failure, another domain, a
  // reason this client does not know) has nothing for people but the
  // caller's own context.
  it("falls back to the caller's text without a known SID reason", () => {
    expect(refusalMessage(refused([]), "Failed to load")).toBe(
      "Failed to load",
    );
    const foreign = Any.pack(
      ErrorInfo.create({
        reason: "PASSWORD_REUSED",
        domain: "upstream.example.com",
        metadata: {},
      }),
      ErrorInfo,
    );
    expect(refusalMessage(refused([foreign]), "Failed to load")).toBe(
      "Failed to load",
    );
    const unknown = Any.pack(
      ErrorInfo.create({
        reason: "NOT_YET_DEFINED",
        domain: "structured.id",
        metadata: {},
      }),
      ErrorInfo,
    );
    expect(rpcRefusal(refused([unknown]))?.reasonCode).toBeNull();
    expect(refusalMessage(refused([unknown]), "Failed to load")).toBe(
      "Failed to load",
    );
  });

  // Every reason of the proto has a text: a reason added without one would
  // reach people as the bare fallback.
  it("has a text for every reason", () => {
    const texts: Partial<Record<ErrorReason, string>> = REFUSAL_TEXTS;
    for (const value of Object.values(ErrorReason)) {
      if (typeof value !== "number") continue;
      if (value === ErrorReason.ERROR_REASON_UNSPECIFIED) continue;
      expect(texts[value]).toBeTruthy();
    }
  });

  it("leaves any other error alone", () => {
    expect(rpcRefusal(new Error("boom"))).toBeNull();
    expect(rpcReason(new Error("boom"))).toBeNull();
    expect(refusalMessage(new Error("boom"))).toBe("boom");
    expect(refusalMessage("not an error", "Request failed")).toBe(
      "Request failed",
    );
  });

  it("survives an unreadable trailer", () => {
    const err = new RpcError("m", "INTERNAL", {
      "grpc-status-details-bin": "!!!",
    });
    expect(rpcRefusal(err)).toMatchObject({ reason: null, message: "m" });
  });
});
