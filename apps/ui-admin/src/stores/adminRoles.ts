import { defineStore } from "pinia";
import { ref } from "vue";
import { AdminRoleServiceClient } from "@structured-id/proto/sid/v1/admin/admin_roles.client";
import type {
  AdminRole,
  AdminAssignment,
  EffectivePermission,
  AdminSessionPolicy,
  ActiveAdminSession,
} from "@structured-id/proto/sid/v1/admin/admin_roles";
import {
  AdminRoleScope,
  AdminPrincipalType,
  AssignmentType,
} from "@structured-id/proto/sid/v1/admin/admin_roles";
import { getAccountTransport } from "@structured-id/ui-core";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";

function getClient() {
  return new AdminRoleServiceClient(getAccountTransport());
}

export const useAdminRolesStore = defineStore("adminRoles", () => {
  const roles = ref<AdminRole[]>([]);
  const currentRole = ref<AdminRole | null>(null);
  const assignments = ref<AdminAssignment[]>([]);
  const effectivePermissions = ref<EffectivePermission[]>([]);
  const sessionPolicy = ref<AdminSessionPolicy | null>(null);
  const activeSessions = ref<ActiveAdminSession[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  // ── Roles ──

  async function fetchRoles(scope?: AdminRoleScope) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listAdminRoles({
        scope: scope ?? AdminRoleScope.UNSPECIFIED,
      });
      roles.value = response.roles;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load roles";
    } finally {
      loading.value = false;
    }
  }

  /** The role asked for last; only its answer is shown. */
  let roleShown = "";

  async function fetchRole(roleId: string) {
    if (roleShown !== roleId) {
      roleShown = roleId;
      currentRole.value = null;
    }
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getAdminRole({ roleId });
      if (roleShown === roleId) currentRole.value = response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load role";
    } finally {
      loading.value = false;
    }
  }

  // ── Assignments ──

  async function fetchAssignments(filters?: {
    roleId?: string;
    principalType?: AdminPrincipalType;
    search?: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listAssignments({
        roleId: filters?.roleId ?? "",
        principalType: filters?.principalType ?? AdminPrincipalType.UNSPECIFIED,
        search: filters?.search ?? "",
      });
      assignments.value = response.assignments;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load assignments";
    } finally {
      loading.value = false;
    }
  }

  async function assignRole(req: {
    principalId: string;
    principalType: AdminPrincipalType;
    roleId: string;
    scopeTargetId?: string;
    assignmentType: AssignmentType;
    expiresAt?: Timestamp;
  }) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await getClient().assignRole({
        principalId: req.principalId,
        principalType: req.principalType,
        roleId: req.roleId,
        scopeTargetId: req.scopeTargetId ?? "",
        assignmentType: req.assignmentType,
        expiresAt: req.expiresAt,
      });
      assignments.value.push(response);
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to assign role";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function revokeAssignment(assignmentId: string) {
    saving.value = true;
    error.value = null;
    try {
      await getClient().revokeAssignment({ assignmentId });
      assignments.value = assignments.value.filter(
        (a) => a.assignmentId !== assignmentId,
      );
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to revoke assignment";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function fetchEffectivePermissions(principalId: string) {
    error.value = null;
    try {
      const { response } = await getClient().getEffectivePermissions({
        principalId,
      });
      effectivePermissions.value = response.permissions;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load permissions";
    }
  }

  // ── Session Security ──

  async function fetchSessionPolicy() {
    error.value = null;
    try {
      const { response } = await getClient().getAdminSessionPolicy({});
      sessionPolicy.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load session policy";
    }
  }

  async function updateSessionPolicy(policy: AdminSessionPolicy) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateAdminSessionPolicy(policy);
      sessionPolicy.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update session policy";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function fetchActiveSessions() {
    error.value = null;
    try {
      const { response } = await getClient().listActiveAdminSessions({});
      activeSessions.value = response.sessions;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load active sessions";
    }
  }

  async function revokeAdminSession(sessionId: string) {
    error.value = null;
    try {
      await getClient().revokeAdminSession({ sessionId });
      activeSessions.value = activeSessions.value.filter(
        (s) => s.sessionId !== sessionId,
      );
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to revoke session";
      throw err;
    }
  }

  async function revokeAllAdminSessions() {
    error.value = null;
    try {
      const { response } = await getClient().revokeAllAdminSessions({});
      activeSessions.value = [];
      return response.revokedCount;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to revoke all sessions";
      throw err;
    }
  }

  return {
    roles,
    currentRole,
    assignments,
    effectivePermissions,
    sessionPolicy,
    activeSessions,
    loading,
    saving,
    error,
    fetchRoles,
    fetchRole,
    fetchAssignments,
    assignRole,
    revokeAssignment,
    fetchEffectivePermissions,
    fetchSessionPolicy,
    updateSessionPolicy,
    fetchActiveSessions,
    revokeAdminSession,
    revokeAllAdminSessions,
  };
});
