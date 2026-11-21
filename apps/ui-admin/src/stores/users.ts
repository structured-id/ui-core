import { defineStore } from "pinia";
import { ref } from "vue";
import { IdentityServiceClient } from "@structured-id/proto/sid/v1/identity/identity.client";
import type {
  Profile,
  Credential,
  Session,
} from "@structured-id/proto/sid/v1/identity/identity";
import { getAccountTransport } from "@structured-id/ui-core";
import type { CredentialId, ProfileId, SessionId } from "@structured-id/ids";
import { names } from "src/ids";

function getClient() {
  return new IdentityServiceClient(getAccountTransport());
}

export const useUsersStore = defineStore("users", () => {
  const profiles = ref<Profile[]>([]);
  const currentProfile = ref<Profile | null>(null);
  const credentials = ref<Credential[]>([]);
  const sessions = ref<Session[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchProfiles() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listProfiles({
        pageSize: 100,
        pageToken: "",
      });
      profiles.value = response.profiles;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load users";
    } finally {
      loading.value = false;
    }
  }

  async function getProfile(id: ProfileId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getProfile({
        identifier: { oneofKind: "id", id: id.toWire() },
      });
      currentProfile.value = response.profile ?? null;
      return response.profile;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load user";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createProfile(req: {
    username?: string;
    email?: string;
    givenName?: string;
    familyName?: string;
    profileType: number;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().createProfile({
        username: req.username,
        email: req.email,
        givenName: req.givenName,
        familyName: req.familyName,
        profileType: req.profileType,
      });
      if (response.profile) {
        profiles.value.push(response.profile);
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to create user";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateProfile(
    id: ProfileId,
    updates: {
      givenName?: string;
      familyName?: string;
      middleName?: string;
      avatarUrl?: string;
    },
  ) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateProfile({
        id: id.toWire(),
        givenName: updates.givenName,
        familyName: updates.familyName,
        middleName: updates.middleName,
        avatarUrl: updates.avatarUrl,
      });
      currentProfile.value = response.profile ?? null;
      const idx = profiles.value.findIndex((p) => names(p.id, id));
      if (idx !== -1 && response.profile) {
        profiles.value[idx] = response.profile;
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update user";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteProfile(id: ProfileId) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().deleteProfile({ id: id.toWire() });
      profiles.value = profiles.value.filter((p) => !names(p.id, id));
      if (names(currentProfile.value?.id, id)) {
        currentProfile.value = null;
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete user";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /** Another user's credentials: naming the Profile takes administrator authority. */
  async function fetchCredentials(profileId: ProfileId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listCredentials({
        profileId: profileId.toWire(),
      });
      credentials.value = response.credentials;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load credentials";
    } finally {
      loading.value = false;
    }
  }

  async function revokeCredential(credentialId: CredentialId) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().revokeCredential({
        credentialId: credentialId.toWire(),
      });
      credentials.value = credentials.value.filter(
        (c) => !names(c.id, credentialId),
      );
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to revoke credential";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /** Another user's sessions: naming the Profile takes administrator authority. */
  async function fetchSessions(profileId: ProfileId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listSessions({
        profileId: profileId.toWire(),
      });
      sessions.value = response.sessions;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load sessions";
    } finally {
      loading.value = false;
    }
  }

  async function revokeSession(sessionId: SessionId) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().revokeSession({ sessionId: sessionId.toWire() });
      sessions.value = sessions.value.filter((s) => !names(s.id, sessionId));
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to revoke session";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    profiles,
    currentProfile,
    credentials,
    sessions,
    loading,
    error,
    fetchProfiles,
    getProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    fetchCredentials,
    revokeCredential,
    fetchSessions,
    revokeSession,
  };
});
