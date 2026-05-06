import parsePhoneNumberFromString, {
  isValidPhoneNumber,
} from "libphonenumber-js";

export type LoginInputType = "email" | "phone" | "username" | "unknown";

export interface NormalizedPrincipal {
  /** Normalized value for storage, uniqueness check, and login lookup. */
  value: string;
  /** Original display form (mixed case preserved for usernames). */
  display: string;
  type: LoginInputType;
}

/**
 * Global username rules per arch/identity/identity-model.md:
 *   Display:    ^[a-zA-Z0-9_]{3,32}$ — user's original input, mixed case preserved
 *   Normalized: ^[a-z0-9_]{3,32}$    — lowercase, for storage + uniqueness + login
 *   - cannot start or end with underscore
 *   - no consecutive underscores (__)
 *
 * For detection (prematch) we use a relaxed version:
 *   - accepts minLength (3 for login, 6 for registration)
 *   - case-insensitive (will be lowercased on normalization)
 */
const USERNAME_MAX_LENGTH = 32;

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
  const re = new RegExp(
    `^[a-zA-Z0-9_]{${minUsernameLength},${USERNAME_MAX_LENGTH}}$`,
  );
  if (re.test(trimmed) && !trimmed.startsWith("_") && !trimmed.endsWith("_")) {
    return "username";
  }

  return "unknown";
}

/**
 * Normalize principal value for server submission.
 *
 * - Email: lowercase, strip dots before @, strip +aliases
 * - Phone: E.164 format via libphonenumber-js
 * - Username: lowercase, validate per arch rules
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
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        throw new Error("Invalid email address");
      }
      // Remove dots before @, strip +alias, lowercase
      const [localRaw, domain] = trimmed.split("@");
      const local = localRaw.replace(/\./g, "").replace(/\+.*$/, "");
      const normalized = `${local}@${domain}`.toLowerCase();
      return { value: normalized, display: normalized, type: "email" };
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

      // Global username
      const normalized = trimmed.toLowerCase();
      const re = new RegExp(
        `^[a-z0-9_]{${minUsernameLength},${USERNAME_MAX_LENGTH}}$`,
      );
      if (
        !re.test(normalized) ||
        normalized.startsWith("_") ||
        normalized.endsWith("_") ||
        normalized.includes("__")
      ) {
        throw new Error("Invalid username");
      }
      return { value: normalized, display: trimmed, type: "username" };
    }

    default:
      throw new Error("Cannot determine principal type");
  }
}
