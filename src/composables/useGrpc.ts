import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import type { RpcTransport } from "@protobuf-ts/runtime-rpc";
import { ref, type Ref } from "vue";
import type { GrpcConfig } from "../types/auth";

/** Shared gRPC-web transport instance. */
let _transport: RpcTransport | null = null;

/**
 * Initialize the gRPC-web transport. Call once at app startup.
 *
 * `credentials: "include"` is always set so the httpOnly BFF session cookie
 * is sent with every request.
 *
 * @example
 * ```ts
 * initGrpc({ baseUrl: 'https://api.example.com' })
 * ```
 */
export function initGrpc(config: GrpcConfig): void {
  _transport = new GrpcWebFetchTransport({
    baseUrl: config.baseUrl,
    // The BFF proxy exchanges the session cookie for a Bearer token
    // server-side.
    fetchInit: { credentials: "include" },
  });
}

/**
 * Get the shared RPC transport. Throws if not initialized.
 */
export function getTransport(): RpcTransport {
  if (!_transport) {
    throw new Error(
      "gRPC transport not initialized. Call initGrpc() at app startup.",
    );
  }
  return _transport;
}

/**
 * Drop the shared transport; the next use needs `initGrpc()` again.
 */
export function closeTransport(): void {
  _transport = null;
}

/**
 * Vue composable for gRPC transport.
 *
 * @example
 * ```ts
 * const { transport } = useGrpc()
 * const client = new AuthServiceClient(transport.value)
 * ```
 */
export function useGrpc() {
  const transport: Ref<RpcTransport | null> = ref(null);

  if (_transport) {
    transport.value = _transport;
  }

  return {
    transport,
    getTransport,
    initGrpc,
  };
}
