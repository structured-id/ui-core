/**
 * BFF (Backend-For-Frontend) session management composable.
 *
 * After migration from localStorage to cookie-based auth (#536i-3):
 *   - Tokens are stored server-side in sid-auth-proxy BFF sessions
 *   - SPA only holds a non-httpOnly CSRF cookie + httpOnly session cookie
 *   - gRPC calls go through BFF proxy which injects Bearer header
 *   - Client JS never sees the access token
 *
 * Usage:
 *   1. Call `initBff(bffBaseUrl)` at app boot (e.g., VITE_BFF_URL)
 *   2. Call `checkBffSession()` to verify session + populate auth store
 *   3. Call `startBffLogin()` to redirect user to PKCE auth flow
 *   4. Call `bffLogout()` to clear session (sends X-CSRF-Token header)
 */

/** User info returned from BFF /auth/userinfo endpoint. */
export interface BffUserInfo {
  /** Subject identifier (ProfileId for CE, PersonaId for SaaS). */
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
}

let _bffBaseUrl: string | null = null;
let _bffCookieName: string = "__Host-sid-bff";

/**
 * Initialize BFF configuration. Call once at app boot.
 *
 * @param baseUrl  BFF base URL (e.g., "https://app.structured.id" or VITE_BFF_URL)
 * @param cookieName  BFF session cookie name (default: "__Host-sid-bff")
 */
export function initBff(baseUrl: string, cookieName?: string): void {
  _bffBaseUrl = baseUrl;
  if (cookieName) _bffCookieName = cookieName;
}

/** Get the configured BFF base URL, or null if not initialized. */
export function getBffBaseUrl(): string | null {
  return _bffBaseUrl;
}

/**
 * Read the CSRF token from the non-httpOnly CSRF cookie.
 * The BFF sets a cookie `{cookieName}_csrf=<token>; SameSite=Lax` (NOT httpOnly)
 * so JS can read it for double-submit CSRF protection.
 */
function readCsrfToken(): string | null {
  const name = `${_bffCookieName}_csrf=`;
  const cookies = document.cookie.split("; ");
  const found = cookies.find((c) => c.startsWith(name));
  return found ? (found.split("=")[1] ?? null) : null;
}

/**
 * Check if the BFF session is valid by calling GET /auth/userinfo.
 *
 * Returns user info if session is active, null if unauthenticated.
 * The browser automatically sends the httpOnly session cookie.
 */
export async function checkBffSession(
  bffBaseUrl?: string,
): Promise<BffUserInfo | null> {
  const base = bffBaseUrl ?? _bffBaseUrl;
  if (!base) return null;
  try {
    const resp = await fetch(`${base}/auth/userinfo`, {
      credentials: "include",
    });
    if (resp.status === 401 || resp.status === 404) return null;
    if (!resp.ok) return null;
    return (await resp.json()) as BffUserInfo;
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
 * @param postLoginRedirect  URL to redirect to after successful auth
 */
export function startBffLogin(
  bffBaseUrl?: string,
  postLoginRedirect?: string,
): void {
  const base = bffBaseUrl ?? _bffBaseUrl;
  if (!base) {
    console.warn("[BFF] Not initialized. Call initBff() at app boot.");
    return;
  }
  const url = postLoginRedirect
    ? `${base}/auth/login?post_login_redirect=${encodeURIComponent(postLoginRedirect)}`
    : `${base}/auth/login`;
  window.location.href = url;
}

/**
 * Log out by calling POST /auth/logout with X-CSRF-Token header.
 *
 * The BFF validates the CSRF header, clears server-side session,
 * and sends Set-Cookie headers to clear both cookies.
 *
 * @param bffBaseUrl  Override BFF base URL
 */
export async function bffLogout(bffBaseUrl?: string): Promise<void> {
  const base = bffBaseUrl ?? _bffBaseUrl;
  if (!base) return;
  const csrf = readCsrfToken();
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
