import type { LocationQuery } from "vue-router";

/**
 * `path` carrying the page's authorization continuation (`rd`), so moving
 * between sign-in and registration still returns to the request the issuer
 * sent the browser for. The page that follows the link validates `rd` again.
 */
export function withContinuation(path: string, query: LocationQuery): string {
  const rd = query.rd;
  return typeof rd === "string" && rd
    ? `${path}?rd=${encodeURIComponent(rd)}`
    : path;
}
