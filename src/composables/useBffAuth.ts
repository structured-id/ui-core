/**
 * BFF (Backend-For-Frontend) session management composable.
 *
 * The tokens live in sid-auth-proxy's BFF session; the page holds only the
 * BFF's httpOnly session cookie. gRPC calls go through the BFF, which adds
 * the Bearer token itself, so the page never sees an access token. The
 * session's CSRF token comes with the session check and every state-changing
 * call echoes it in `X-CSRF-Token`.
 *
 * Usage:
 *   1. Call `initBff(bffBaseUrl)` at app boot
 *   2. Call `checkBffSession()` to verify the session + populate the auth store
 *   3. Call `startBffLogin()` to redirect the user to the PKCE auth flow
 *   4. Call `bffLogout()` to clear the session
 */

/** User info returned from BFF /auth/userinfo endpoint. */
export interface BffUserInfo {
  /** Opaque subject identifier; its form depends on the issuer, so it is never parsed as a profile id. */
  sub: string;
  /** Email address (if available in session claims). */
  email?: string | null;
  /** Display name (full name from profile). */
  name?: string | null;
  /** Username or email — preferred identifier for display. */
  preferred_username?: string | null;
  /** Group memberships. */
  groups?: string[] | null;
  /** Authentication Context Class Reference (acr_values). */
  acr?: string | null;
  /** Role assignments. */
  roles?: string[] | null;
  /** The session's CSRF token, echoed in `X-CSRF-Token` by every state-changing call. */
  csrf_token?: string | null;
}

let _bffBaseUrl: string | null = null;
/**
 * The CSRF token of the session the page last checked. Browser-only state:
 * the session check runs in the browser, never during server rendering.
 */
let _csrfToken: string | null = null;

/**
 * Initialize BFF configuration. Call once at app boot.
 *
 * @param baseUrl  BFF base URL: "" for the page's own origin, where the BFF usually is
 */
export function initBff(baseUrl: string): void {
  _bffBaseUrl = baseUrl;
}

/** Get the configured BFF base URL, or null if not initialized. */
export function getBffBaseUrl(): string | null {
  return _bffBaseUrl;
}

/**
 * The CSRF token the BFF gave with the session check, or null without a
 * checked session. The BFF refuses a state-changing call without it.
 */
export function bffCsrfToken(): string | null {
  return _csrfToken;
}

/**
 * Check if the BFF session is valid by calling GET /auth/userinfo.
 *
 * Returns user info if session is active, null if unauthenticated, and
 * keeps the session's CSRF token for the calls that follow.
 * The browser automatically sends the httpOnly session cookie.
 * An empty base URL is the page's own origin, where the BFF usually is.
 */
export async function checkBffSession(
  bffBaseUrl?: string,
): Promise<BffUserInfo | null> {
  const base = bffBaseUrl ?? _bffBaseUrl;
  if (base === null) return null;
  try {
    const resp = await fetch(`${base}/auth/userinfo`, {
      credentials: "include",
    });
    if (!resp.ok) {
      _csrfToken = null;
      return null;
    }
    const info = (await resp.json()) as BffUserInfo;
    _csrfToken = info.csrf_token ?? null;
    return info;
  } catch {
    return null;
  }
}

/**
 * Redirect user to BFF login (PKCE flow initiation).
 *
 * After successful login, BFF sets httpOnly session cookie and redirects
 * back to the SPA. The SPA should call checkBffSession() on load to restore state.
 *
 * @param bffBaseUrl  Override BFF base URL (uses configured URL if not provided)
 * @param postLoginRedirect  Path on the BFF's origin to return to after
 *   sign-in (`/account/security?tab=keys`), sent as the BFF's `rd`
 *   parameter; the BFF returns anything else to its root
 */
export function startBffLogin(
  bffBaseUrl?: string,
  postLoginRedirect?: string,
): void {
  const base = bffBaseUrl ?? _bffBaseUrl;
  if (base === null) {
    console.warn("[BFF] Not initialized. Call initBff() at app boot.");
    return;
  }
  const url = postLoginRedirect
    ? `${base}/auth/login?rd=${encodeURIComponent(postLoginRedirect)}`
    : `${base}/auth/login`;
  window.location.href = url;
}

/**
 * Log out by calling POST /auth/logout with X-CSRF-Token header.
 *
 * The BFF validates the CSRF header, clears server-side session,
 * and sends a Set-Cookie header to clear the session cookie. The token
 * dies with the session either way.
 *
 * @param bffBaseUrl  Override BFF base URL
 */
export async function bffLogout(bffBaseUrl?: string): Promise<void> {
  const base = bffBaseUrl ?? _bffBaseUrl;
  if (base === null) return;
  const csrf = _csrfToken;
  _csrfToken = null;
  try {
    await fetch(`${base}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: csrf ? { "X-CSRF-Token": csrf } : {},
    });
  } catch {
    // Best-effort — local state is cleared by caller regardless
  }
}

/**
 * Vue composable for BFF auth actions.
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
