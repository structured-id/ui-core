import { describe, expect, it } from "vitest";
import {
  RpcError,
  UnaryCall,
  type MethodInfo,
  type RpcOptions,
} from "@protobuf-ts/runtime-rpc";
import { decodeStatusMessage, decodedStatusMessages } from "./statusMessage";

const method = {
  name: "ListProfiles",
  service: { typeName: "sid.v1.Identity" },
} as unknown as MethodInfo;

/** A unary call refused with the wire's percent-encoded `message`. */
function refused(message: string): UnaryCall {
  const err = new RpcError(message, "PERMISSION_DENIED", {});
  const fail = <T>() => Promise.reject<T>(err);
  return new UnaryCall(method, {}, {}, fail(), fail(), fail(), fail());
}

describe("status messages", () => {
  // Regression: the console showed "the%20caller%20may%20not…" because the
  // stores show err.message, which the transport left percent-encoded.
  it("decodes a refusal's message for every caller", async () => {
    const interceptor = decodedStatusMessages();
    const call = interceptor.interceptUnary!(
      () => refused("the%20caller%20may%20not%20perform%20this%20operation"),
      method,
      {},
      {} as RpcOptions,
    );
    const err = await call.response.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RpcError);
    expect((err as RpcError).message).toBe(
      "the caller may not perform this operation",
    );
    expect((err as RpcError).code).toBe("PERMISSION_DENIED");
    // Every promise of the call carries the decoded refusal.
    for (const part of [call.headers, call.status, call.trailers]) {
      await expect(part).rejects.toMatchObject({
        message: "the caller may not perform this operation",
      });
    }
  });

  // A caller that reads only the response leaves the other parts of the
  // call unread. Bug prevented: each unread part rejected unhandled, so a
  // refusal the caller caught still reported unhandled rejections.
  it("leaves no unhandled rejection when only the response is read", async () => {
    const unhandled: unknown[] = [];
    const record = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", record);
    try {
      const call = decodedStatusMessages().interceptUnary!(
        () => refused("denied"),
        method,
        {},
        {} as RpcOptions,
      );
      await expect(call.response).rejects.toBeInstanceOf(RpcError);
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      process.off("unhandledRejection", record);
    }
    expect(unhandled).toEqual([]);
  });

  // Text that is not valid percent-encoding is shown as it came.
  it("keeps a message that is not encoding", () => {
    expect(decodeStatusMessage("100% done")).toBe("100% done");
  });
});
