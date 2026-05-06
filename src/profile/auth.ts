/**
 * Auth metadata helper for profile-core composables.
 *
 * After BFF migration (#536i-3): returns empty metadata.
 * The BFF proxy injects the Bearer token server-side from the httpOnly session cookie.
 * Client JS never holds tokens — no authorization header sent from the browser.
 */

/**
 * Get gRPC metadata for authenticated requests.
 * In BFF mode: returns empty object — BFF adds Authorization: Bearer automatically.
 */
export function authMeta(): Record<string, string> {
  return {};
}
