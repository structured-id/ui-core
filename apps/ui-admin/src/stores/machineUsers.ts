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
import { getTransport } from "@structured-id/ui-core";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";

function getClient() {
  return new MachineUserServiceClient(getTransport());
}

export const useMachineUsersStore = defineStore("machineUsers", () => {
  const machineUsers = ref<MachineUserInfo[]>([]);
  const currentMachineUser = ref<MachineUserInfo | null>(null);
  const credentials = ref<MachineCredentialInfo[]>([]);
  const impersonationGrants = ref<ImpersonationGrantInfo[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const projectId = "default";

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

  async function getMachineUser(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getMachineUser({
        machineUserId: id,
      });
      currentMachineUser.value = response.machineUser ?? null;
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
    id: string,
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
        machineUserId: id,
        displayName: update.displayName,
        description: update.description,
        scopes: update.scopes,
        ipAllowlist: update.ipAllowlist,
        rateLimitRpm: update.rateLimitRpm,
        maxTokenLifetime: update.maxTokenLifetime,
        expiresAt: update.expiresAt,
      });
      currentMachineUser.value = response.machineUser ?? null;
      const idx = machineUsers.value.findIndex((m) => m.id === id);
      if (idx !== -1 && response.machineUser) {
        machineUsers.value[idx] = response.machineUser;
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update machine user";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteMachineUser(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().deleteMachineUser({ machineUserId: id });
      machineUsers.value = machineUsers.value.filter((m) => m.id !== id);
      if (currentMachineUser.value?.id === id) {
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

  async function suspendMachineUser(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().suspendMachineUser({
        machineUserId: id,
      });
      currentMachineUser.value = response.machineUser ?? null;
      const idx = machineUsers.value.findIndex((m) => m.id === id);
      if (idx !== -1 && response.machineUser) {
        machineUsers.value[idx] = response.machineUser;
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to suspend machine user";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function reactivateMachineUser(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().reactivateMachineUser({
        machineUserId: id,
      });
      currentMachineUser.value = response.machineUser ?? null;
      const idx = machineUsers.value.findIndex((m) => m.id === id);
      if (idx !== -1 && response.machineUser) {
        machineUsers.value[idx] = response.machineUser;
      }
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
  async function fetchCredentials(machineUserId: string) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listMachineCredentials({
        machineUserId,
      });
      credentials.value = response.credentials;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load credentials";
    } finally {
      loading.value = false;
    }
  }

  async function addCredential(req: {
    machineUserId: string;
    credentialType: MachineCredentialType;
    algorithm: string;
    publicKeyPem: string;
    expiresAt?: Timestamp;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().addMachineCredential({
        machineUserId: req.machineUserId,
        credentialType: req.credentialType,
        algorithm: req.algorithm,
        publicKeyPem: req.publicKeyPem,
        expiresAt: req.expiresAt,
      });
      if (response.credential) {
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

  async function revokeCredential(machineUserId: string, kid: string) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().revokeMachineCredential({ machineUserId, kid });
      credentials.value = credentials.value.filter((c) => c.kid !== kid);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to revoke credential";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function rotateCredential(req: {
    machineUserId: string;
    kid: string;
    algorithm: string;
    publicKeyPem: string;
    expiresAt?: Timestamp;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().rotateMachineCredential({
        machineUserId: req.machineUserId,
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
  async function fetchImpersonationGrants(machineUserId: string) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listImpersonationGrants({
        machineUserId,
      });
      impersonationGrants.value = response.grants;
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
    machineUserId: string;
    targetType: ImpersonationTargetType;
    target: string;
    allowedScopes: string[];
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().grantImpersonation({
        machineUserId: req.machineUserId,
        targetType: req.targetType,
        target: req.target,
        allowedScopes: req.allowedScopes,
      });
      if (response.grant) {
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
    machineUserId: string,
    targetType: string,
    target: string,
  ) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().revokeImpersonation({
        machineUserId,
        targetType,
        target,
      });
      impersonationGrants.value = impersonationGrants.value.filter(
        (g) => !(g.target === target),
      );
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
