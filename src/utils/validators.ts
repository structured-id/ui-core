/** Email validation (RFC 5322 simplified). */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
