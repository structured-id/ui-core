import { describe, it, expect, vi } from "vitest";
import type { MethodInfo, RpcOptions } from "@protobuf-ts/runtime-rpc";
import { OperationService } from "@structured-id/proto/sid/v1/common/operation";
import {
  OPERATION_KEY,
  OPERATION_PERIOD,
  encodeOperationKey,
  isKeyed,
  operationContext,
} from "./operationContext";

const KEYED = {
  name: "CreateProject",
  options: { "sid.v1.common.retry": { keyed: true } },
} as unknown as MethodInfo;
const CEREMONY = {
  name: "RegisterClient",
  options: { "sid.v1.common.retry": { ceremony: "RFC 7591 §3" } },
} as unknown as MethodInfo;
const READ = { name: "GetProject", options: {} } as unknown as MethodInfo;

/** A chain answering the period read with `period` until `untilMs`. */
function chain(period: bigint, untilMs = Date.now() + 3_600_000) {
  const sent: Array<{ method: MethodInfo; options: RpcOptions }> = [];
  const next = vi.fn(
    (method: MethodInfo, _input: object, options: RpcOptions) => {
      sent.push({ method, options });
      const response =
        method.name === OperationService.methods[0].name
          ? {
              period,
              acceptedUntil: {
                seconds: BigInt(Math.floor(untilMs / 1000)),
                nanos: 0,
              },
            }
          : {};
      const done = Promise.resolve({
        headers: {},
        response,
        status: { code: "OK", detail: "" },
        trailers: {},
      });
      return {
        headers: done.then((d) => d.headers),
        response: done.then((d) => d.response),
        status: done.then((d) => d.status),
        trailers: done.then((d) => d.trailers),
        then: (f: (v: unknown) => unknown) => done.then(f),
      } as never;
    },
  );
  return { next, sent };
}

/** The options the keyed (or other) call reached the transport with. */
async function call(
  interceptor = operationContext(),
  c = chain(7n),
  method = KEYED,
  options: RpcOptions = {},
) {
  const answered = interceptor.interceptUnary!(
    c.next as never,
    method,
    {},
    options,
  );
  await answered.response;
  return c.sent.filter((s) => s.method.name === method.name).at(-1)!.options;
}

describe("operation context", () => {
  // The retry rule declared on the method decides, not its idempotency
  // level: a ceremony or a read carries no context.
  it("names only keyed methods", () => {
    expect(isKeyed(KEYED)).toBe(true);
    expect(isKeyed(CEREMONY)).toBe(false);
    expect(isKeyed(READ)).toBe(false);
  });

  // A new keyed command goes out with a fresh Structured Field String key
  // and the period the server issued.
  it("names a new command by a key and the server's period", async () => {
    const meta = (await call()).meta!;
    expect(meta[OPERATION_KEY]).toMatch(/^"[0-9a-f-]{36}"$/);
    expect(meta[OPERATION_PERIOD]).toBe("7");
  });

  it("adds nothing to a call that is not keyed", async () => {
    const c = chain(7n);
    const options = await call(operationContext(), c, CEREMONY, {
      meta: { other: "x" },
    });
    expect(options.meta).toEqual({ other: "x" });
    expect(c.sent).toHaveLength(1);
  });

  // A retry of one command repeats the context it was first sent with: the
  // server finds the recorded result only under the same key and period.
  it("keeps the context a retrying caller passes", async () => {
    const c = chain(9n);
    const given = { [OPERATION_KEY]: '"mine"', [OPERATION_PERIOD]: "3" };
    const options = await call(operationContext(), c, KEYED, { meta: given });
    expect(options.meta).toEqual(given);
    expect(c.sent).toHaveLength(1);
  });

  // One period serves many commands: it is read once, not per call, and
  // concurrent first calls share that read.
  it("reads the period once for many commands", async () => {
    const interceptor = operationContext();
    const c = chain(7n);
    await Promise.all([call(interceptor, c), call(interceptor, c)]);
    await call(interceptor, c);
    const reads = c.sent.filter(
      (s) => s.method.name === OperationService.methods[0].name,
    );
    expect(reads).toHaveLength(1);
  });

  // A period about to stop being admitted is replaced before a new command
  // is named with it.
  it("reads a new period when the current one is about to expire", async () => {
    const interceptor = operationContext();
    const c = chain(7n, Date.now() + 1_000);
    await call(interceptor, c);
    await call(interceptor, c);
    const reads = c.sent.filter(
      (s) => s.method.name === OperationService.methods[0].name,
    );
    expect(reads).toHaveLength(2);
  });

  // The period read is not itself a keyed command.
  it("sends the period read without the call's key", async () => {
    const c = chain(7n);
    await call(operationContext(), c, KEYED, {
      meta: { [OPERATION_KEY]: '"mine"', other: "x" },
    });
    const read = c.sent.find(
      (s) => s.method.name === OperationService.methods[0].name,
    )!;
    expect(read.options.meta).toEqual({ other: "x" });
  });

  it("gives every command its own key", async () => {
    const interceptor = operationContext();
    const c = chain(7n);
    const a = (await call(interceptor, c)).meta![OPERATION_KEY];
    const b = (await call(interceptor, c)).meta![OPERATION_KEY];
    expect(a).not.toBe(b);
  });

  // RFC 9651 §3.3.3: a String escapes DQUOTE and backslash and holds
  // printable ASCII only.
  it("encodes a key as a Structured Field String", () => {
    expect(encodeOperationKey('a"b\\c')).toBe('"a\\"b\\\\c"');
    expect(() => encodeOperationKey("é")).toThrow(RangeError);
    expect(() => encodeOperationKey("")).toThrow(RangeError);
  });
});
