import { computed } from "vue";
import { useAuthStore } from "../stores/auth";

/**
 * Vue composable for authentication state and actions.
 *
 * Wraps the Pinia auth store with reactive computed properties.
 * Post BFF migration (#536i-3): no token accessors — session validity
 * is based on httpOnly cookie checked via BFF /auth/userinfo on boot.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useAuth } from '@structured-id/ui-core'
 * const { isAuthenticated, displayName, logout } = useAuth()
 * </script>
 * ```
 */
export function useAuth() {
  const store = useAuthStore();

  const isAuthenticated = computed(() => store.isAuthenticated);
  const displayName = computed(() => store.displayName);
  const email = computed(() => store.email);
  const profileId = computed(() => store.profileId);
  const preferredUsername = computed(() => store.preferredUsername);
  const sessionId = computed(() => store.sessionId);

  return {
    isAuthenticated,
    displayName,
    email,
    profileId,
    preferredUsername,
    sessionId,
    setBffSession: store.setBffSession,
    setProfile: store.setProfile,
    logout: store.logout,
  };
}
