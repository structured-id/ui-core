import { SessionCookieDomain } from "@structured-id/proto/sid/v1/admin/settings";

/** A session domain scope, as it is stored or as a form would save it. */
export interface SessionScope {
  domain: SessionCookieDomain;
  subdomains: string[];
  subdomainPattern: string;
}

/** How far a scope's cookie reaches: wider scopes have higher numbers. */
function reach(domain: SessionCookieDomain): number {
  return domain === SessionCookieDomain.ALL_SUBDOMAINS
    ? 2
    : domain === SessionCookieDomain.SELECTED_SUBDOMAINS
      ? 1
      : 0;
}

/**
 * Whether `after` shares the session with fewer hosts than `before`, by the
 * rule the installation applies when it saves the change: a narrower kind of
 * scope, a selected host no longer listed, or a stored expression changed or
 * removed, since its former matches cannot be known to survive.
 */
export function narrows(before: SessionScope, after: SessionScope): boolean {
  const selected = SessionCookieDomain.SELECTED_SUBDOMAINS;
  if (before.domain !== selected || after.domain !== selected) {
    return reach(after.domain) < reach(before.domain);
  }
  return (
    before.subdomains.some((host) => !after.subdomains.includes(host)) ||
    (before.subdomainPattern !== "" &&
      before.subdomainPattern !== after.subdomainPattern)
  );
}
