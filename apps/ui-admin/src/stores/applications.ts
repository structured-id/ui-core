import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { ProjectServiceClient } from "@structured-id/proto/sid/v1/projects/projects.client";
import {
  ResourceState,
  type Application,
  type CreateApplicationRequest,
  type UpdateApplicationRequest,
  type UpdateClientRoleRequest,
} from "@structured-id/proto/sid/v1/projects/projects";
import { getAccountTransport } from "@structured-id/ui-core";
import type { ApplicationId, ProjectId } from "@structured-id/ids";
import { names, sameWire } from "src/ids";

function getClient() {
  return new ProjectServiceClient(getAccountTransport());
}

/** An application is active while either of its roles takes part in token issuance. */
export function isApplicationActive(app: Application): boolean {
  return (
    app.client?.active === true || app.resource?.state === ResourceState.ACTIVE
  );
}

export const useApplicationsStore = defineStore("applications", () => {
  const applications = ref<Application[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentApp = ref<Application | null>(null);
  const lastCreatedSecret = ref<string | null>(null);

  const activeCount = computed(
    () => applications.value.filter(isApplicationActive).length,
  );

  function replace(app: Application) {
    currentApp.value = app;
    const idx = applications.value.findIndex(
      (a) =>
        a.id !== undefined && app.id !== undefined && sameWire(a.id, app.id),
    );
    if (idx !== -1) {
      applications.value[idx] = app;
    }
  }

  async function fetchApplications(projectId: ProjectId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listApplications({
        projectId: projectId.toWire(),
        pageSize: 100,
        pageToken: "",
      });
      applications.value = response.applications;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load applications";
    } finally {
      loading.value = false;
    }
  }

  async function createApplication(req: CreateApplicationRequest) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().createApplication(req);
      if (response.application) {
        applications.value.push(response.application);
      }
      lastCreatedSecret.value = response.clientSecret;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to create application";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getApplication(id: ApplicationId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getApplication({
        id: id.toWire(),
      });
      currentApp.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load application";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateApplication(req: UpdateApplicationRequest) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateApplication(req);
      replace(response);
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update application";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateClientRole(req: UpdateClientRoleRequest) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateClientRole(req);
      replace(response);
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update application";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteApplication(id: ApplicationId) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().deleteApplication({ id: id.toWire() });
      applications.value = applications.value.filter((a) => !names(a.id, id));
      if (names(currentApp.value?.id, id)) {
        currentApp.value = null;
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete application";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    applications,
    loading,
    error,
    currentApp,
    lastCreatedSecret,
    activeCount,
    fetchApplications,
    createApplication,
    getApplication,
    updateApplication,
    updateClientRole,
    deleteApplication,
  };
});
