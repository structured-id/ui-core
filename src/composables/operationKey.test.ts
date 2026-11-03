import { describe, it, expect, vi } from "vitest";
import type { MethodInfo, RpcOptions } from "@protobuf-ts/runtime-rpc";
import { OPERATION_KEY, operationKey } from "./operationKey";

/** The options a unary call reaches the transport with. */
function sent(
  idempotency: MethodInfo["idempotency"],
  options: RpcOptions = {},
) {
  const next = vi.fn((_m, _i, o: RpcOptions) => o);
  const method = { idempotency } as unknown as MethodInfo;
  operationKey.interceptUnary!(next as never, method, {}, options);
  return next.mock.calls[0][2] as RpcOptions;
}

describe("operationKey", () => {
  // A state-changing call is named by a key, so SID can answer its retry
  // with the recorded result instead of applying it again.
  it("adds a key to a call that changes state", () => {
    expect(sent(undefined).meta?.[OPERATION_KEY]).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent("IDEMPOTENT").meta?.[OPERATION_KEY]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("adds no key to a read", () => {
    expect(sent("NO_SIDE_EFFECTS").meta?.[OPERATION_KEY]).toBeUndefined();
  });

  // A caller retrying one command passes the same key every time.
  it("keeps a key the caller passed", () => {
    const options = { meta: { [OPERATION_KEY]: "mine", other: "x" } };
    expect(sent(undefined, options).meta).toEqual(options.meta);
  });

  it("gives every call its own key", () => {
    expect(sent(undefined).meta?.[OPERATION_KEY]).not.toBe(
      sent(undefined).meta?.[OPERATION_KEY],
    );
  });
});
