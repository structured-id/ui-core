/**
 * Shared post-login success handler.
 *
 * A sign-in that an authorization request sent the user to (`rd`, the
 * continuation of that request at the issuer) returns the browser there: the
 * ceremony has set the issuer's IdP session cookie, and the authorization
 * endpoint completes the request with it. Any other `rd` is ignored, so the
 * sign-in page never redirects to an address it did not validate.
 *
 * Otherwise the app's own session comes from its BFF: the handler reads it
 * from the BFF's /auth/userinfo and navigates within the app.
 */
import { useRouter } from "vue-router";
import { useAuthStore } from "../../index";
import { checkBffSession } from "../../index";

export interface LoginSuccessResult {
  sessionId?: string;
}

/** Options of {@link useLoginSuccess}. */
export interface LoginSuccessOptions {
  /**
   * Origin of the SID installation whose issuers may send users to this
   * sign-in page (e.g. `https://sid.example.com`). Without it, `rd` is never
   * followed.
   */
  issuerOrigin?: string;
  /** Leave the app for an absolute URL; defaults to `window.location.assign`. */
  leaveTo?: (url: string) => void;
}

/** Path of an issuer's authorization endpoint: `/i/<32 hex>/oauth2/authorize`. */
const AUTHORIZE_PATH = /^\/i\/[0-9a-f]{32}\/oauth2\/authorize$/;

/** Prefix of the reference a kept authorization request is continued by. */
const REQUEST_URI_PREFIX = "urn:ietf:params:oauth:request_uri:";

/**
 * `rd` when it is exactly the continuation of an authorization request at an
 * issuer of `issuerOrigin`: that origin, an issuer's authorization endpoint,
 * and no parameter but `client_id` and `request_uri`. Anything else is null.
 */
export function authorizationContinuation(
  rd: unknown,
  issuerOrigin: string,
): string | null {
  if (typeof rd !== "string") return null;
  let url: URL;
  let expected: string;
  try {
    url = new URL(rd);
    expected = new URL(issuerOrigin).origin;
  } catch {
    return null;
  }
  if (url.origin !== expected || url.username || url.password || url.hash) {
    return null;
  }
  if (!AUTHORIZE_PATH.test(url.pathname)) return null;
  const names = [...url.searchParams.keys()].sort();
  if (
    names.length !== 2 ||
    names[0] !== "client_id" ||
    names[1] !== "request_uri"
  ) {
    return null;
  }
  if (!url.searchParams.get("request_uri")?.startsWith(REQUEST_URI_PREFIX)) {
    return null;
  }
  if (!url.searchParams.get("client_id")) return null;
  return url.toString();
}

/**
 * Create a login success handler: back to the authorization request the
 * user signs in for, or into the app at `redirectTo`.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useLoginSuccess } from "@structured-id/ui-core/profile";
 * const { onLoginSuccess } = useLoginSuccess("/account", { issuerOrigin });
 * </script>
 * <template>
 *   <SidLoginForm :login-fn="login" @success="onLoginSuccess" />
 * </template>
 * ```
 */
export function useLoginSuccess(
  redirectTo: string,
  options: LoginSuccessOptions = {},
) {
  const auth = useAuthStore();
  const router = useRouter();

  async function onLoginSuccess(_result?: LoginSuccessResult) {
    const back = options.issuerOrigin
      ? authorizationContinuation(
          router.currentRoute.value.query.rd,
          options.issuerOrigin,
        )
      : null;
    if (back) {
      (options.leaveTo ?? ((url: string) => window.location.assign(url)))(back);
      return;
    }

    try {
      const userInfo = await checkBffSession();
      if (userInfo) {
        auth.setBffSession(userInfo);
      }
    } catch {
      // Non-critical — navigation will succeed, route guard will re-check session
    }

    await router.push(redirectTo);
  }

  return { onLoginSuccess };
}
