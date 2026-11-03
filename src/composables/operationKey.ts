/**
 * The operation key of state-changing calls: SID answers a retried command
 * with its recorded result only when the call names it by a key the caller
 * created before sending it.
 */
import type { RpcInterceptor, RpcOptions } from "@protobuf-ts/runtime-rpc";

/** The metadata entry carrying the key (the `Idempotency-Key` header). */
export const OPERATION_KEY = "idempotency-key";

/**
 * `options` with an operation key: the caller's own when it passed one (a
 * caller retrying one command passes the same key every time), a new one
 * otherwise.
 */
export function withOperationKey(options: RpcOptions): RpcOptions {
  if (options.meta?.[OPERATION_KEY]) {
    return options;
  }
  return {
    ...options,
    meta: { ...options.meta, [OPERATION_KEY]: crypto.randomUUID() },
  };
}

/**
 * Adds an operation key to every unary call of a method not declared free of
 * side effects; reads carry none.
 */
export const operationKey: RpcInterceptor = {
  interceptUnary(next, method, input, options) {
    return next(
      method,
      input,
      method.idempotency === "NO_SIDE_EFFECTS"
        ? options
        : withOperationKey(options),
    );
  },
};
