/**
 * Browser VP — Zero-Load Auth in Browser.
 *
 * Public API for browser-based Verifiable Presentation creation.
 * Automatically selects the best strategy based on browser capabilities:
 *
 * - **Strategy A (PRF):** Passkey PRF extension → deterministic keys.
 *   Cross-device via passkey sync. ~90% browser coverage (2026).
 *
 * - **Strategy B (device-key):** Random WebCrypto key, wrapped for sync.
 *   Each browser = separate device. Fallback for non-PRF browsers.
 *
 * See arch/auth/browser-vp.md for full specification.
 *
 * Reference: Prudnikov, D. (2026). "Client-Side Verifiable Presentation System
 * with Passkey-Derived Persistent Keys and Pairwise Service Bindings."
 * doi:10.5281/zenodo.19387768 — https://doi.org/10.5281/zenodo.19387768
 */

// Types
export type {
  VpStrategy,
  ProfileState,
  BindingEntry,
  DerivedKeys,
  VerifiablePresentation,
  VpRequest,
  BrowserVpContext,
} from "./types";

// PRF extension
export { hasPrfSupport, evaluatePrf, createPasskeyWithPrf } from "./prf";

// Cryptographic primitives
export {
  deriveKeysFromPrf,
  generateDeviceKey,
  generateDataKey,
  wrapKey,
  unwrapSigningKey,
  deriveWrappingKey,
  encrypt,
  decrypt,
  sign,
  exportPublicKey,
  sha256,
} from "./crypto";

// IndexedDB storage
export {
  saveProfileState,
  loadProfileState,
  deleteProfileState,
  saveBinding,
  loadBinding,
  listBindings,
  deleteBinding,
  clearAll,
  isIndexedDbAvailable,
} from "./storage";

// VP creation
export { createVp, needsRenewal, getExpiringSoon } from "./vp";

// ── Strategy selection ──

import { hasPrfSupport } from "./prf";
import { isIndexedDbAvailable } from "./storage";
import type { VpStrategy, BrowserVpContext } from "./types";

/**
 * Detect the best VP strategy for this browser.
 *
 * Returns "prf" if WebAuthn PRF extension is supported,
 * "device-key" otherwise. Returns null if Browser VP is
 * not possible (no IndexedDB, no WebCrypto).
 */
export async function detectStrategy(): Promise<VpStrategy | null> {
  // Prerequisites
  if (typeof window === "undefined") return null;
  if (!isIndexedDbAvailable()) return null;
  if (!window.crypto?.subtle) return null;

  // Try PRF first (primary strategy)
  if (await hasPrfSupport()) {
    return "prf";
  }

  // Fallback to device key
  return "device-key";
}

/**
 * Initialize Browser VP for a profile.
 *
 * This is the main entry point. It:
 * 1. Detects the best strategy
 * 2. Checks for existing state in IndexedDB
 * 3. Returns a context object indicating readiness
 *
 * If not ready, the caller should trigger setup flow
 * (passkey creation for PRF, or key generation for device-key).
 */
export async function initBrowserVp(
  profileId: string,
): Promise<BrowserVpContext | null> {
  const strategy = await detectStrategy();
  if (!strategy) return null;

  const { loadProfileState } = await import("./storage");
  const state = await loadProfileState(profileId);

  return {
    strategy,
    profileId,
    ready: state != null && state.strategy === strategy,
  };
}
