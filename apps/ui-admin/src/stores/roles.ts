import { defineStore } from "pinia";
import { ref } from "vue";
import { AuthzServiceClient } from "@structured-id/proto/sid/v1/authz/authz.client";
import type {
  Role,
  RoleAssignment,
} from "@structured-id/proto/sid/v1/authz/authz";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import { getAccountTransport, refusalMessage } from "@structured-id/ui-core";
import {
  ProjectId,
  type GroupId,
  type MachineUserId,
  type ProfileId,
  type RoleAssignmentId,
  type RoleId,
} from "@structured-id/ids";
import { names } from "#admin/ids";

function getClient() {
  return new AuthzServiceClient(getAccountTransport());
}

/** Whom a role is assigned to, by its typed identifier. */
export type RolePrincipal =
  | { kind: "profile"; id: ProfileId }
  | { kind: "group"; id: GroupId }
  | { kind: "machineUser"; id: MachineUserId };

/** The wire principal of an assignment request. */
function principalOf(principal: RolePrincipal) {
  switch (principal.kind) {
    case "profile":
      return {
        oneofKind: "profileId" as const,
        profileId: principal.id.toWire(),
      };
    case "group":
      return { oneofKind: "groupId" as const, groupId: principal.id.toWire() };
    case "machineUser":
      return {
        oneofKind: "machineUserId" as const,
        machineUserId: principal.id.toWire(),
      };
  }
}

export const useRolesStore = defineStore("roles", () => {
  const roles = ref<Role[]>([]);
  const currentRole = ref<Role | null>(null);
  const assignments = ref<RoleAssignment[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // The console administers the installation's system project.
  const projectId = ProjectId.system();

  async function fetchRoles() {
    loading.value = true;
    error.value = null;
    try {
      // Every role, page by page: the page searches and pages locally.
      const client = getClient();
      const all: Role[] = [];
      let pageToken = "";
      do {
        const { response } = await client.listRoles({
          projectId: projectId.toWire(),
          pageSize: 100,
          pageToken,
        });
        all.push(...response.roles);
        pageToken = response.nextPageToken;
      } while (pageToken);
      roles.value = all;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load roles";
    } finally {
      loading.value = false;
    }
  }

  async function getRole(id: RoleId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getRole({
        identifier: { oneofKind: "id", id: id.toWire() },
      });
      currentRole.value = response.role ?? null;
      return response.role;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load role";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createRole(req: {
    name: string;
    description?: string;
    permissions: string[];
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().createRole({
        projectId: projectId.toWire(),
        name: req.name,
        description: req.description,
        permissions: req.permissions,
      });
      if (response.role) {
        roles.value.push(response.role);
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to create role";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateRole(
    id: RoleId,
    updates: {
      description?: string;
      permissions: string[];
    },
  ) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateRole({
        id: id.toWire(),
        description: updates.description,
        permissions: updates.permissions,
      });
      currentRole.value = response.role ?? null;
      const idx = roles.value.findIndex((r) => names(r.id, id));
      if (idx !== -1 && response.role) {
        roles.value[idx] = response.role;
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update role";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteRole(id: RoleId) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().deleteRole({ id: id.toWire() });
      roles.value = roles.value.filter((r) => !names(r.id, id));
      if (names(currentRole.value?.id, id)) {
        currentRole.value = null;
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete role";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchRoleAssignments(roleId: RoleId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listRoleAssignments({
        filter: { oneofKind: "roleId", roleId: roleId.toWire() },
      });
      assignments.value = response.assignments;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load assignments";
    } finally {
      loading.value = false;
    }
  }

  /** The role assignments a machine user holds (its roles). */
  async function fetchMachineUserAssignments(machineUserId: MachineUserId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listRoleAssignments({
        filter: {
          oneofKind: "machineUserId",
          machineUserId: machineUserId.toWire(),
        },
      });
      assignments.value = response.assignments;
    } catch (err) {
      error.value = refusalMessage(err, "Failed to load assignments");
    } finally {
      loading.value = false;
    }
  }

  async function assignRole(req: {
    roleId: RoleId;
    principal: RolePrincipal;
    scope?: string;
    expiresAt?: Timestamp;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().assignRole({
        principal: principalOf(req.principal),
        roleId: req.roleId.toWire(),
        scope: req.scope,
        expiresAt: req.expiresAt,
      });
      if (response.assignment) {
        assignments.value.push(response.assignment);
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to assign role";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function revokeAssignment(assignmentId: RoleAssignmentId) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().revokeRole({ assignmentId: assignmentId.toWire() });
      assignments.value = assignments.value.filter(
        (a) => !names(a.id, assignmentId),
      );
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to revoke assignment";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    roles,
    currentRole,
    assignments,
    loading,
    error,
    fetchRoles,
    getRole,
    createRole,
    updateRole,
    deleteRole,
    fetchRoleAssignments,
    fetchMachineUserAssignments,
    assignRole,
    revokeAssignment,
  };
});
