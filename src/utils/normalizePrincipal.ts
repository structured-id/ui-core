import parsePhoneNumberFromString, {
  isValidPhoneNumber,
} from "libphonenumber-js";
import { isValidEmail } from "./validators";

export type LoginInputType = "email" | "phone" | "username" | "unknown";

export interface NormalizedPrincipal {
  /** Normalized value for storage, uniqueness check, and login lookup. */
  value: string;
  /** Original display form (mixed case preserved for usernames). */
  display: string;
  type: LoginInputType;
}

/**
 * A global username as the user types it: letters of any script, combining
 * marks, digits and `_`, at most 32 code points in NFC, no `_` at either
 * end. It is sent as typed (NFC, case kept); the server applies its
 * repertoire and minimum and derives the lookup key, as it does for email.
 */
const USERNAME_MAX_LENGTH = 32;
const USERNAME_SHAPE = /^[\p{L}\p{M}\p{N}_]+$/u;

/** The length of `name` in code points of its NFC form. */
function codePoints(name: string): number {
  return [...name.normalize("NFC")].length;
}

/**
 * Detect principal type from user input.
 *
 * Priority: phone (+...) > email (@) > username (alphanumeric).
 * Returns "unknown" if input doesn't match any pattern.
 *
 * @param minUsernameLength - minimum chars to detect as username (3 for login, 6 for register)
 */
export function detectLoginInputType(
  input: string,
  minUsernameLength = 3,
): LoginInputType {
  const trimmed = input.trim();
  if (!trimmed) return "unknown";

  if (trimmed.startsWith("+")) return "phone";
  if (trimmed.includes("@")) return "email";

  // Federated username: login#domain (e.g., alice#acme.corp)
  // No minUsernameLength — org admin decides login part length
  if (trimmed.includes("#")) {
    const hashIdx = trimmed.indexOf("#");
    const loginPart = trimmed.substring(0, hashIdx);
    const domainPart = trimmed.substring(hashIdx + 1);
    if (
      loginPart.length >= 1 &&
      loginPart.length <= USERNAME_MAX_LENGTH &&
      domainPart.length > 0 &&
      /^[a-zA-Z0-9_]+$/.test(loginPart) &&
      !loginPart.startsWith("_") &&
      !loginPart.endsWith("_")
    ) {
      return "username";
    }
    return "unknown";
  }

  // Global username: no #, no @, no +
  const length = codePoints(trimmed);
  if (
    USERNAME_SHAPE.test(trimmed) &&
    length >= minUsernameLength &&
    length <= USERNAME_MAX_LENGTH &&
    !trimmed.startsWith("_") &&
    !trimmed.endsWith("_")
  ) {
    return "username";
  }

  return "unknown";
}

/**
 * Normalize principal value for server submission.
 *
 * - Email: as typed (trimmed); the server applies the email policy
 * - Phone: E.164 format via libphonenumber-js
 * - Username: as typed (trimmed, NFC); a federated one lowercased
 *
 * @param minUsernameLength - minimum chars for username (3 for login, 6 for register)
 * Throws if value doesn't pass validation for detected type.
 */
export function normalizePrincipal(
  input: string,
  minUsernameLength = 3,
): NormalizedPrincipal {
  const trimmed = input.trim();
  const type = detectLoginInputType(trimmed, minUsernameLength);

  switch (type) {
    case "email": {
      // Sent as typed: the server validates it, derives the lookup key and
      // keeps this spelling as the address to mail.
      if (!isValidEmail(trimmed)) {
        throw new Error("Invalid email address");
      }
      return { value: trimmed, display: trimmed, type: "email" };
    }

    case "phone": {
      if (!isValidPhoneNumber(trimmed)) {
        throw new Error("Invalid phone number");
      }
      const parsed = parsePhoneNumberFromString(trimmed);
      if (!parsed) throw new Error("Cannot parse phone number");
      const e164 = parsed.format("E.164");
      return { value: e164, display: e164, type: "phone" };
    }

    case "username": {
      // Federated username: login#domain
      if (trimmed.includes("#")) {
        const hashIdx = trimmed.indexOf("#");
        const loginPart = trimmed.substring(0, hashIdx).toLowerCase();
        const domainPart = trimmed.substring(hashIdx + 1).toLowerCase();

        // No minUsernameLength for federated — org admin decides
        const loginRe = new RegExp(`^[a-z0-9_]{1,${USERNAME_MAX_LENGTH}}$`);
        if (
          !loginRe.test(loginPart) ||
          loginPart.startsWith("_") ||
          loginPart.endsWith("_") ||
          loginPart.includes("__")
        ) {
          throw new Error("Invalid username");
        }
        if (!domainPart || !/^[a-z0-9._-]+$/.test(domainPart)) {
          throw new Error("Invalid federated domain");
        }
        const normalized = `${loginPart}#${domainPart}`;
        return { value: normalized, display: trimmed, type: "username" };
      }

      // Global username: detection checked its shape and length; sent as
      // typed, the server derives the key.
      const name = trimmed.normalize("NFC");
      if (name.includes("__")) {
        throw new Error("Invalid username");
      }
      return { value: name, display: name, type: "username" };
    }

    default:
      throw new Error("Cannot determine principal type");
  }
}
