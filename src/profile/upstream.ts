/**
 * Sign-in through an upstream identity provider the issuer trusts. The page
 * asks the issuer to start it, keeps what the return needs under the
 * provider's `state` in this tab's session storage, and goes to the
 * provider. The provider returns the browser to the callback page with
 * `code` and `state`; the page completes the sign-in at the same issuer and
 * continues the authorization request that sent the user there (`rd`).
 *
 * The kept entry is no credential: the issuer keeps the request's state,
 * PKCE verifier and nonce itself and checks `state` on completion.
 */

/** Where the provider returns the browser, unless the app names its own. */
export const UPSTREAM_CALLBACK_PATH = "/account/upstream/callback";

/**
 * The redirect URI registered with the provider for `origin`: exact and
 * without a query, as the provider compares it (RFC 6749 §3.1.2).
 */
export function upstreamCallbackUri(
  origin: string,
  path: string = UPSTREAM_CALLBACK_PATH,
): string {
  return `${origin}${path}`;
}

/** What the return to the callback page needs. */
export interface PendingUpstream {
  /** The provider the sign-in started at. */
  provider: string;
  /** The authorization request the sign-in completes, if one sent the user. */
  rd: string | null;
}

const PREFIX = "sid.upstream.";

/** Keep `pending` for the return carrying `state`. */
export function rememberUpstream(
  storage: Storage,
  state: string,
  pending: PendingUpstream,
): void {
  storage.setItem(PREFIX + state, JSON.stringify(pending));
}

/** What was kept for `state`, left in place; `undefined` when nothing is. */
export function peekUpstream(
  storage: Storage,
  state: string,
): PendingUpstream | undefined {
  const kept = storage.getItem(PREFIX + state);
  if (kept === null) return undefined;
  try {
    const parsed = JSON.parse(kept) as Partial<PendingUpstream>;
    if (typeof parsed.provider !== "string" || !parsed.provider) {
      return undefined;
    }
    return {
      provider: parsed.provider,
      rd: typeof parsed.rd === "string" ? parsed.rd : null,
    };
  } catch {
    return undefined;
  }
}

/** What was kept for `state`, removed: a return completes once. */
export function takeUpstream(
  storage: Storage,
  state: string,
): PendingUpstream | undefined {
  const pending = peekUpstream(storage, state);
  storage.removeItem(PREFIX + state);
  return pending;
}

/**
 * The authorization request this page load completes: `rd` in the query, or
 * on the callback page the one kept for its `state`. The callback's own `rd`
 * is never used: the provider's return carries none.
 */
export function upstreamRequestOfPage(
  location: Pick<Location, "pathname" | "search">,
  storage: Storage,
  callbackPath: string = UPSTREAM_CALLBACK_PATH,
): string | null {
  const query = new URLSearchParams(location.search);
  if (location.pathname === callbackPath) {
    const state = query.get("state");
    return state ? (peekUpstream(storage, state)?.rd ?? null) : null;
  }
  return query.get("rd");
}
