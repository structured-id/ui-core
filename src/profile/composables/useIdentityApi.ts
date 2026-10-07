/**
 * Profile identity API composable.
 *
 * The account API through the BFF (`getAccountTransport`), which adds the
 * session's Bearer token. Shared between profile-ui-ce, profile-ui-ee, and
 * frontend.
 */
import type { RpcTransport } from "@protobuf-ts/runtime-rpc";
import {
  getAccountTransport,
  IdentityServiceClient,
  type Profile,
  type Session,
  type Credential,
  type Principal,
  ProfileStatus,
  PrincipalType,
  CredentialType,
  AuthenticatorAttachment,
  Timestamp,
} from "../../index";
import { authMeta } from "../auth";

function client(transport?: RpcTransport): IdentityServiceClient {
  return new IdentityServiceClient(transport ?? getAccountTransport());
}

// ── Profile ──

export type { Profile, Principal };

export async function fetchCurrentProfile(): Promise<Profile> {
  const { response } = await client().getCurrentProfile(
    {},
    { meta: authMeta() },
  );
  return response.profile!;
}

/**
 * `transport`: the sign-in surface's transport when a sign-in step (a
 * required profile update) makes the call; the account API otherwise.
 */
export async function updateProfile(
  id: string,
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
      id,
      givenName: update.givenName,
      familyName: update.familyName,
      middleName: update.middleName,
      avatarUrl: update.avatarUrl,
    },
    { meta: authMeta() },
  );
  return response.profile!;
}

// ── Sessions ──

export type { Session };

export async function fetchSessions(profileId: string): Promise<Session[]> {
  const { response } = await client().listSessions(
    { profileId },
    { meta: authMeta() },
  );
  return response.sessions;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await client().revokeSession({ sessionId }, { meta: authMeta() });
}

// ── Credentials ──

export type { Credential };

export async function fetchCredentials(
  profileId: string,
): Promise<Credential[]> {
  const { response } = await client().listCredentials(
    { profileId },
    { meta: authMeta() },
  );
  return response.credentials;
}

export async function revokeCredential(credentialId: string): Promise<void> {
  await client().revokeCredential({ credentialId }, { meta: authMeta() });
}

export async function updateCredentialLabel(
  credentialId: string,
  label: string,
): Promise<Credential> {
  const { response } = await client().updateCredential(
    { credentialId, label },
    { meta: authMeta() },
  );
  return response.credential!;
}

// ── Principals ──

export async function fetchPrincipals(profileId: string): Promise<Principal[]> {
  const { response } = await client().listPrincipals(
    { profileId },
    { meta: authMeta() },
  );
  return response.principals;
}

export async function removePrincipal(principalId: string): Promise<void> {
  await client().removePrincipal({ principalId }, { meta: authMeta() });
}

// Re-export enums and Timestamp for convenience
export {
  ProfileStatus,
  PrincipalType,
  CredentialType,
  AuthenticatorAttachment,
  Timestamp,
};
