/**
 * The operation context of keyed calls: SID answers a retried command with
 * its recorded result only when the call names it by a key the caller
 * created before sending it and the server-issued period it was created
 * under. Which methods are keyed is the method's own retry rule.
 */
import {
  RpcError,
  UnaryCall,
  type MethodInfo,
  type RpcInterceptor,
  type RpcMetadata,
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

/** The shared period read's own deadline: a stalled read is not kept. */
const PERIOD_READ_TIMEOUT_MS = 10_000;

/**
 * `waited`, ended by the caller's own cancellation or deadline as a call
 * would end: CANCELLED or DEADLINE_EXCEEDED.
 */
function within<T>(
  waited: Promise<T>,
  abort: AbortSignal | undefined,
  deadline: Date | undefined,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cancelled = () =>
      reject(new RpcError("the call was cancelled", "CANCELLED"));
    if (abort?.aborted) {
      cancelled();
      return;
    }
    abort?.addEventListener("abort", cancelled, { once: true });
    const timer =
      deadline === undefined
        ? undefined
        : setTimeout(
            () =>
              reject(
                new RpcError("the call's deadline passed", "DEADLINE_EXCEEDED"),
              ),
            Math.max(0, deadline.getTime() - Date.now()),
          );
    const settle = () => {
      abort?.removeEventListener("abort", cancelled);
      clearTimeout(timer);
    };
    waited.then(
      (value) => {
        settle();
        resolve(value);
      },
      (error: unknown) => {
        settle();
        reject(error);
      },
    );
  });
}

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
      // The headers the command is sent with; the call shows them, so a
      // caller keeping them retries the same command.
      const sent: RpcMetadata = {
        ...meta,
        [OPERATION_KEY]:
          meta[OPERATION_KEY] ?? encodeOperationKey(crypto.randomUUID()),
      };
      const given = meta[OPERATION_PERIOD];
      if (typeof given === "string") {
        return next(method, input, { ...options, meta: sent });
      }
      // The period read goes through the same chain, without this call's
      // context, and is shared by concurrent commands: no one caller's
      // cancellation or deadline is given to it, it has its own.
      const plain: RpcMetadata = { ...meta };
      delete plain[OPERATION_KEY];
      const { abort, timeout, ...shared } = options;
      // The caller's deadline covers the wait for the period and the
      // command together.
      const deadline =
        typeof timeout === "number" ? new Date(Date.now() + timeout) : timeout;
      // The underlying call is held in a box: a UnaryCall is thenable, and
      // a promise resolving to it would wait for its whole response.
      const call = within(
        period(
          () =>
            next(
              OperationService.methods[0] as MethodInfo,
              GetOperationPeriodRequest.create(),
              { ...shared, meta: plain, timeout: PERIOD_READ_TIMEOUT_MS },
            ).response as Promise<OperationPeriod>,
        ),
        abort,
        deadline,
      ).then((p) => {
        sent[OPERATION_PERIOD] = p;
        return {
          inner: next(method, input, {
            ...options,
            timeout: deadline,
            meta: sent,
          }),
        };
      });
      // A caller awaits only the parts it needs; a failed period read fails
      // each part without an unhandled rejection, as the transport's own do.
      const part = <T>(pick: (c: Awaited<typeof call>) => Promise<T>) => {
        const promise = call.then(pick);
        promise.catch(() => {});
        return promise;
      };
      return new UnaryCall(
        method,
        sent,
        input,
        part((c) => c.inner.headers),
        part((c) => c.inner.response),
        part((c) => c.inner.status),
        part((c) => c.inner.trailers),
      );
    },
  };
}
