/**
 * The operation context of keyed calls: SID answers a retried command with
 * its recorded result only when the call names it by a key the caller
 * created before sending it and the server-issued period it was created
 * under. Which methods are keyed is the method's own retry rule.
 */
import {
  UnaryCall,
  type MethodInfo,
  type RpcInterceptor,
  type RpcMetadata,
  type RpcOptions,
} from "@protobuf-ts/runtime-rpc";
import {
  GetOperationPeriodRequest,
  OperationService,
  type OperationPeriod,
} from "@structured-id/proto/sid/v1/common/operation";

/** The metadata entry carrying the key (the `Idempotency-Key` header). */
export const OPERATION_KEY = "idempotency-key";

/** The metadata entry carrying the period (the `SID-Operation-Period` header). */
export const OPERATION_PERIOD = "sid-operation-period";

/** The method option holding a method's retry rule. */
const RETRY_RULE = "sid.v1.common.retry";

/** A period is fetched again this long before the server stops admitting it. */
const PERIOD_MARGIN_MS = 60_000;

/** Whether `method` takes an operation context: its retry rule says keyed. */
export function isKeyed(method: MethodInfo): boolean {
  const rule = (method.options as Record<string, unknown> | undefined)?.[
    RETRY_RULE
  ] as { keyed?: boolean } | undefined;
  return rule?.keyed === true;
}

/**
 * `key` as the header value: a Structured Field String (RFC 9651 §3.3.3,
 * required by draft-ietf-httpapi-idempotency-key-header-08 §2.1), the same
 * encoded value in gRPC metadata and HTTP.
 */
export function encodeOperationKey(key: string): string {
  // RFC 9651 §3.3.3: a String holds printable ASCII only.
  if (!/^[\x20-\x7e]+$/.test(key)) {
    throw new RangeError("an operation key is printable ASCII");
  }
  return `"${key.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

/**
 * An interceptor naming every new keyed command by a fresh key and the
 * current period; other calls pass untouched. A caller retrying one command
 * passes the key and period it first sent, and they are kept. The period is
 * read from the server the calls go to, once, and again only when it is
 * about to stop being admitted.
 */
export function operationContext(): RpcInterceptor {
  let current: { period: string; until: number } | null = null;
  let pending: Promise<string> | null = null;

  function period(fetch: () => Promise<OperationPeriod>): Promise<string> {
    if (current && Date.now() < current.until) {
      return Promise.resolve(current.period);
    }
    // Concurrent first calls share one read.
    pending ??= fetch()
      .then((answer) => {
        const until = answer.acceptedUntil
          ? Number(answer.acceptedUntil.seconds) * 1000 +
            Math.floor(answer.acceptedUntil.nanos / 1e6)
          : 0;
        current = {
          period: answer.period.toString(),
          until: until - PERIOD_MARGIN_MS,
        };
        return current.period;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  }

  return {
    interceptUnary(next, method, input, options) {
      if (!isKeyed(method)) {
        return next(method, input, options);
      }
      const meta = options.meta ?? {};
      const key =
        meta[OPERATION_KEY] ?? encodeOperationKey(crypto.randomUUID());
      const named = (period: string): RpcOptions => ({
        ...options,
        meta: { ...meta, [OPERATION_KEY]: key, [OPERATION_PERIOD]: period },
      });
      const given = meta[OPERATION_PERIOD];
      if (typeof given === "string") {
        return next(method, input, named(given));
      }
      // The period read goes through the same chain, without this call's
      // context.
      const plain: RpcMetadata = { ...meta };
      delete plain[OPERATION_KEY];
      const call = period(
        () =>
          next(
            OperationService.methods[0] as MethodInfo,
            GetOperationPeriodRequest.create(),
            { ...options, meta: plain },
          ).response as Promise<OperationPeriod>,
      ).then((p) => next(method, input, named(p)));
      return new UnaryCall(
        method,
        meta,
        input,
        call.then((c) => c.headers),
        call.then((c) => c.response),
        call.then((c) => c.status),
        call.then((c) => c.trailers),
      );
    },
  };
}
