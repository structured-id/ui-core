import { beforeEach, describe, expect, it, vi } from "vitest";

// The issuer's answer, as the generated client returns it.
const service = vi.hoisted(() => ({
  answer: null as null | {
    registrationOpen: boolean;
    passwordResetOpen: boolean;
    signInMethods: string[];
  },
  calls: 0,
}));

vi.mock("@structured-id/proto/sid/v1/ui/public_settings.client", () => ({
  PublicUiSettingsServiceClient: class {
    async getPublicUiSettings() {
      service.calls += 1;
      if (service.answer === null) throw new Error("UNIMPLEMENTED");
      return { response: service.answer };
    }
  },
}));
vi.mock("../../index", () => ({ getTransport: () => ({}) }));

import {
  UNANSWERED_SIGN_IN_OFFER,
  signInOfferApi,
  useSignInOffer,
  type SignInOffer,
} from "./useSignInOffer";

const CLOSED: SignInOffer = {
  registration: false,
  passwordReset: false,
  password: true,
  passkey: true,
};

describe("signInOfferApi", () => {
  beforeEach(() => {
    service.answer = null;
    service.calls = 0;
  });

  // What is tested: the issuer's published settings become the page's offer,
  // field by field.
  // Bug prevented: a link or a form decided by the wrong setting (the
  // recovery link following the registration switch).
  it("reads each choice from its own setting", async () => {
    service.answer = {
      registrationOpen: true,
      passwordResetOpen: false,
      signInMethods: ["webauthn"],
    };
    expect(await signInOfferApi().read()).toEqual({
      registration: true,
      passwordReset: false,
      password: false,
      passkey: true,
    });

    service.answer = {
      registrationOpen: false,
      passwordResetOpen: true,
      signInMethods: ["opaque"],
    };
    expect(await signInOfferApi().read()).toEqual({
      registration: false,
      passwordReset: true,
      password: true,
      passkey: false,
    });
  });

  // What is tested: a method the page does not know changes nothing it shows.
  // Bug prevented: an unknown method name read as one of the known forms.
  it("ignores a method it does not know", async () => {
    service.answer = {
      registrationOpen: false,
      passwordResetOpen: false,
      signInMethods: ["something-new"],
    };
    expect(await signInOfferApi().read()).toEqual({
      registration: false,
      passwordReset: false,
      password: false,
      passkey: false,
    });
  });
});

describe("useSignInOffer", () => {
  // What is tested: before the issuer answers the page has no public link
  // and keeps its sign-in forms.
  // Bug prevented: "Create one" shown for a moment on an installation that
  // registers nobody, or a holder left without a form to sign in with.
  it("offers the forms and no public link before the answer", () => {
    const { offer } = useSignInOffer({ api: { read: vi.fn() } });
    expect(offer.value).toEqual(CLOSED);
    expect(UNANSWERED_SIGN_IN_OFFER).toEqual(CLOSED);
  });

  it("takes the issuer's answer", async () => {
    const answer: SignInOffer = {
      registration: true,
      passwordReset: true,
      password: true,
      passkey: false,
    };
    const { offer, load } = useSignInOffer({
      api: { read: vi.fn(async () => answer) },
    });
    await load();
    expect(offer.value).toEqual(answer);
  });

  // What is tested: an issuer that does not answer leaves the unanswered
  // offer, also after an earlier answer.
  // Bug prevented: an unreadable policy treated as an open one, or a stale
  // open answer kept after the issuer stopped answering.
  it("falls back to the unanswered offer when the issuer does not answer", async () => {
    const read = vi
      .fn<() => Promise<SignInOffer>>()
      .mockResolvedValueOnce({
        registration: true,
        passwordReset: true,
        password: true,
        passkey: true,
      })
      .mockRejectedValueOnce(new Error("unavailable"));
    const { offer, load } = useSignInOffer({ api: { read } });
    await load();
    expect(offer.value.registration).toBe(true);
    await load();
    expect(offer.value).toEqual(CLOSED);
  });
});
