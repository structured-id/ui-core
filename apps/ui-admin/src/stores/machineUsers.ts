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
import { ProjectId, type MachineUserId } from "@structured-id/ids";
import { names } from "src/ids";

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

  // The console administers the installation's own project.
  const projectId = ProjectId.system().toWire();

  /** `machineUser` in place of the listed one with its identifier. */
  function replaceListed(id: MachineUserId, machineUser?: MachineUserInfo) {
    const idx = machineUsers.value.findIndex((m) => names(m.id, id));
    if (idx !== -1 && machineUser) {
      machineUsers.value[idx] = machineUser;
    }
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

  async function getMachineUser(id: MachineUserId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getMachineUser({
        machineUserId: id.toWire(),
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
      currentMachineUser.value = response.machineUser ?? null;
      replaceListed(id, response.machineUser);
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
      currentMachineUser.value = response.machineUser ?? null;
      replaceListed(id, response.machineUser);
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
      currentMachineUser.value = response.machineUser ?? null;
      replaceListed(id, response.machineUser);
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
      credentials.value = response.credentials;
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

  async function revokeCredential(machineUserId: MachineUserId, kid: string) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().revokeMachineCredential({
        machineUserId: machineUserId.toWire(),
        kid,
      });
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
