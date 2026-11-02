import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasskeyError, createPasskey, getPasskey } from "./passkey";

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
});
