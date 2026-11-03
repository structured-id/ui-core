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

/**
 * A chain answering the period read with `period` until `untilMs`; with
 * `refused`, a command's response is refused while its headers, status and
 * trailers arrive, as a non-OK gRPC answer does.
 */
function chain(
  period: bigint,
  untilMs = Date.now() + 3_600_000,
  refused = false,
) {
  const sent: Array<{ method: MethodInfo; options: RpcOptions }> = [];
  const next = vi.fn(
    (method: MethodInfo, _input: object, options: RpcOptions) => {
      sent.push({ method, options });
      const read = method.name === OperationService.methods[0].name;
      const response = read
        ? Promise.resolve({
            period,
            acceptedUntil: {
              seconds: BigInt(Math.floor(untilMs / 1000)),
              nanos: 0,
            },
          })
        : refused
          ? Promise.reject(new Error("refused"))
          : Promise.resolve({});
      response.catch(() => {});
      const status = Promise.resolve({
        code: refused && !read ? "FAILED_PRECONDITION" : "OK",
        detail: "",
      });
      return {
        headers: Promise.resolve({ answered: "yes" }),
        response,
        status,
        trailers: Promise.resolve({}),
        then: (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
          response.then(f, r),
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

  // A caller keeping the call's request headers retries the same command:
  // they hold the key and the period the command was actually sent with.
  it("shows the context it sent in the call's request headers", async () => {
    const c = chain(7n);
    const answered = operationContext().interceptUnary!(
      c.next as never,
      KEYED,
      {},
      {},
    );
    await answered.response;
    const sent = c.sent.find((s) => s.method.name === KEYED.name)!.options;
    expect(answered.requestHeaders[OPERATION_KEY]).toBe(
      sent.meta![OPERATION_KEY],
    );
    expect(answered.requestHeaders[OPERATION_PERIOD]).toBe("7");
  });

  // A refused command still has its own headers, status and trailers: the
  // wrapper forwards each, rather than failing them all with the response.
  it("keeps a refused command's status and headers", async () => {
    const answered = operationContext().interceptUnary!(
      chain(7n, undefined, true).next as never,
      KEYED,
      {},
      {},
    );
    await expect(answered.response).rejects.toThrow("refused");
    expect((await answered.status).code).toBe("FAILED_PRECONDITION");
    expect(await answered.headers).toEqual({ answered: "yes" });
  });

  // The period read is shared by concurrent commands: one caller's
  // cancellation or deadline is not passed to it, so the others go on.
  it("does not give the shared period read one caller's cancellation", async () => {
    const interceptor = operationContext();
    const c = chain(7n);
    const cancelled = new AbortController();
    const first = interceptor.interceptUnary!(
      c.next as never,
      KEYED,
      {},
      {
        abort: cancelled.signal,
        timeout: 5,
      },
    );
    const second = interceptor.interceptUnary!(c.next as never, KEYED, {}, {});
    cancelled.abort();
    await second.response;
    first.response.catch(() => {});
    const read = c.sent.find(
      (s) => s.method.name === OperationService.methods[0].name,
    )!;
    expect(read.options.abort).toBeUndefined();
    // Its own deadline, not the first caller's.
    expect(read.options.timeout).not.toBe(5);
  });

  // A period read that stalls does not hold a caller past its own
  // cancellation or deadline, and the shared read has a deadline of its own.
  it("ends a caller's wait for the period at its own cancellation or deadline", async () => {
    const sent: RpcOptions[] = [];
    const stalled = vi.fn((_m: MethodInfo, _i: object, options: RpcOptions) => {
      sent.push(options);
      const never = new Promise<never>(() => {});
      return {
        headers: never,
        response: never,
        status: never,
        trailers: never,
      } as never;
    });
    const interceptor = operationContext();
    const cancelled = new AbortController();
    const aborted = interceptor.interceptUnary!(
      stalled as never,
      KEYED,
      {},
      {
        abort: cancelled.signal,
      },
    );
    cancelled.abort();
    await expect(aborted.response).rejects.toMatchObject({ code: "CANCELLED" });

    const late = interceptor.interceptUnary!(
      stalled as never,
      KEYED,
      {},
      {
        timeout: 5,
      },
    );
    await expect(late.response).rejects.toMatchObject({
      code: "DEADLINE_EXCEEDED",
    });
    expect(typeof sent[0].timeout).toBe("number");
  });

  // RFC 9651 §3.3.3: a String escapes DQUOTE and backslash and holds
  // printable ASCII only.
  it("encodes a key as a Structured Field String", () => {
    expect(encodeOperationKey('a"b\\c')).toBe('"a\\"b\\\\c"');
    expect(() => encodeOperationKey("é")).toThrow(RangeError);
    expect(() => encodeOperationKey("")).toThrow(RangeError);
  });
});
