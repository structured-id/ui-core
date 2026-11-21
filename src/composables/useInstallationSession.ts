/**
 * The installation's own browser session, as the administration console uses
 * it: the console calls the installation's API at `<installation>/api` with
 * the session cookie the installation set when the user signed in, and echoes
 * the session's CSRF token on every call. No application session, no tokens
 * in the page.
 *
 * Usage:
 *   1. `initInstallationSession(installationUrl)` at boot
 *   2. `checkInstallationSession()` reads the session and its CSRF token
 *   3. `installationTransport()` carries the console's API calls
 *   4. `installationSignInUrl()` is where a signed-out user signs in
 */
import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import {
  RpcError,
  type RpcInterceptor,
  type RpcTransport,
} from "@protobuf-ts/runtime-rpc";
import { AuthServiceClient } from "@structured-id/proto/sid/v1/authn/auth.client";
import { operationContext } from "./operationContext";

/** The signed-in installation session as the console sees it. */
export interface InstallationSession {
  /** Whether the session's Profile administers the installation now. */
  administrator: boolean;
  /** When the session ends at the latest. */
  expiresAt: Date | null;
}

let _base: string | null = null;
let _transport: RpcTransport | null = null;
/** The CSRF token of the session read last; browser-only state. */
let _csrf: string | null = null;

/** The session's CSRF token on every call's metadata. */
const csrf: RpcInterceptor = {
  interceptUnary(next, method, input, options) {
    return next(method, input, withCsrf(options));
  },
  interceptServerStreaming(next, method, input, options) {
    return next(method, input, withCsrf(options));
  },
};

function withCsrf<T extends { meta?: Record<string, string | string[]> }>(
  options: T,
): T {
  return _csrf
    ? { ...options, meta: { ...options.meta, "x-csrf-token": _csrf } }
    : options;
}

/**
 * Set up the installation at `installationUrl` (its public URL). The cookie
 * travels with the calls: the console may be on a sibling host of the same
 * site, whose calls are cross-origin.
 */
export function initInstallationSession(installationUrl: string): void {
  _base = installationUrl.replace(/\/+$/, "");
  _csrf = null;
  _transport = new GrpcWebFetchTransport({
    baseUrl: `${_base}/api`,
    fetchInit: { credentials: "include" },
    interceptors: [csrf, operationContext()],
  });
}

/** The transport of the console's API calls. Throws before set-up. */
export function installationTransport(): RpcTransport {
  if (!_transport) {
    throw new Error(
      "installation session not initialized. Call initInstallationSession() at boot.",
    );
  }
  return _transport;
}

/**
 * Read the session with `GetBrowserSession`, keeping its CSRF token for the
 * calls that follow. Null when signed out (UNAUTHENTICATED); any other
 * failure is thrown, so an outage never reads as a signed-out user.
 */
export async function checkInstallationSession(): Promise<InstallationSession | null> {
  const client = new AuthServiceClient(installationTransport());
  try {
    const { response } = await client.getBrowserSession({});
    _csrf = response.csrfToken || null;
    const seconds = response.expiresAt?.seconds;
    return {
      administrator: response.administrator,
      expiresAt:
        seconds === undefined ? null : new Date(Number(seconds) * 1000),
    };
  } catch (err) {
    if (err instanceof RpcError && err.code === "UNAUTHENTICATED") {
      _csrf = null;
      return null;
    }
    throw err;
  }
}

/** Where a signed-out user signs in: the installation's account pages. */
export function installationSignInUrl(): string {
  if (_base === null) {
    throw new Error(
      "installation session not initialized. Call initInstallationSession() at boot.",
    );
  }
  return `${_base}/account/`;
}
