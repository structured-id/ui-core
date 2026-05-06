/**
 * Format a date string or timestamp to locale-aware display.
 * Falls back to ISO string if Intl is not available.
 */
export function formatDate(
  value: string | number | Date,
  locale = "en",
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);

  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * Format a relative time (e.g., "5 minutes ago").
 * Uses Intl.RelativeTimeFormat when available.
 */
export function formatRelativeTime(
  date: string | number | Date,
  locale = "en",
): string {
  const now = Date.now();
  const then = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return locale === "uk" ? "Щойно" : "Just now";

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

    if (diffSeconds < 3600) {
      return rtf.format(-Math.floor(diffSeconds / 60), "minute");
    }
    if (diffSeconds < 86400) {
      return rtf.format(-Math.floor(diffSeconds / 3600), "hour");
    }
    return rtf.format(-Math.floor(diffSeconds / 86400), "day");
  } catch {
    const minutes = Math.floor(diffSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
}

/** Truncate a string with ellipsis. */
export function truncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen - 1) + "\u2026";
}

/** Mask an email address for display (e.g., "a***e@example.com"). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || local.length <= 2) return email;
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 3))}${local[local.length - 1]}@${domain}`;
}
