/**
 * Verifiable Presentation creation.
 *
 * Builds and signs VPs using cached keys and profile blob.
 * VP creation is fully offline (~50ms with biometric cache).
 *
 * See arch/auth/browser-vp.md § VP Creation.
 */

import type { VpRequest, VerifiablePresentation, BindingEntry } from "./types";
import { sign } from "./crypto";
import { loadBinding, saveBinding } from "./storage";

const encoder = new TextEncoder();

/**
 * Create a Verifiable Presentation for a service.
 *
 * @param request - VP request from the relying party.
 * @param signingKey - ECDSA P-256 private key (master or per-binding).
 * @param profileBlob - Decrypted profile blob.
 * @returns Signed VP, or null if binding not found.
 */
export async function createVp(
  request: VpRequest,
  signingKey: CryptoKey,
  profileBlob: ArrayBuffer,
): Promise<VerifiablePresentation | null> {
  // Load binding for this service sector
  const binding = await loadBinding(request.serviceSector);
  if (!binding) {
    return null;
  }

  // Check certificate expiry
  if (binding.certExpiry < new Date()) {
    // Certificate expired — VP creation blocked
    // Caller should trigger online renewal
    return null;
  }

  // Build VP payload
  const payload = buildPayload(request, binding, profileBlob);

  // Sign with binding key
  const signature = await sign(payload, signingKey);

  // Update last used timestamp
  await saveBinding(request.serviceSector, {
    ...binding,
    lastUsedAt: new Date(),
  });

  return {
    serviceSector: request.serviceSector,
    bindingId: binding.bindingId,
    payload,
    signature,
    certChain: binding.certChain,
    nonce: request.nonce,
    audience: request.audience,
  };
}

/**
 * Build the VP payload to be signed.
 *
 * The payload contains:
 * - nonce (replay protection)
 * - audience (relying party)
 * - bindingId (pairwise identifier)
 * - requested claims (selective disclosure)
 * - timestamp
 */
function buildPayload(
  request: VpRequest,
  binding: BindingEntry,
  _profileBlob: ArrayBuffer,
): ArrayBuffer {
  // Simplified payload structure.
  // Production: SD-JWT or Merkle-based selective disclosure
  // from the profile blob.
  const payload = {
    nonce: request.nonce,
    aud: request.audience,
    sub: binding.bindingId,
    iat: Math.floor(Date.now() / 1000),
    claims: request.requestedClaims,
  };

  return encoder.encode(JSON.stringify(payload)).buffer as ArrayBuffer;
}

/**
 * Check if a binding's certificate needs renewal.
 *
 * Renewal is attempted 7 days before expiry (background).
 */
export function needsRenewal(binding: BindingEntry): boolean {
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return binding.certExpiry.getTime() - Date.now() < sevenDays;
}

/**
 * List all bindings that need certificate renewal.
 */
export async function getExpiringSoon(): Promise<
  Array<{ serviceSector: string } & BindingEntry>
> {
  const { listBindings } = await import("./storage");
  const all = await listBindings();
  return all.filter((b) => needsRenewal(b));
}
