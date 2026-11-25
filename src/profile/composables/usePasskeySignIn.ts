/**
 * Passkey sign-in: the WebAuthn assertion ceremony at the issuer the sign-in
 * surface addresses, for the login the user typed or, with none, a
 * discoverable passkey that names its account itself. The finish request
 * gets the issuer's session like any other sign-in. The browser side uses
 * the browser's own JSON forms of the options and the response (WebAuthn
 * Level 3, 5.1.4), never a hand-built copy.
 */
import { ref } from "vue";
import type { SessionId } from "@structured-id/ids";
import { PasskeyError, getPasskey, refusalMessage } from "../../index";
import {
  webAuthnAuthenticationFinish,
  webAuthnAuthenticationStart,
} from "./useAuthApi";
import type { PendingSignIn } from "../pendingSignIn";

/** What the finished ceremony gives the caller. */
export interface PasskeySignIn {
  sessionId: SessionId;
  /** The second factor the sign-in still owes; null when it is complete. */
  pending: PendingSignIn | null;
}

/**
 * Run the whole ceremony: challenge, the device's assertion, verification.
 * The server finds the ceremony by the challenge the assertion signs.
 *
 * With `login` (as typed) the ceremony is for that account only: the issuer
 * looks it up and offers its passkeys, and a login that resolves to no
 * account is refused, never retried as another passkey. Without one the
 * passkey names its account itself (discoverable).
 */
export async function passkeyCeremony(
  login?: string | null,
): Promise<PasskeySignIn> {
  const principal = login || undefined;
  const started = await webAuthnAuthenticationStart(principal);
  const assertion = await getPasskey(started.options);
  const finished = await webAuthnAuthenticationFinish(assertion, principal);
  return { sessionId: finished.sessionId, pending: finished.pending };
}

/** Options of {@link usePasskeySignIn}. */
export interface PasskeySignInOptions {
  /** Continues the sign-in: the page's ordinary success handler. */
  onSuccess: (result: PasskeySignIn) => void | Promise<void>;
  /** The ceremony; {@link passkeyCeremony} by default. */
  ceremony?: (login?: string | null) => Promise<PasskeySignIn>;
}

/** Passkey sign-in for a page: `loading` while it runs, then `onSuccess`. */
export function usePasskeySignIn(options: PasskeySignInOptions) {
  const loading = ref(false);
  const error = ref<string | null>(null);

  /** Sign in with a passkey, for `login` when one was typed. */
  async function signInWithPasskey(login?: string | null) {
    loading.value = true;
    error.value = null;
    try {
      await options.onSuccess(
        await (options.ceremony ?? passkeyCeremony)(login),
      );
    } catch (e) {
      // A refusal by its reason; the server's message is never shown.
      error.value =
        e instanceof PasskeyError && e.failure === "cancelled"
          ? "Request was cancelled or timed out"
          : refusalMessage(e, "Sign-in failed");
    } finally {
      loading.value = false;
    }
  }

  return { signInWithPasskey, loading, error };
}
