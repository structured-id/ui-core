/**
 * Profile identity API composable.
 *
 * The account API through the BFF (`getAccountTransport`), which adds the
 * session's Bearer token. Shared between profile-ui-ce, profile-ui-ee, and
 * frontend.
 *
 * Self-service listings name no Profile: the server resolves the caller's
 * own from its session, so the page never needs its own ProfileId.
 */
import type { RpcTransport } from "@protobuf-ts/runtime-rpc";
import {
  CredentialId,
  DeviceId,
  PrincipalId,
  ProfileEmailId,
  ProfileId,
  SessionId,
  optional,
  required,
} from "@structured-id/ids";
import { getAccountTransport } from "../../index";
import { IdentityServiceClient } from "@structured-id/proto/sid/v1/identity/identity.client";
import {
  type Profile as WireProfile,
  type Session as WireSession,
  type Credential as WireCredential,
  type Principal as WirePrincipal,
  ProfileStatus,
  PrincipalType,
  CredentialType,
  AuthenticatorAttachment,
} from "@structured-id/proto/sid/v1/identity/identity";
import { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import { authMeta } from "../auth";
import type { WithId } from "./useAuthApi";

function client(transport?: RpcTransport): IdentityServiceClient {
  return new IdentityServiceClient(transport ?? getAccountTransport());
}

// ── Profile ──

/** A Profile as answered, its id read into a typed identifier. */
export type Profile = WithId<WireProfile, "id", ProfileId>;

function profile(wire: WireProfile | undefined): Profile {
  if (!wire) throw new TypeError("the answer carries no profile");
  return { ...wire, id: required(ProfileId, wire.id) };
}

/**
 * The signed-in user's own profile. `transport`: the sign-in surface's
 * transport when a sign-in step reads it; the account API otherwise.
 */
export async function fetchCurrentProfile(
  transport?: RpcTransport,
): Promise<Profile> {
  const { response } = await client(transport).getCurrentProfile(
    {},
    { meta: authMeta() },
  );
  return profile(response.profile);
}

/**
 * Update the profile `id` (the one {@link fetchCurrentProfile} answered).
 *
 * `transport`: the sign-in surface's transport when a sign-in step (a
 * required profile update) makes the call; the account API otherwise.
 */
export async function updateProfile(
  id: ProfileId,
  update: {
    givenName?: string;
    familyName?: string;
    middleName?: string;
    avatarUrl?: string;
  },
  transport?: RpcTransport,
): Promise<Profile> {
  const { response } = await client(transport).updateProfile(
    {
      id: id.toWire(),
      givenName: update.givenName,
      familyName: update.familyName,
      middleName: update.middleName,
      avatarUrl: update.avatarUrl,
    },
    { meta: authMeta() },
  );
  return profile(response.profile);
}

// ── Sessions ──

/** A session as answered, with its own and its device's typed ids. */
export type Session = WithId<
  WithId<WireSession, "id", SessionId>,
  "deviceId",
  DeviceId | undefined
>;

/** The caller's own sessions. */
export async function fetchSessions(): Promise<Session[]> {
  const { response } = await client().listSessions({}, { meta: authMeta() });
  return response.sessions.map((s) => ({
    ...s,
    id: required(SessionId, s.id),
    deviceId: optional(DeviceId, s.deviceId),
  }));
}

export async function revokeSession(id: SessionId): Promise<void> {
  await client().revokeSession(
    { sessionId: id.toWire() },
    { meta: authMeta() },
  );
}

// ── Credentials ──

/** A credential as answered, its id read into a typed identifier. */
export type Credential = WithId<WireCredential, "id", CredentialId>;

function credential(wire: WireCredential | undefined): Credential {
  if (!wire) throw new TypeError("the answer carries no credential");
  return { ...wire, id: required(CredentialId, wire.id) };
}

/** The caller's own credentials. */
export async function fetchCredentials(): Promise<Credential[]> {
  const { response } = await client().listCredentials({}, { meta: authMeta() });
  return response.credentials.map(credential);
}

export async function revokeCredential(id: CredentialId): Promise<void> {
  await client().revokeCredential(
    { credentialId: id.toWire() },
    { meta: authMeta() },
  );
}

export async function updateCredentialLabel(
  id: CredentialId,
  label: string,
): Promise<Credential> {
  const { response } = await client().updateCredential(
    { credentialId: id.toWire(), label },
    { meta: authMeta() },
  );
  return credential(response.credential);
}

// ── Principals ──

/** A login handle as answered, with its own and its contact's typed ids. */
export type Principal = WithId<
  WithId<WirePrincipal, "id", PrincipalId>,
  "sourceEmailId",
  ProfileEmailId | undefined
>;

/** The caller's own login handles. */
export async function fetchPrincipals(): Promise<Principal[]> {
  const { response } = await client().listPrincipals({}, { meta: authMeta() });
  return response.principals.map((p) => ({
    ...p,
    id: required(PrincipalId, p.id),
    sourceEmailId: optional(ProfileEmailId, p.sourceEmailId),
  }));
}

export async function removePrincipal(id: PrincipalId): Promise<void> {
  await client().removePrincipal(
    { principalId: id.toWire() },
    { meta: authMeta() },
  );
}

// Re-export enums and Timestamp for convenience
export {
  ProfileStatus,
  PrincipalType,
  CredentialType,
  AuthenticatorAttachment,
  Timestamp,
};
