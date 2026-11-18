import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PasskeyError,
  createPasskey,
  getPasskey,
  passkeyAutofillAvailable,
} from "./passkey";

const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value));
const json = (data: Uint8Array) =>
  JSON.parse(new TextDecoder().decode(data)) as Record<string, unknown>;

/** A browser credential whose JSON form is `form`. */
class FakeCredential {
  constructor(private readonly form: unknown) {}
  toJSON() {
    return this.form;
  }
}

const parseCreation = vi.fn((options: unknown) => ({ parsed: options }));
const parseRequest = vi.fn((options: unknown) => ({ parsed: options }));
const create = vi.fn();
const get = vi.fn();

beforeEach(() => {
  Object.assign(FakeCredential, {
    parseCreationOptionsFromJSON: parseCreation,
    parseRequestOptionsFromJSON: parseRequest,
  });
  vi.stubGlobal("PublicKeyCredential", FakeCredential);
  vi.stubGlobal("navigator", { credentials: { create, get } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// The JSON the server reads is the browser's own form, clientExtensionResults
// included: SID's relying party refuses a response without that member
// (WebAuthn Level 3 §5.1.4), which hand-built responses left out.
const REGISTRATION = {
  id: "Y3JlZA",
  rawId: "Y3JlZA",
  type: "public-key",
  response: { clientDataJSON: "e30", attestationObject: "o2M" },
  clientExtensionResults: {},
};

describe("passkey creation", () => {
  // The server wraps the options in `publicKey` (CredentialCreationOptions);
  // reading members off the top level parsed nothing.
  it("hands the browser the options inside publicKey", async () => {
    create.mockResolvedValue(new FakeCredential(REGISTRATION));
    const publicKey = { challenge: "Y2g", rp: { id: "sid.example.com" } };
    const response = await createPasskey(bytes({ publicKey }));
    expect(parseCreation).toHaveBeenCalledWith(publicKey);
    expect(create).toHaveBeenCalledWith({ publicKey: { parsed: publicKey } });
    expect(json(response)).toEqual(REGISTRATION);
  });

  it("tells a cancellation and a known authenticator apart", async () => {
    const options = bytes({ publicKey: { challenge: "Y2g" } });
    create.mockRejectedValue(new DOMException("no", "NotAllowedError"));
    await expect(createPasskey(options)).rejects.toMatchObject({
      failure: "cancelled",
    });
    create.mockRejectedValue(new DOMException("held", "InvalidStateError"));
    await expect(createPasskey(options)).rejects.toMatchObject({
      failure: "already-registered",
    });
    create.mockRejectedValue(new Error("broken"));
    await expect(createPasskey(options)).rejects.toMatchObject({
      failure: "failed",
      message: "broken",
    });
  });

  it("refuses options without publicKey and a missing credential", async () => {
    await expect(
      createPasskey(bytes({ challenge: "Y2g" })),
    ).rejects.toBeInstanceOf(PasskeyError);
    create.mockResolvedValue(null);
    await expect(
      createPasskey(bytes({ publicKey: { challenge: "Y2g" } })),
    ).rejects.toMatchObject({ failure: "failed" });
  });
});

describe("passkey assertion", () => {
  const ASSERTION = {
    id: "Y3JlZA",
    rawId: "Y3JlZA",
    type: "public-key",
    response: {
      clientDataJSON: "e30",
      authenticatorData: "YXV0aA",
      signature: "c2ln",
      userHandle: "dXNlcg",
    },
    clientExtensionResults: {},
  };

  it("answers the request options with the browser's JSON form", async () => {
    get.mockResolvedValue(new FakeCredential(ASSERTION));
    const publicKey = { challenge: "Y2g", rpId: "sid.example.com" };
    const response = await getPasskey(bytes({ publicKey }));
    expect(parseRequest).toHaveBeenCalledWith(publicKey);
    expect(get).toHaveBeenCalledWith({ publicKey: { parsed: publicKey } });
    expect(json(response)).toEqual(ASSERTION);
  });

  it("reports a cancelled sign-in as cancelled", async () => {
    get.mockRejectedValue(new DOMException("no", "NotAllowedError"));
    await expect(
      getPasskey(bytes({ publicKey: { challenge: "Y2g" } })),
    ).rejects.toMatchObject({ failure: "cancelled" });
  });

  // The sign-in field lists passkeys in its autofill only while a
  // conditional request waits (WebAuthn Level 3 §5.1.4.1): the page starts
  // it before the user acts and stops it when the user takes a password.
  it("waits conditionally with the page's signal", async () => {
    get.mockResolvedValue(new FakeCredential(ASSERTION));
    const publicKey = { challenge: "Y2g" };
    const stop = new AbortController();
    await getPasskey(bytes({ publicKey }), {
      conditional: true,
      signal: stop.signal,
    });
    expect(get).toHaveBeenCalledWith({
      publicKey: { parsed: publicKey },
      mediation: "conditional",
      signal: stop.signal,
    });
  });

  // A request the page stopped is not a refusal: it says nothing to the user.
  it("tells a request the page stopped from a cancellation", async () => {
    get.mockRejectedValue(new DOMException("stopped", "AbortError"));
    await expect(
      getPasskey(bytes({ publicKey: { challenge: "Y2g" } }), {
        conditional: true,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ failure: "aborted" });
  });
});

describe("passkey autofill support", () => {
  // Without conditional mediation the page keeps its button.
  it("asks the browser whether the sign-in field can list passkeys", async () => {
    Object.assign(FakeCredential, {
      isConditionalMediationAvailable: vi.fn().mockResolvedValue(true),
    });
    await expect(passkeyAutofillAvailable()).resolves.toBe(true);
    Object.assign(FakeCredential, {
      isConditionalMediationAvailable: undefined,
    });
    await expect(passkeyAutofillAvailable()).resolves.toBe(false);
    vi.stubGlobal("PublicKeyCredential", undefined);
    await expect(passkeyAutofillAvailable()).resolves.toBe(false);
  });
});
