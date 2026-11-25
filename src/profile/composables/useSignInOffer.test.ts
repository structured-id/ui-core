import { beforeEach, describe, expect, it, vi } from "vitest";

// The issuer's answer, as the generated client returns it.
const service = vi.hoisted(() => ({
  answer: null as null | {
    registrationOpen: boolean;
    passwordResetOpen: boolean;
    signInMethods: string[];
  },
}));

vi.mock("@structured-id/proto/sid/v1/ui/public_settings.client", () => ({
  PublicUiSettingsServiceClient: class {
    async getPublicUiSettings() {
      if (service.answer === null) throw new Error("UNIMPLEMENTED");
      return { response: service.answer };
    }
  },
}));
vi.mock("../../index", () => ({ getTransport: () => ({}) }));

import {
  signInOfferApi,
  useSignInOffer,
  type SignInOffer,
} from "./useSignInOffer";

describe("signInOfferApi", () => {
  beforeEach(() => {
    service.answer = null;
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
  const OPEN: SignInOffer = {
    registration: true,
    passwordReset: true,
    password: true,
    passkey: true,
  };

  // What is tested: before the issuer answers there is no offer at all.
  // Bug prevented: a sign-in form shown for a method the issuer never
  // stated, on an issuer that then refuses every attempt with it.
  it("has no offer before the answer", () => {
    const { offer, failed } = useSignInOffer({ api: { read: vi.fn() } });
    expect(offer.value).toBeNull();
    expect(failed.value).toBe(false);
  });

  it("takes the issuer's answer", async () => {
    const answer: SignInOffer = { ...OPEN, passkey: false };
    const { offer, failed, load } = useSignInOffer({
      api: { read: vi.fn(async () => answer) },
    });
    await load();
    expect(offer.value).toEqual(answer);
    expect(failed.value).toBe(false);
  });

  // What is tested: an issuer that does not answer leaves no offer and says
  // so, also after an earlier answer; a retry that is answered clears it.
  // Bug prevented: an unreadable policy treated as an open one, a stale
  // answer kept as current, or a failure the page can never leave.
  it("says the issuer did not answer and recovers on a retry", async () => {
    const read = vi
      .fn<() => Promise<SignInOffer>>()
      .mockResolvedValueOnce(OPEN)
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce({ ...OPEN, registration: false });
    const { offer, failed, load } = useSignInOffer({ api: { read } });
    await load();
    expect(offer.value).toEqual(OPEN);

    await load();
    expect(offer.value).toBeNull();
    expect(failed.value).toBe(true);

    await load();
    expect(offer.value).toEqual({ ...OPEN, registration: false });
    expect(failed.value).toBe(false);
  });
});
