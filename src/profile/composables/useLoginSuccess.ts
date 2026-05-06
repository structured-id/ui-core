/**
 * Shared post-login success handler.
 *
 * After BFF migration (#536i-3): tokens are set server-side via BFF session cookie.
 * The SPA no longer stores tokens — it only calls checkBffSession() to populate
 * the auth store from the BFF /auth/userinfo endpoint.
 *
 * The BFF login flow:
 *   1. App redirects to /auth/login (PKCE initiation)
 *   2. User authenticates on the IdP
 *   3. BFF callback sets httpOnly session cookie
 *   4. BFF redirects back to SPA
 *   5. SPA calls checkBffSession() → setBffSession() → navigates to dashboard
 *
 * For apps where the SPA IS the auth UI (personal-ui OPAQUE flow):
 *   The OPAQUE login completes, sid-auth sets the server-side session,
 *   and this handler fetches userinfo from BFF to restore session state.
 *
 * Used by all apps (personal-ui, admin-ui, frontend) for consistent behavior.
 */
import { useRouter } from "vue-router";
import { useAuthStore } from "../../index";
import { checkBffSession } from "../../index";

export interface LoginSuccessResult {
  sessionId?: string;
}

/**
 * Create a login success handler that restores BFF session state and navigates.
 *
 * @param redirectTo - Route to navigate after successful login (e.g., "/account", "/admin")
 *
 * @example
 * ```vue
 * <script setup>
 * import { useLoginSuccess } from "@structured-id/ui-core/profile";
 * const { onLoginSuccess } = useLoginSuccess("/account");
 * </script>
 * <template>
 *   <SidLoginForm :login-fn="login" @success="onLoginSuccess" />
 * </template>
 * ```
 */
export function useLoginSuccess(redirectTo: string) {
  const auth = useAuthStore();
  const router = useRouter();

  async function onLoginSuccess(_result?: LoginSuccessResult) {
    // Restore BFF session from /auth/userinfo — the BFF set the httpOnly cookie
    // during the login flow. We fetch userinfo to populate the auth store.
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
