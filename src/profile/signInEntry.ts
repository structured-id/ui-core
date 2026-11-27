/**
 * The sign-in a page belongs to, as its address names it: the authorization
 * request the sign-in completes (`rd`) and, with it, what the issuer that
 * sent the browser said about itself: the route its ceremonies run on
 * (`route=/i/<handle>`, as a root-addressed issuer on a shared host names it)
 * and whether it offers its federated entry (`federated=1`).
 *
 * Every step of a sign-in passes these on unchanged, so a next page opened
 * afresh reads the same issuer as the first one did. They choose nothing by
 * themselves: the issuer confirms or refuses the request at the address the
 * page reads.
 */
import { computed, type ComputedRef } from "vue";
import { useRoute } from "vue-router";

/** What a page of a sign-in passes on to the next one, as a query. */
export type SignInEntry = {
  rd?: string;
  route?: string;
  federated?: string;
};

/**
 * `hint` when it is an issuer route (`/i/<handle>`); `undefined` for
 * anything else, which never chooses a path.
 */
export function issuerRouteHint(hint: unknown): string | undefined {
  return typeof hint === "string" && /^\/i\/[A-Za-z0-9_-]+$/.test(hint)
    ? hint
    : undefined;
}

/**
 * The part of `query` that names the sign-in. Without a request there is no
 * sign-in to name; a route that is not an issuer route and a flag other than
 * the issuer's own are not passed on.
 */
export function signInEntryOf(query: Record<string, unknown>): SignInEntry {
  const { rd, route, federated } = query;
  if (typeof rd !== "string") return {};
  const entry: SignInEntry = { rd };
  const hint = issuerRouteHint(route);
  if (hint !== undefined) entry.route = hint;
  if (federated === "1") entry.federated = "1";
  return entry;
}

/** `path` addressed with what `entry` names, as a link's address. */
export function signInAddress(path: string, entry: SignInEntry): string {
  const parts = (["rd", "route", "federated"] as const).flatMap((name) => {
    const value = entry[name];
    return value === undefined ? [] : `${name}=${encodeURIComponent(value)}`;
  });
  return parts.length ? `${path}?${parts.join("&")}` : path;
}

/** The sign-in the current page belongs to, for its links and next pages. */
export function useSignInEntry(): ComputedRef<SignInEntry> {
  const route = useRoute();
  return computed(() => signInEntryOf(route.query));
}
