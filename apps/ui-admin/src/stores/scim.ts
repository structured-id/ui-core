import { defineStore } from "pinia";
import { ref } from "vue";
import { ScimServiceClient } from "@structured-id/proto/sid/v1/scim/scim.client";
import type {
  ScimUser,
  ScimGroup,
  ScimServiceProviderConfig,
  ScimResourceType,
  ScimSchema,
} from "@structured-id/proto/sid/v1/scim/scim";
import { getAccountTransport } from "@structured-id/ui-core";

function getClient() {
  return new ScimServiceClient(getAccountTransport());
}

export const useScimStore = defineStore("scim", () => {
  const users = ref<ScimUser[]>([]);
  const usersTotalResults = ref(0);
  const groups = ref<ScimGroup[]>([]);
  const groupsTotalResults = ref(0);
  const providerConfig = ref<ScimServiceProviderConfig | null>(null);
  const resourceTypes = ref<ScimResourceType[]>([]);
  const schemas = ref<ScimSchema[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ── Users ──

  async function fetchUsers(filter?: string, startIndex?: number) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listUsers({
        filter: filter || "",
        startIndex: startIndex ?? 1,
        count: 25,
      });
      users.value = response.resources;
      usersTotalResults.value = response.totalResults;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load SCIM users";
    } finally {
      loading.value = false;
    }
  }

  async function deleteUser(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().deleteUser({ id });
      users.value = users.value.filter((u) => u.id !== id);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete SCIM user";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Groups ──

  async function fetchGroups(filter?: string, startIndex?: number) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listGroups({
        filter: filter || "",
        startIndex: startIndex ?? 1,
        count: 25,
      });
      groups.value = response.resources;
      groupsTotalResults.value = response.totalResults;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load SCIM groups";
    } finally {
      loading.value = false;
    }
  }

  async function deleteGroup(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().deleteGroup({ id });
      groups.value = groups.value.filter((g) => g.id !== id);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete SCIM group";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Configuration ──

  async function fetchProviderConfig() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getServiceProviderConfig({});
      providerConfig.value = response;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to load SCIM provider config";
    } finally {
      loading.value = false;
    }
  }

  async function fetchResourceTypes() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getResourceTypes({});
      resourceTypes.value = response.resources;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to load SCIM resource types";
    } finally {
      loading.value = false;
    }
  }

  async function fetchSchemas() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getSchemas({});
      schemas.value = response.resources;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load SCIM schemas";
    } finally {
      loading.value = false;
    }
  }

  return {
    users,
    usersTotalResults,
    groups,
    groupsTotalResults,
    providerConfig,
    resourceTypes,
    schemas,
    loading,
    error,
    fetchUsers,
    deleteUser,
    fetchGroups,
    deleteGroup,
    fetchProviderConfig,
    fetchResourceTypes,
    fetchSchemas,
  };
});
