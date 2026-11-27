/**
 * Shared Profile presentation: composables for the identity, account, auth
 * and security APIs, and slot-based registration, sign-in and MFA forms. The
 * consuming application owns its routes and selects the API it calls.
 *
 * Import: `@structured-id/ui-core/profile`
 */

// Composables
export * from "./composables";

// Slot-based form components
export * from "./components";

// Upstream identity provider sign-in: what a return keeps
export * from "./upstream";
export * from "./signInEntry";

// A browser sign-in owing its second factor
export * from "./pendingSignIn";

// Auth helper
export { authMeta } from "./auth";
