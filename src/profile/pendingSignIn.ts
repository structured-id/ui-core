/**
 * A browser sign-in that still owes its second factor. The first factor's
 * answer names the factors that complete it, the factors it may enroll
 * first, and the CSRF token the browser sends with its pending cookie to
 * complete it. The record is kept for the tab until the completion ends it:
 * a completion whose outcome is unknown is repeated with the same token and
 * receives the sign-in it delivered.
 */
import { StepUpMethod } from "@structured-id/proto/sid/v1/authn/auth";

/** What a first-factor answer states about the sign-in it delivered. */
export interface FirstFactorAnswer {
  secondFactors: StepUpMethod[];
  enrollableFactors: StepUpMethod[];
  browserCsrf?: string;
}

/** A sign-in owing its second factor. */
export interface PendingSignIn {
  /** The enrolled factors that complete it; empty when it must enroll one first. */
  secondFactors: StepUpMethod[];
  /** The factors it may enroll first, when the account has none. */
  enrollableFactors: StepUpMethod[];
}

interface Kept extends PendingSignIn {
  csrf: string;
}

const KEY = "sid.pending-sign-in";

/** The CSRF header the sign-in surface checks with the pending cookie. */
const CSRF_HEADER = "x-csrf-token";

function tabStorage(): Storage {
  return sessionStorage;
}

function methods(value: unknown): StepUpMethod[] | null {
  return Array.isArray(value) && value.every((m) => typeof m === "number")
    ? (value as StepUpMethod[])
    : null;
}

function read(storage: Storage): Kept | null {
  const raw = storage.getItem(KEY);
  if (!raw) return null;
  try {
    const kept = JSON.parse(raw) as Record<string, unknown>;
    const secondFactors = methods(kept.secondFactors);
    const enrollableFactors = methods(kept.enrollableFactors);
    if (typeof kept.csrf !== "string" || !secondFactors || !enrollableFactors) {
      return null;
    }
    return { csrf: kept.csrf, secondFactors, enrollableFactors };
  } catch {
    return null;
  }
}

/**
 * Keep the sign-in `answer` delivered when it still owes a factor; null when
 * the sign-in is complete. A new first factor replaces any earlier record.
 */
export function holdPendingSignIn(
  answer: FirstFactorAnswer,
  storage: Storage = tabStorage(),
): PendingSignIn | null {
  storage.removeItem(KEY);
  const owed =
    answer.secondFactors.length > 0 || answer.enrollableFactors.length > 0;
  if (!owed) return null;
  if (!answer.browserCsrf) {
    throw new Error(
      "The issuer answered a pending sign-in without its CSRF token",
    );
  }
  const kept: Kept = {
    csrf: answer.browserCsrf,
    secondFactors: [...answer.secondFactors],
    enrollableFactors: [...answer.enrollableFactors],
  };
  storage.setItem(KEY, JSON.stringify(kept));
  return {
    secondFactors: kept.secondFactors,
    enrollableFactors: kept.enrollableFactors,
  };
}

/** The sign-in this tab is completing, if any. */
export function pendingSignIn(
  storage: Storage = tabStorage(),
): PendingSignIn | null {
  const kept = read(storage);
  return kept
    ? {
        secondFactors: kept.secondFactors,
        enrollableFactors: kept.enrollableFactors,
      }
    : null;
}

/** The metadata a completion of the pending sign-in sends; empty without one. */
export function pendingSignInMeta(
  storage: Storage = tabStorage(),
): Record<string, string> {
  const kept = read(storage);
  return kept ? { [CSRF_HEADER]: kept.csrf } : {};
}

/** End the pending sign-in: its completion delivered the session, or it ended. */
export function endPendingSignIn(storage: Storage = tabStorage()): void {
  storage.removeItem(KEY);
}
