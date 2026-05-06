import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { BffUserInfo } from "../composables/useBffAuth";

/**
 * Auth store — BFF cookie session (post #536i-3 migration).
 *
 * Tokens are stored server-side in sid-auth-proxy BFF sessions.
 * The SPA never sees access/refresh tokens — only an httpOnly session cookie.
 * `isAuthenticated` is based on BFF session validity, set via `setBffSession()`.
 *
 * Boot sequence:
 *   1. App boots → calls checkBffSession() → populates store via setBffSession()
 *   2. Route guard → checks isAuthenticated → redirects to BFF login if false
 *   3. On BFF logout → call logout() to clear local state
 */
export const useAuthStore = defineStore("auth", () => {
  // ── BFF session state ─────────────────────────────────────────────

  /** Whether a valid BFF session exists (set by setBffSession on boot). */
  const sessionValid = ref(false);

  /** Server-side session identifier (for step-up, session management). */
  const sessionId = ref<string | null>(null);

  // ── Profile info (populated from BFF /auth/userinfo) ──────────────

  /** Profile ID of the authenticated user (= sub from BFF userinfo). */
  const profileId = ref<string | null>(null);
  /** Display name. */
  const displayName = ref<string | null>(null);
  /** Email address. */
  const email = ref<string | null>(null);
  /** Username or email — preferred display identifier. */
  const preferredUsername = ref<string | null>(null);

  // ── Computed ─────────────────────────────────────────────────────

  const isAuthenticated = computed(() => sessionValid.value);

  // ── Actions ──────────────────────────────────────────────────────

  /**
   * Populate store from BFF session.
   * Called after successful checkBffSession() on app boot or after login redirect.
   */
  function setBffSession(info: BffUserInfo): void {
    sessionValid.value = true;
    profileId.value = info.sub;
    displayName.value = info.name ?? null;
    email.value = info.email ?? null;
    preferredUsername.value = info.preferred_username ?? null;
  }

  /**
   * Update profile display data (e.g., after profile edit).
   */
  function setProfile(profile: {
    id: string;
    displayName?: string | null;
    email?: string | null;
  }): void {
    profileId.value = profile.id;
    displayName.value = profile.displayName ?? null;
    email.value = profile.email ?? null;
  }

  /**
   * Clear all session state. Call after bffLogout() completes.
   */
  function logout(): void {
    sessionValid.value = false;
    sessionId.value = null;
    profileId.value = null;
    displayName.value = null;
    email.value = null;
    preferredUsername.value = null;
  }

  return {
    sessionValid,
    sessionId,
    profileId,
    displayName,
    email,
    preferredUsername,
    isAuthenticated,
    setBffSession,
    setProfile,
    logout,
  };
});
