/**
 * The page's application session.
 *
 * The tokens live in the application's UI host; the page holds only the
 * host's httpOnly session cookie. The page reads its session and signs out
 * through `sid.v1.authn.ApplicationSessionService` over gRPC-Web on its own
 * origin, so the cookie travels with the same-origin request. The session's
 * CSRF token comes with the session read and every state-changing call echoes
 * it in `x-csrf-token`.
 *
 * Usage:
 *   1. Call `initBff(baseUrl)` at app boot ("" for the page's own origin)
 *   2. Call `checkBffSession()` to read the session and populate the auth store
 *   3. Call `startBffLogin()` to send the browser to sign-in
 *   4. Call `bffLogout()` to end the session
 */
import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import { RpcError, type RpcTransport } from "@protobuf-ts/runtime-rpc";
import { ApplicationSessionServiceClient } from "@structured-id/proto/sid/v1/authn/application_session.client";
import { GrantOutcome } from "@structured-id/proto/sid/v1/authn/application_session";

/** The signed-in user of the page's session. */
export interface BffUserInfo {
  /** Opaque subject identifier; its form depends on the issuer, so it is never parsed as a profile id. */
  sub: string;
  /** Email address, when disclosed to this application. */
  email?: string | null;
  /** Display name, when disclosed. */
  name?: string | null;
  /** Username, when disclosed. */
  preferred_username?: string | null;
  /** Authentication Context Class Reference of the sign-in. */
  acr?: string | null;
  /** The session's CSRF token, echoed in `x-csrf-token` by every state-changing call. */
  csrf_token?: string | null;
}

let _bffBaseUrl: string | null = null;
let _session: ApplicationSessionServiceClient | null = null;
/**
 * The CSRF token of the session the page last read. Browser-only state:
 * the session read runs in the browser, never during server rendering.
 */
let _csrfToken: string | null = null;

/**
 * The session service of the host at `baseUrl`, under the `/api` mount that
 * serves a page's calls; the cookie never travels to another origin.
 */
function sessionClient(baseUrl: string): ApplicationSessionServiceClient {
  const transport: RpcTransport = new GrpcWebFetchTransport({
    baseUrl: `${baseUrl}/api`,
    fetchInit: { credentials: "same-origin" },
  });
  return new ApplicationSessionServiceClient(transport);
}

/**
 * Initialize the session's UI host. Call once at app boot.
 *
 * @param baseUrl  The UI host's base URL: "" for the page's own origin, where it usually is
 */
export function initBff(baseUrl: string): void {
  _bffBaseUrl = baseUrl;
  _session = sessionClient(baseUrl);
}

/** Get the configured base URL, or null if not initialized. */
export function getBffBaseUrl(): string | null {
  return _bffBaseUrl;
}

/**
 * The CSRF token the UI host gave with the session read, or null without a
 * read session. The host refuses a state-changing call without it.
 */
export function bffCsrfToken(): string | null {
  return _csrfToken;
}

/**
 * Read the page's session with `GetApplicationSession`.
 *
 * Returns the user when the session is live and keeps its CSRF token for
 * the calls that follow; null when the page is signed out (UNAUTHENTICATED)
 * or the session was not set up. Any other failure (an unavailable session
 * store, an unreachable host) is thrown: an outage never reads as a
 * signed-out user.
 */
export async function checkBffSession(
  bffBaseUrl?: string,
): Promise<BffUserInfo | null> {
  const client =
    bffBaseUrl !== undefined ? sessionClient(bffBaseUrl) : _session;
  if (client === null) return null;
  try {
    const { response } = await client.getApplicationSession({});
    _csrfToken = response.csrfToken || null;
    return {
      sub: response.sub,
      email: response.email ?? null,
      name: response.name ?? null,
      preferred_username: response.preferredUsername ?? null,
      acr: response.acr || null,
      csrf_token: _csrfToken,
    };
  } catch (err) {
    if (err instanceof RpcError && err.code === "UNAUTHENTICATED") {
      _csrfToken = null;
      return null;
    }
    throw err;
  }
}

/**
 * Send the browser to sign-in (`StartSignIn`, a navigation to
 * `/auth/login`).
 *
 * After sign-in the UI host sets its httpOnly session cookie and returns to
 * the page, which calls `checkBffSession()` on load.
 *
 * @param bffBaseUrl  Override the base URL (uses the configured one if not provided)
 * @param postLoginRedirect  Local path to return to after sign-in
 *   (`/account/security?tab=keys`), sent as `rd`; the host returns anything
 *   else to its root
 */
export function startBffLogin(
  bffBaseUrl?: string,
  postLoginRedirect?: string,
): void {
  const base = bffBaseUrl ?? _bffBaseUrl;
  if (base === null) {
    console.warn("[session] Not initialized. Call initBff() at app boot.");
    return;
  }
  const url = postLoginRedirect
    ? `${base}/auth/login?rd=${encodeURIComponent(postLoginRedirect)}`
    : `${base}/auth/login`;
  window.location.href = url;
}

/**
 * What became of the grant behind an ended session: revoked by the issuer,
 * left to expire because the issuer did not revoke it, none held, or
 * unknown.
 */
export type BffGrantOutcome = "revoked" | "not_revoked" | "none" | "unknown";

/** The outcome of a sign-out: whether the session ended, and its grant. */
export type BffLogoutResult =
  { ended: true; grant: BffGrantOutcome } | { ended: false };

const GRANT_OUTCOMES: Readonly<Partial<Record<GrantOutcome, BffGrantOutcome>>> =
  {
    [GrantOutcome.REVOKED]: "revoked",
    [GrantOutcome.NOT_REVOKED]: "not_revoked",
    [GrantOutcome.NONE]: "none",
  };

/**
 * End the session with `EndApplicationSession`, carrying the session's CSRF
 * token in `x-csrf-token`.
 *
 * The host checks the token, ends the session, clears its cookie and says
 * whether the issuer revoked the grant. `ended: false` means the session may
 * still be alive (refused, unavailable, unreachable). The page forgets the
 * CSRF token either way.
 *
 * @param bffBaseUrl  Override the base URL
 */
export async function bffLogout(bffBaseUrl?: string): Promise<BffLogoutResult> {
  const client =
    bffBaseUrl !== undefined ? sessionClient(bffBaseUrl) : _session;
  if (client === null) return { ended: false };
  const csrf = _csrfToken;
  _csrfToken = null;
  try {
    const { response } = await client.endApplicationSession(
      {},
      { meta: csrf ? { "x-csrf-token": csrf } : {} },
    );
    return { ended: true, grant: GRANT_OUTCOMES[response.grant] ?? "unknown" };
  } catch {
    return { ended: false };
  }
}

/**
 * Vue composable for the session actions.
 */
export function useBffAuth() {
  return {
    checkBffSession,
    startBffLogin,
    bffLogout,
    getBffBaseUrl,
    initBff,
  };
}
