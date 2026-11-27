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
import { UpstreamProviderId } from "@structured-id/ids";
import {
  issuerRouteHint,
  signInEntryOf,
  type SignInEntry,
} from "./signInEntry";

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
  provider: UpstreamProviderId;
  /** The authorization request the sign-in completes, if one sent the user. */
  rd: string | null;
  /** The ceremony route the request's issuer named, if it named one. */
  route?: string;
  /** Whether the request's issuer offered its federated entry. */
  federated?: boolean;
}

const PREFIX = "sid.upstream.";

/** Keep `pending` for the return carrying `state`; the provider by its text form. */
export function rememberUpstream(
  storage: Storage,
  state: string,
  pending: PendingUpstream,
): void {
  storage.setItem(
    PREFIX + state,
    JSON.stringify({
      provider: pending.provider.toString(),
      rd: pending.rd,
      route: pending.route,
      federated: pending.federated === true ? true : undefined,
    }),
  );
}

/**
 * The sign-in `pending` was started in, as the pages pass it on: the request
 * and, with it, its issuer's route and federated entry.
 */
export function signInEntryOfPending(pending: PendingUpstream): SignInEntry {
  if (pending.rd === null) return {};
  const entry: SignInEntry = { rd: pending.rd };
  if (pending.route !== undefined) entry.route = pending.route;
  if (pending.federated) entry.federated = "1";
  return entry;
}

/** What was kept for `state`, left in place; `undefined` when nothing is. */
export function peekUpstream(
  storage: Storage,
  state: string,
): PendingUpstream | undefined {
  const kept = storage.getItem(PREFIX + state);
  if (kept === null) return undefined;
  try {
    const parsed = JSON.parse(kept) as {
      provider?: unknown;
      rd?: unknown;
      route?: unknown;
      federated?: unknown;
    };
    if (typeof parsed.provider !== "string") return undefined;
    const pending: PendingUpstream = {
      // An entry whose provider is no identifier was not kept by this code.
      provider: UpstreamProviderId.parse(parsed.provider),
      rd: typeof parsed.rd === "string" ? parsed.rd : null,
    };
    const route = issuerRouteHint(parsed.route);
    if (route !== undefined) pending.route = route;
    if (parsed.federated === true) pending.federated = true;
    return pending;
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
 * The sign-in this page load belongs to, read before anything is addressed:
 * what its query names, or on the callback page what was kept for its
 * `state`. The callback's own query names no sign-in: the provider's return
 * carries none, and anyone can add to it.
 */
export function signInEntryOfPage(
  location: Pick<Location, "pathname" | "search">,
  storage: Storage,
  callbackPath: string = UPSTREAM_CALLBACK_PATH,
): SignInEntry {
  const query = new URLSearchParams(location.search);
  if (location.pathname === callbackPath) {
    const state = query.get("state");
    const pending = state ? peekUpstream(storage, state) : undefined;
    return pending ? signInEntryOfPending(pending) : {};
  }
  return signInEntryOf(Object.fromEntries(query));
}

/**
 * The authorization request this page load completes: the `rd` of
 * {@link signInEntryOfPage}.
 */
export function upstreamRequestOfPage(
  location: Pick<Location, "pathname" | "search">,
  storage: Storage,
  callbackPath: string = UPSTREAM_CALLBACK_PATH,
): string | null {
  return signInEntryOfPage(location, storage, callbackPath).rd ?? null;
}
