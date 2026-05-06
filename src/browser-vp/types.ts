/**
 * Browser VP types.
 *
 * See arch/auth/browser-vp.md for full specification.
 */

/** VP strategy — automatically selected based on browser capabilities. */
export type VpStrategy = "prf" | "device-key";

/** Profile state stored in IndexedDB. */
export interface ProfileState {
  /** Which strategy this profile uses. */
  strategy: VpStrategy;

  /** Encrypted profile blob (< 1MB typical). */
  encryptedBlob: ArrayBuffer;

  /** Optimistic sync version with SID server. */
  blobVersion: number;

  // Strategy A (PRF) fields
  /** PRF salt identifier (for versioning). */
  prfSalt?: string;
  /** SHA-256 of master public key (authenticator change detection). */
  masterPublicKeyHash?: string;

  // Strategy B (device-key) fields
  /** Non-extractable CryptoKey reference (browser-managed). */
  cryptoKeyRef?: CryptoKey;

  /** Last sync timestamp with SID server. */
  lastSyncedAt: Date;
  /** SID device ID for this browser instance. */
  deviceId: string;
}

/** Per-service binding stored in IndexedDB. */
export interface BindingEntry {
  /** Opaque BindingId (pairwise per-service). */
  bindingId: string;
  /** HD derivation index for this binding. */
  bindingIndex: number;
  /** Per-binding certificate chain (DER-encoded). */
  certChain: ArrayBuffer;
  /** Certificate expiry date. */
  certExpiry: Date;
  /** Last time a VP was created for this binding. */
  lastUsedAt: Date;
}

/** Key material derived from PRF or generated via WebCrypto. */
export interface DerivedKeys {
  /** ECDSA P-256 signing key (non-extractable). */
  signingKey: CryptoKeyPair;
  /** AES-256-GCM data encryption key. */
  dataKey: CryptoKey;
}

/** Verifiable Presentation payload. */
export interface VerifiablePresentation {
  /** The service sector this VP is bound to. */
  serviceSector: string;
  /** Binding ID (pairwise). */
  bindingId: string;
  /** Signed VP payload (CBOR or JSON). */
  payload: ArrayBuffer;
  /** Signature over payload. */
  signature: ArrayBuffer;
  /** Certificate chain for verification. */
  certChain: ArrayBuffer;
  /** Nonce from relying party (replay protection). */
  nonce: string;
  /** Audience (relying party origin). */
  audience: string;
}

/** Options for VP creation request from a relying party. */
export interface VpRequest {
  /** Nonce for replay protection. */
  nonce: string;
  /** Requested claims (e.g., ["email", "name"]). */
  requestedClaims: string[];
  /** Audience (relying party origin). */
  audience: string;
  /** Service sector identifier. */
  serviceSector: string;
}

/** Result of browser VP initialization. */
export interface BrowserVpContext {
  /** Active strategy. */
  strategy: VpStrategy;
  /** Profile ID. */
  profileId: string;
  /** Whether VP creation is available (keys + blob + cert ready). */
  ready: boolean;
}
