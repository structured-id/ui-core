/** Authentication state for the current user session (BFF cookie mode). */
export interface AuthState {
  /** Whether a valid BFF session exists. */
  sessionValid: boolean;
  /** Server-side session identifier (for step-up, session management). */
  sessionId: string | null;
  /** Profile ID of the authenticated user (UUID). */
  profileId: string | null;
  /** Display name of the authenticated user. */
  displayName: string | null;
  /** Email address (may be null if not in session claims). */
  email: string | null;
  /** Preferred username or email — display identifier. */
  preferredUsername: string | null;
}

/** Session information as displayed in the dashboard. */
export interface SessionInfo {
  id: string;
  deviceName: string;
  ipAddress: string;
  location: string | null;
  lastActive: string;
  createdAt: string;
  current: boolean;
}

/** gRPC connection configuration. */
export interface GrpcConfig {
  /** Base URL for gRPC-web transport (e.g., "https://api.example.com"). */
  baseUrl: string;
  /**
   * @deprecated BFF mode always uses credentials: "include".
   * This field is kept for API compatibility but has no effect.
   */
  withCredentials?: boolean;
  /**
   * WebTransport server URL (e.g., "https://wt.api.example.com").
   * When provided, AdaptiveRpcTransport is used with WebTransport as primary
   * and gRPC-web as fallback. Omit to use gRPC-web only.
   */
  webTransportUrl?: string;
  /**
   * SHA-256 certificate hash (hex string) for dev self-signed WebTransport certs.
   * Only needed when connecting to servers with self-signed certificates.
   */
  webTransportCertHash?: string;
  /**
   * Delay in milliseconds before attempting to reconnect WebTransport after failover.
   * Defaults to 5000ms.
   */
  webTransportReconnectDelay?: number;
  /**
   * Callback fired when the active transport changes between "webtransport" and "grpc-web".
   * Use this to show transport status indicators in the UI.
   */
  onTransportChange?: (transport: "webtransport" | "grpc-web") => void;
}
