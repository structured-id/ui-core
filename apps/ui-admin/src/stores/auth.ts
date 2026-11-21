/**
 * Auth store — re-exported from ui-core (single source of truth).
 *
 * All auth state, tokens, and profile data managed by the shared store.
 * App-specific behavior (route guards) lives in boot/auth.ts.
 */
export { useAuthStore } from "@structured-id/ui-core";
