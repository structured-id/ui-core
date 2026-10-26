/**
 * profile-core — shared Profile-level UI library.
 *
 * Composables for identity, account, auth, and security APIs.
 * Slot-based form components for registration, login, MFA.
 * Shared between profile-ui-ce, profile-ui-ee, and frontend.
 *
 * Import: `@structured-id/ui-core/profile`
 */

// Composables
export * from "./composables";

// Slot-based form components
export * from "./components";

// Upstream identity provider sign-in: what a return keeps
export * from "./upstream";

// Auth helper
export { authMeta } from "./auth";
