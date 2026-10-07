/**
 * Whether `value` has the shape of one mailbox: a local part and a domain
 * around the last `@`, whitespace only inside a quoted local part. Advisory:
 * the server's email policy decides admission (internal single-label domains
 * and quoted local parts may be admitted), so this refuses only what can
 * never be an address.
 */
export function isValidEmail(value: string): boolean {
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const quoted =
    local.length > 1 && local.startsWith('"') && local.endsWith('"');
  return !/\s/.test(domain) && (quoted || !/\s/.test(local));
}

/** Phone number validation (E.164 format). */
export function isValidPhone(value: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(value);
}

/** UUID v4/v7 format validation. */
export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/** Username validation: letters, numbers, hyphens, underscores, 3-64 chars. */
export function isValidUsername(value: string): boolean {
  return /^[a-zA-Z0-9_-]{3,64}$/.test(value);
}

/** Check minimum length. */
export function minLength(value: string, min: number): boolean {
  return value.length >= min;
}

/** Check maximum length. */
export function maxLength(value: string, max: number): boolean {
  return value.length <= max;
}

/** Check value is not empty/whitespace-only. */
export function isRequired(value: string): boolean {
  return value.trim().length > 0;
}
