import { defineStore } from "pinia";
import { ref } from "vue";
import { GovernanceServiceClient } from "@structured-id/proto/sid/v1/authz/governance.client";
import { AuthzServiceClient } from "@structured-id/proto/sid/v1/authz/authz.client";
import type {
  AccessRequestDetail,
  GrantTemporaryRoleRequest,
} from "@structured-id/proto/sid/v1/authz/governance";
import { AccessRequestStatus } from "@structured-id/proto/sid/v1/authz/governance";
import type { RoleAssignment } from "@structured-id/proto/sid/v1/authz/authz";
import { getTransport } from "@structured-id/ui-core";
import type { AccessRequestId } from "@structured-id/ids";
import { names } from "src/ids";

function getGovernanceClient() {
  return new GovernanceServiceClient(getTransport());
}

function getAuthzClient() {
  return new AuthzServiceClient(getTransport());
}

export const useGovernanceStore = defineStore("governance", () => {
  const assignments = ref<RoleAssignment[]>([]);
  const pendingRequests = ref<AccessRequestDetail[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchRoleAssignments() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getAuthzClient().listRoleAssignments({
        filter: { oneofKind: undefined },
      });
      assignments.value = response.assignments;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load role assignments";
    } finally {
      loading.value = false;
    }
  }

  async function fetchPendingRequests() {
    error.value = null;
    try {
      const { response } = await getGovernanceClient().listPendingRequests({
        pagination: { pageSize: 100, pageToken: "" },
      });
      pendingRequests.value = response.requests;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load pending requests";
    }
  }

  async function decideRequest(
    requestId: AccessRequestId,
    approved: boolean,
    reason: string,
  ) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getGovernanceClient().decideRequest({
        requestId: requestId.toWire(),
        approved,
        reason,
      });
      pendingRequests.value = pendingRequests.value.filter(
        (r) => !names(r.requestId, requestId),
      );
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to decide request";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function grantTemporaryRole(req: GrantTemporaryRoleRequest) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getGovernanceClient().grantTemporaryRole(req);
      await fetchRoleAssignments();
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to grant temporary role";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    assignments,
    pendingRequests,
    loading,
    error,
    fetchRoleAssignments,
    fetchPendingRequests,
    decideRequest,
    grantTemporaryRole,
    AccessRequestStatus,
  };
});
