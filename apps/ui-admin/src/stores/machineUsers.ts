import { defineStore } from "pinia";
import { ref } from "vue";
import { MachineUserServiceClient } from "@structured-id/proto/sid/v1/machine/machine_user.client";
import type {
  MachineUserInfo,
  MachineCredentialInfo,
  ImpersonationGrantInfo,
} from "@structured-id/proto/sid/v1/machine/machine_user";
import {
  MachineCredentialType,
  ImpersonationTargetType,
} from "@structured-id/proto/sid/v1/machine/machine_user";
import { getAccountTransport } from "@structured-id/ui-core";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import { ProjectId, type MachineUserId } from "@structured-id/ids";
import { names } from "#admin/ids";

function getClient() {
  return new MachineUserServiceClient(getAccountTransport());
}

export const useMachineUsersStore = defineStore("machineUsers", () => {
  const machineUsers = ref<MachineUserInfo[]>([]);
  const currentMachineUser = ref<MachineUserInfo | null>(null);
  const credentials = ref<MachineCredentialInfo[]>([]);
  const impersonationGrants = ref<ImpersonationGrantInfo[]>([]);
  /**
   * The service account whose detail is shown; an answer for another one
   * is dropped, so actions on the shown rows never reach another account.
   */
  let detailOf: MachineUserId | null = null;
  const loading = ref(false);
  const error = ref<string | null>(null);

  function shows(id: MachineUserId): boolean {
    return detailOf !== null && detailOf.equals(id);
  }

  // The console administers the installation's own project.
  const projectId = ProjectId.system().toWire();

  /** `machineUser` in place of the listed one with its identifier. */
  function replaceListed(id: MachineUserId, machineUser?: MachineUserInfo) {
    const idx = machineUsers.value.findIndex((m) => names(m.id, id));
    if (idx !== -1 && machineUser) {
      machineUsers.value[idx] = machineUser;
    }
  }

  /**
   * A change's answer for `id`: always in the list, in the detail only while
   * `id` is still the account shown, so a late answer never replaces another
   * account opened since (whose page derives its actions from the detail).
   */
  function showAnswer(id: MachineUserId, machineUser?: MachineUserInfo) {
    if (shows(id)) currentMachineUser.value = machineUser ?? null;
    replaceListed(id, machineUser);
  }

  async function fetchMachineUsers() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listMachineUsers({ projectId });
      machineUsers.value = response.machineUsers;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load machine users";
    } finally {
      loading.value = false;
    }
  }

  /** Open `id`'s detail; another account's detail starts empty. */
  async function getMachineUser(id: MachineUserId) {
    if (!shows(id)) {
      detailOf = id;
      currentMachineUser.value = null;
      credentials.value = [];
      impersonationGrants.value = [];
    }
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getMachineUser({
        machineUserId: id.toWire(),
      });
      if (shows(id)) currentMachineUser.value = response.machineUser ?? null;
      return response.machineUser;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load machine user";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createMachineUser(req: {
    displayName: string;
    description: string;
    machineType: number;
    scopes: string[];
    ipAllowlist: string[];
    rateLimitRpm: number;
    maxTokenLifetime: number;
    expiresAt?: Timestamp;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().createMachineUser({
        projectId,
        displayName: req.displayName,
        description: req.description,
        machineType: req.machineType,
        scopes: req.scopes,
        ipAllowlist: req.ipAllowlist,
        rateLimitRpm: req.rateLimitRpm,
        maxTokenLifetime: req.maxTokenLifetime,
        expiresAt: req.expiresAt,
      });
      if (response.machineUser) {
        machineUsers.value.push(response.machineUser);
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to create machine user";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateMachineUser(
    id: MachineUserId,
    update: {
      displayName: string;
      description: string;
      scopes: string[];
      ipAllowlist: string[];
      rateLimitRpm: number;
      maxTokenLifetime: number;
      expiresAt?: Timestamp;
    },
  ) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateMachineUser({
        machineUserId: id.toWire(),
        displayName: update.displayName,
        description: update.description,
        scopes: update.scopes,
        ipAllowlist: update.ipAllowlist,
        rateLimitRpm: update.rateLimitRpm,
        maxTokenLifetime: update.maxTokenLifetime,
        expiresAt: update.expiresAt,
      });
      showAnswer(id, response.machineUser);
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update machine user";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteMachineUser(id: MachineUserId) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().deleteMachineUser({ machineUserId: id.toWire() });
      machineUsers.value = machineUsers.value.filter((m) => !names(m.id, id));
      if (names(currentMachineUser.value?.id, id)) {
        currentMachineUser.value = null;
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete machine user";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function suspendMachineUser(id: MachineUserId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().suspendMachineUser({
        machineUserId: id.toWire(),
      });
      showAnswer(id, response.machineUser);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to suspend machine user";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function reactivateMachineUser(id: MachineUserId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().reactivateMachineUser({
        machineUserId: id.toWire(),
      });
      showAnswer(id, response.machineUser);
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to reactivate machine user";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Credentials
  async function fetchCredentials(machineUserId: MachineUserId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listMachineCredentials({
        machineUserId: machineUserId.toWire(),
      });
      if (shows(machineUserId)) credentials.value = response.credentials;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load credentials";
    } finally {
      loading.value = false;
    }
  }

  async function addCredential(req: {
    machineUserId: MachineUserId;
    credentialType: MachineCredentialType;
    algorithm: string;
    publicKeyPem: string;
    expiresAt?: Timestamp;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().addMachineCredential({
        machineUserId: req.machineUserId.toWire(),
        credentialType: req.credentialType,
        algorithm: req.algorithm,
        publicKeyPem: req.publicKeyPem,
        expiresAt: req.expiresAt,
      });
      if (response.credential && shows(req.machineUserId)) {
        credentials.value.push(response.credential);
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to add credential";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function revokeCredential(machineUserId: MachineUserId, kid: string) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().revokeMachineCredential({
        machineUserId: machineUserId.toWire(),
        kid,
      });
      if (shows(machineUserId)) {
        credentials.value = credentials.value.filter((c) => c.kid !== kid);
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to revoke credential";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function rotateCredential(req: {
    machineUserId: MachineUserId;
    kid: string;
    algorithm: string;
    publicKeyPem: string;
    expiresAt?: Timestamp;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().rotateMachineCredential({
        machineUserId: req.machineUserId.toWire(),
        kid: req.kid,
        algorithm: req.algorithm,
        publicKeyPem: req.publicKeyPem,
        expiresAt: req.expiresAt,
      });
      // Replace old credential and add new
      await fetchCredentials(req.machineUserId);
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to rotate credential";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Impersonation
  async function fetchImpersonationGrants(machineUserId: MachineUserId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listImpersonationGrants({
        machineUserId: machineUserId.toWire(),
      });
      if (shows(machineUserId)) impersonationGrants.value = response.grants;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to load impersonation grants";
    } finally {
      loading.value = false;
    }
  }

  async function grantImpersonation(req: {
    machineUserId: MachineUserId;
    targetType: ImpersonationTargetType;
    target: string;
    allowedScopes: string[];
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().grantImpersonation({
        machineUserId: req.machineUserId.toWire(),
        targetType: req.targetType,
        target: req.target,
        allowedScopes: req.allowedScopes,
      });
      if (response.grant && shows(req.machineUserId)) {
        impersonationGrants.value.push(response.grant);
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to grant impersonation";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function revokeImpersonation(
    machineUserId: MachineUserId,
    targetType: string,
    target: string,
  ) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().revokeImpersonation({
        machineUserId: machineUserId.toWire(),
        targetType,
        target,
      });
      // A grant is named by its target, which another account's grant can
      // share: only the revoked account's shown grants lose it.
      if (shows(machineUserId)) {
        impersonationGrants.value = impersonationGrants.value.filter(
          (g) => g.target !== target,
        );
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to revoke impersonation";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    machineUsers,
    currentMachineUser,
    shows,
    credentials,
    impersonationGrants,
    loading,
    error,
    fetchMachineUsers,
    getMachineUser,
    createMachineUser,
    updateMachineUser,
    deleteMachineUser,
    suspendMachineUser,
    reactivateMachineUser,
    fetchCredentials,
    addCredential,
    revokeCredential,
    rotateCredential,
    fetchImpersonationGrants,
    grantImpersonation,
    revokeImpersonation,
    MachineCredentialType,
    ImpersonationTargetType,
  };
});
