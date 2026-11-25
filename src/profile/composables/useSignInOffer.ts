/**
 * What a sign-in page may offer, as the issuer its ceremonies run at
 * publishes it: whether a visitor may create an account, whether the issuer
 * serves self-service password reset, and which local sign-in methods it
 * offers. The page shows a link or a form only for what is offered; the
 * issuer's handlers enforce the same policy whatever the page shows.
 *
 * Nothing here is about a particular account: the answer is the same for
 * every visitor, so a shown form reveals no account's existence or factors.
 *
 * The offer has no assumed value. Until the issuer answers there is none,
 * and an issuer that does not answer leaves none: the page shows that state
 * instead of a form the issuer never stated.
 */
import { ref } from "vue";
import { PublicUiSettingsServiceClient } from "@structured-id/proto/sid/v1/ui/public_settings.client";
import { getTransport } from "../../index";

/** The local sign-in methods a page knows how to show. */
const PASSWORD_METHOD = "opaque";
const PASSKEY_METHOD = "webauthn";

/** What the sign-in page offers. */
export interface SignInOffer {
  /** A visitor may start creating an account from the page. */
  registration: boolean;
  /** The issuer serves self-service password reset. */
  passwordReset: boolean;
  /** The issuer offers sign-in with a password. */
  password: boolean;
  /** The issuer offers sign-in with a passkey. */
  passkey: boolean;
}

/** The call the page makes; the sign-in surface's issuer by default. */
export interface SignInOfferApi {
  /** The issuer's published offer. */
  read(): Promise<SignInOffer>;
}

/** The issuer's public UI settings on the sign-in surface. */
export function signInOfferApi(): SignInOfferApi {
  return {
    async read() {
      const client = new PublicUiSettingsServiceClient(getTransport());
      const { response } = await client.getPublicUiSettings({});
      return {
        registration: response.registrationOpen,
        passwordReset: response.passwordResetOpen,
        password: response.signInMethods.includes(PASSWORD_METHOD),
        passkey: response.signInMethods.includes(PASSKEY_METHOD),
      };
    },
  };
}

/** Options of {@link useSignInOffer}. */
export interface SignInOfferOptions {
  api?: SignInOfferApi;
}

/**
 * The sign-in page's offer: `offer` is null until the issuer answered, and
 * `failed` says the last read got no answer. `load` reads it when the page
 * opens and again on a retry; an open page is not updated afterwards, and a
 * choice the issuer closed since is refused by its handler.
 */
export function useSignInOffer(options: SignInOfferOptions = {}) {
  const offer = ref<SignInOffer | null>(null);
  const failed = ref(false);

  async function load() {
    failed.value = false;
    try {
      offer.value = await (options.api ?? signInOfferApi()).read();
    } catch {
      // A stale answer is not shown as the current one.
      offer.value = null;
      failed.value = true;
    }
  }

  return { offer, failed, load };
}
