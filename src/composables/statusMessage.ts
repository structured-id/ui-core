/**
 * The gRPC-Web transport hands over a refusal's `grpc-message` as it travels:
 * percent-encoded (gRPC over HTTP/2, "Status-Message"). This interceptor
 * decodes it, so every caller that shows `err.message` shows the server's
 * text, not its encoding.
 */
import {
  RpcError,
  type RpcInterceptor,
  UnaryCall,
} from "@protobuf-ts/runtime-rpc";

/** `message` percent-decoded; unchanged when it is not valid encoding. */
export function decodeStatusMessage(message: string): string {
  try {
    return decodeURIComponent(message);
  } catch {
    return message;
  }
}

/** `err` with its status message decoded, when it is a refusal. */
function decoded(err: unknown): unknown {
  if (!(err instanceof RpcError)) return err;
  const fixed = new RpcError(
    decodeStatusMessage(err.message),
    err.code,
    err.meta,
  );
  fixed.methodName = err.methodName;
  fixed.serviceName = err.serviceName;
  return fixed;
}

function rethrowDecoded<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((err: unknown) => {
    throw decoded(err);
  });
}

/** Decodes the status message of every refusal a unary call answers. */
export function decodedStatusMessages(): RpcInterceptor {
  return {
    interceptUnary(next, method, input, options) {
      const call = next(method, input, options);
      return new UnaryCall(
        call.method,
        call.requestHeaders,
        call.request,
        rethrowDecoded(call.headers),
        rethrowDecoded(call.response),
        rethrowDecoded(call.status),
        rethrowDecoded(call.trailers),
      );
    },
  };
}
