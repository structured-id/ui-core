/**
 * What an authenticator app is given to enroll a TOTP factor: the shared
 * secret in Base32 and the key URI it can scan or open.
 */
import {
  TotpAlgorithm,
  type TotpEnrollmentChallenge,
} from "@structured-id/proto/sid/v1/authn/auth";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** `bytes` in Base32 without padding (RFC 4648 §6), as authenticator apps take it. */
export function base32(bytes: Uint8Array): string {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

const ALGORITHMS: Partial<Record<TotpAlgorithm, string>> = {
  [TotpAlgorithm.SHA1]: "SHA1",
  [TotpAlgorithm.SHA256]: "SHA256",
  [TotpAlgorithm.SHA512]: "SHA512",
};

/**
 * The `otpauth://totp/` key URI of `challenge` (the Key Uri Format that
 * authenticator apps read): label `issuer:account`, the secret, and the
 * algorithm, digits and period the server chose. A challenge naming no
 * algorithm cannot be enrolled and throws.
 */
export function totpKeyUri(challenge: TotpEnrollmentChallenge): string {
  const algorithm = ALGORITHMS[challenge.algorithm];
  if (!algorithm) {
    throw new Error("The server named no TOTP algorithm to enroll");
  }
  const label = `${encodeURIComponent(challenge.issuer)}:${encodeURIComponent(challenge.accountName)}`;
  const query = new URLSearchParams({
    secret: base32(challenge.sharedSecret),
    issuer: challenge.issuer,
    algorithm,
    digits: String(challenge.digits),
    period: String(challenge.periodSeconds),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}
