import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CredentialId,
  DeviceId,
  IdError,
  MissingIdError,
  PrincipalId,
  ProfileEmailId,
  ProfileId,
  SessionId,
} from "@structured-id/ids";
import {
  fetchCredentials,
  fetchCurrentProfile,
  fetchPrincipals,
  fetchSessions,
  removePrincipal,
  revokeCredential,
  revokeSession,
  updateCredentialLabel,
  updateProfile,
} from "./useIdentityApi";

// Every IdentityService method the tests call, keyed by its client method name.
const rpc: Record<string, ReturnType<typeof vi.fn>> = {};

vi.mock("../../index", () => ({
  getAccountTransport: vi.fn(),
}));

vi.mock("@structured-id/proto/sid/v1/identity/identity.client", () => ({
  // Called with `new`: a constructor mock must be a `function`, not an arrow.
  IdentityServiceClient: vi.fn().mockImplementation(function () {
    return new Proxy(
      {},
      { get: (_target, name: string) => (rpc[name] ??= vi.fn()) },
    );
  }),
}));

vi.mock("../auth", () => ({
  authMeta: () => ({}),
}));

const PROFILE = ProfileId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d20");
const SESSION = SessionId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d21");
const DEVICE = DeviceId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d22");
const CRED = CredentialId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d23");
const PRINCIPAL = PrincipalId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d24");
const EMAIL = ProfileEmailId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d25");
const MALFORMED = { value: new Uint8Array(15) };

/** The RPC `name` answers `response` once. */
function answers(name: string, response: object) {
  rpc[name] ??= vi.fn();
  rpc[name].mockResolvedValueOnce({ response });
}

/** The request the RPC `name` was last called with. */
function sent(name: string): unknown {
  return rpc[name].mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  for (const fn of Object.values(rpc)) fn.mockReset();
});

describe("own listings", () => {
  // Regression: the page sent the BFF subject as its ProfileId. A
  // self-service listing names no Profile; the server resolves the
  // caller's own from its session.
  it("names no Profile", async () => {
    answers("listSessions", { sessions: [] });
    answers("listCredentials", { credentials: [] });
    answers("listPrincipals", { principals: [] });
    await fetchSessions();
    await fetchCredentials();
    await fetchPrincipals();
    expect(sent("listSessions")).toEqual({});
    expect(sent("listCredentials")).toEqual({});
    expect(sent("listPrincipals")).toEqual({});
  });

  it("reads each listed reference", async () => {
    answers("listSessions", {
      sessions: [
        { id: SESSION.toWire(), deviceId: DEVICE.toWire() },
        { id: SESSION.toWire() },
      ],
    });
    const [onDevice, without] = await fetchSessions();
    expect(onDevice.id.equals(SESSION)).toBe(true);
    expect(onDevice.deviceId?.equals(DEVICE)).toBe(true);
    expect(without.deviceId).toBeUndefined();

    answers("listPrincipals", {
      principals: [{ id: PRINCIPAL.toWire(), sourceEmailId: EMAIL.toWire() }],
    });
    const [principal] = await fetchPrincipals();
    expect(principal.id.equals(PRINCIPAL)).toBe(true);
    expect(principal.sourceEmailId?.equals(EMAIL)).toBe(true);
  });

  // An answer that owes a reference and carries a missing or malformed one
  // fails here, not on a page that would act on it.
  it("refuses a missing or malformed reference", async () => {
    answers("listCredentials", { credentials: [{}] });
    await expect(fetchCredentials()).rejects.toBeInstanceOf(MissingIdError);
    answers("listSessions", { sessions: [{ id: MALFORMED }] });
    await expect(fetchSessions()).rejects.toBeInstanceOf(IdError);
    answers("listPrincipals", {
      principals: [{ id: PRINCIPAL.toWire(), sourceEmailId: MALFORMED }],
    });
    await expect(fetchPrincipals()).rejects.toBeInstanceOf(IdError);
  });
});

describe("profile", () => {
  it("updates the profile it fetched, by its typed id", async () => {
    answers("getCurrentProfile", { profile: { id: PROFILE.toWire() } });
    const own = await fetchCurrentProfile();
    expect(own.id.equals(PROFILE)).toBe(true);

    answers("updateProfile", { profile: { id: PROFILE.toWire() } });
    await updateProfile(own.id, { givenName: "Alicia" });
    expect(sent("updateProfile")).toMatchObject({
      id: { value: PROFILE.toBytes() },
      givenName: "Alicia",
    });
  });

  it("refuses an answer without its profile", async () => {
    answers("getCurrentProfile", {});
    await expect(fetchCurrentProfile()).rejects.toBeInstanceOf(TypeError);
  });
});

describe("record actions", () => {
  it("name each record by its binary identifier", async () => {
    answers("revokeSession", {});
    await revokeSession(SESSION);
    expect(sent("revokeSession")).toEqual({
      sessionId: { value: SESSION.toBytes() },
    });

    answers("revokeCredential", {});
    await revokeCredential(CRED);
    expect(sent("revokeCredential")).toEqual({
      credentialId: { value: CRED.toBytes() },
    });

    answers("updateCredential", { credential: { id: CRED.toWire() } });
    const renamed = await updateCredentialLabel(CRED, "laptop");
    expect(sent("updateCredential")).toEqual({
      credentialId: { value: CRED.toBytes() },
      label: "laptop",
    });
    expect(renamed.id.equals(CRED)).toBe(true);

    answers("removePrincipal", {});
    await removePrincipal(PRINCIPAL);
    expect(sent("removePrincipal")).toEqual({
      principalId: { value: PRINCIPAL.toBytes() },
    });
  });
});
