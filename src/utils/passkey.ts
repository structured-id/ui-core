/**
 * The browser side of SID's passkey ceremonies, whatever transport carries
 * them: the options a start returns (`CredentialCreationOptions` /
 * `CredentialRequestOptions` as JSON, `publicKey` inside) in, the
 * `RegistrationResponseJSON` / `AuthenticationResponseJSON` a finish reads
 * out (WebAuthn Level 3 §5.1.4), on the browser's own JSON forms.
 */

/** How a ceremony ended without a credential. */
export type PasskeyFailure =
  /** The user cancelled, or the authenticator timed out (`NotAllowedError`). */
  | "cancelled"
  /** The authenticator already holds a passkey of this account (`InvalidStateError`). */
  | "already-registered"
  /** Anything else, the browser's message kept in `cause`. */
  | "failed";

/** A ceremony that produced no credential, and why. */
export class PasskeyError extends Error {
  constructor(
    readonly failure: PasskeyFailure,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "PasskeyError";
  }
}

/** The `publicKey` member of the options JSON the server sent. */
function publicKeyOf<T>(options: Uint8Array): T {
  const parsed = JSON.parse(new TextDecoder().decode(options)) as {
    publicKey?: T;
  };
  if (!parsed.publicKey) {
    throw new PasskeyError("failed", "The server sent no passkey options");
  }
  return parsed.publicKey;
}

/** Why the browser refused, as the page tells it. */
function refusal(error: unknown): PasskeyError {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return new PasskeyError(
      "cancelled",
      "The request was cancelled or timed out",
      {
        cause: error,
      },
    );
  }
  if (error instanceof DOMException && error.name === "InvalidStateError") {
    return new PasskeyError(
      "already-registered",
      "This authenticator already holds a passkey for this account",
      { cause: error },
    );
  }
  return new PasskeyError(
    "failed",
    error instanceof Error ? error.message : "The passkey ceremony failed",
    { cause: error },
  );
}

/** `credential` as the JSON bytes a finish reads. */
function responseBytes(credential: Credential | null): Uint8Array {
  if (!(credential instanceof PublicKeyCredential)) {
    throw new PasskeyError("failed", "The browser returned no passkey");
  }
  return new TextEncoder().encode(JSON.stringify(credential.toJSON()));
}

/**
 * Create a passkey from a registration start's `options`; resolves to the
 * response a registration finish takes.
 */
export async function createPasskey(options: Uint8Array): Promise<Uint8Array> {
  const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(
    publicKeyOf<PublicKeyCredentialCreationOptionsJSON>(options),
  );
  let credential: Credential | null;
  try {
    credential = await navigator.credentials.create({ publicKey });
  } catch (error) {
    throw refusal(error);
  }
  return responseBytes(credential);
}

/**
 * Assert a passkey for a sign-in or step-up start's `options`; resolves to
 * the response its finish takes. With no allowed credentials in `options`
 * the browser offers the discoverable passkeys it holds for the RP.
 */
export async function getPasskey(options: Uint8Array): Promise<Uint8Array> {
  const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(
    publicKeyOf<PublicKeyCredentialRequestOptionsJSON>(options),
  );
  let credential: Credential | null;
  try {
    credential = await navigator.credentials.get({ publicKey });
  } catch (error) {
    throw refusal(error);
  }
  return responseBytes(credential);
}
