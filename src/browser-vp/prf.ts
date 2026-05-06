/**
 * WebAuthn PRF extension support (Strategy A).
 *
 * PRF (Pseudo-Random Function) extension allows deriving
 * deterministic secrets from a passkey. Same passkey on any
 * synced device produces the same PRF output → same keys.
 *
 * See arch/auth/browser-vp.md § Strategy A: Passkey-Derived PPK.
 */

const PRF_EVAL_LABEL = "sid-ppk-v1";
const PRF_PROBE_LABEL = "sid-probe";
const encoder = new TextEncoder();

/**
 * Detect whether the browser supports WebAuthn PRF extension.
 *
 * Attempts a PRF evaluation on an existing passkey. Returns false
 * if PRF is unsupported — no error thrown.
 *
 * Browser support (2026): Chrome 116+, Edge 116+, Safari 17.4+,
 * Chrome Android, Safari iOS 17.4+. ~90% coverage.
 */
export async function hasPrfSupport(): Promise<boolean> {
  try {
    // Check if PublicKeyCredential and extensions are available
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      return false;
    }

    // Check if PRF extension is supported via static method (if available)
    if (typeof PublicKeyCredential.getClientCapabilities === "function") {
      try {
        const caps = await PublicKeyCredential.getClientCapabilities();
        if (caps && "prf" in caps) {
          return Boolean(caps.prf);
        }
      } catch {
        // Fall through to probe-based detection
      }
    }

    // Probe-based detection: try to use PRF in a get() call
    // This requires an existing passkey for this origin
    const result = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: window.location.hostname,
        userVerification: "discouraged",
        extensions: {
          prf: {
            eval: {
              first: encoder.encode(PRF_PROBE_LABEL),
            },
          },
        } as AuthenticationExtensionsClientInputs,
      },
    });

    if (!result) return false;

    const ext = (
      result as PublicKeyCredential
    ).getClientExtensionResults() as Record<string, unknown>;
    const prfResults = ext?.prf as
      | { results?: { first?: ArrayBuffer } }
      | undefined;

    return prfResults?.results?.first != null;
  } catch {
    return false;
  }
}

/**
 * Evaluate PRF extension during passkey authentication.
 *
 * Returns the raw PRF output (32 bytes) which serves as the
 * entropy source for key derivation.
 *
 * @param credentialId - Optional: specific credential to use.
 * @returns PRF output bytes, or null if PRF evaluation failed.
 */
export async function evaluatePrf(
  credentialId?: ArrayBuffer,
): Promise<ArrayBuffer | null> {
  try {
    const allowCredentials: PublicKeyCredentialDescriptor[] | undefined =
      credentialId ? [{ type: "public-key", id: credentialId }] : undefined;

    const result = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: window.location.hostname,
        userVerification: "required",
        allowCredentials,
        extensions: {
          prf: {
            eval: {
              first: encoder.encode(PRF_EVAL_LABEL),
            },
          },
        } as AuthenticationExtensionsClientInputs,
      },
    });

    if (!result) return null;

    const ext = (
      result as PublicKeyCredential
    ).getClientExtensionResults() as Record<string, unknown>;
    const prfResults = ext?.prf as
      | { results?: { first?: ArrayBuffer } }
      | undefined;

    return prfResults?.results?.first ?? null;
  } catch {
    return null;
  }
}

/**
 * Create a passkey with PRF extension (first-time setup).
 *
 * Returns both the credential and the initial PRF output.
 */
export async function createPasskeyWithPrf(
  userId: ArrayBuffer,
  userName: string,
  rpName: string,
): Promise<{ credential: PublicKeyCredential; prfOutput: ArrayBuffer } | null> {
  try {
    const result = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: {
          name: rpName,
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256 fallback
        ],
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
        extensions: {
          prf: {
            eval: {
              first: encoder.encode(PRF_EVAL_LABEL),
            },
          },
        } as AuthenticationExtensionsClientInputs,
      },
    });

    if (!result) return null;

    const credential = result as PublicKeyCredential;
    const ext = credential.getClientExtensionResults() as Record<
      string,
      unknown
    >;
    const prfResults = ext?.prf as
      | { results?: { first?: ArrayBuffer } }
      | undefined;
    const prfOutput = prfResults?.results?.first;

    if (!prfOutput) return null;

    return { credential, prfOutput };
  } catch {
    return null;
  }
}
