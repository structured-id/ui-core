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
}
