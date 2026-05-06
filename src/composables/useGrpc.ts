import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import type { RpcTransport } from "@protobuf-ts/runtime-rpc";
import { ref, type Ref } from "vue";
import type { GrpcConfig } from "../types/auth";
import { AdaptiveRpcTransport } from "../transport/adaptive";
import type { TransportType } from "../transport/adaptive";

/** Shared RPC transport instance (gRPC-web or AdaptiveRpcTransport). */
let _transport: RpcTransport | null = null;
/** Separate reference to AdaptiveRpcTransport when active (avoids instanceof). */
let _adaptive: AdaptiveRpcTransport | null = null;

/**
 * Initialize the gRPC transport. Call once at app startup.
 *
 * When `config.webTransportUrl` is provided, creates an AdaptiveRpcTransport
 * with WebTransport as the primary and gRPC-web as the fallback. The initial
 * WebTransport connection is attempted asynchronously (non-blocking).
 *
 * Without `config.webTransportUrl`, falls back to plain gRPC-web (same as before).
 *
 * After BFF migration (#536i-3): `credentials: "include"` is always set
 * so the httpOnly BFF session cookie is sent with every gRPC-web request.
 *
 * @example
 * ```ts
 * // gRPC-web only
 * initGrpc({ baseUrl: 'https://api.example.com' })
 *
 * // With WebTransport failover
 * initGrpc({
 *   baseUrl: 'https://api.example.com',
 *   webTransportUrl: 'https://wt.api.example.com',
 * })
 * ```
 */
export function initGrpc(config: GrpcConfig): void {
  if (config.webTransportUrl) {
    const adaptive = new AdaptiveRpcTransport({
      grpcWebUrl: config.baseUrl,
      webTransportUrl: config.webTransportUrl,
      webTransportCertHash: config.webTransportCertHash,
      reconnectDelay: config.webTransportReconnectDelay,
      onTransportChange: config.onTransportChange,
      // Always include credentials so the BFF session cookie is attached.
      // The BFF proxy exchanges the cookie for a Bearer token server-side.
      fetchInit: { credentials: "include" },
    });
    // Attempt WebTransport connection in background — non-blocking.
    adaptive.init().catch(() => {
      // Silently falls back to gRPC-web if WebTransport is unavailable.
    });
    _adaptive = adaptive;
    _transport = adaptive;
  } else {
    _adaptive = null;
    _transport = new GrpcWebFetchTransport({
      baseUrl: config.baseUrl,
      // Always include credentials so the BFF session cookie is attached.
      // The BFF proxy exchanges the cookie for a Bearer token server-side.
      fetchInit: { credentials: "include" },
    });
  }
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
 * Close the transport and release resources (timers, connections).
 * Call during app teardown if using WebTransport.
 */
export function closeTransport(): void {
  _adaptive?.close();
  _adaptive = null;
  _transport = null;
}

/**
 * Get the currently active transport type.
 * Returns "grpc-web" if AdaptiveRpcTransport is not used or WebTransport
 * is not available.
 */
export function getTransportType(): TransportType {
  return _adaptive?.activeTransport ?? "grpc-web";
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

export type { TransportType };
