import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { ProjectServiceClient } from "@structured-id/proto/sid/v1/projects/projects.client";
import {
  ResourceState,
  type Application,
  type CreateApplicationRequest,
  type ResourceAccess,
  type UpdateApplicationRequest,
  type UpdateClientRoleRequest,
} from "@structured-id/proto/sid/v1/projects/projects";
import { getAccountTransport } from "@structured-id/ui-core";
import type { ApplicationId, ProjectId } from "@structured-id/ids";
import { names, sameWire } from "#admin/ids";

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

  /** `app` in the list, and as the open application only if it still is. */
  function replace(app: Application) {
    const open = currentApp.value?.id;
    if (open && app.id && sameWire(open, app.id)) currentApp.value = app;
    const idx = applications.value.findIndex(
      (a) =>
        a.id !== undefined && app.id !== undefined && sameWire(a.id, app.id),
    );
    if (idx !== -1) {
      applications.value[idx] = app;
    }
  }

  /** Every application of the project, page by page: the list page searches and pages locally. */
  async function fetchApplications(projectId: ProjectId) {
    loading.value = true;
    error.value = null;
    try {
      const client = getClient();
      const all: Application[] = [];
      let pageToken = "";
      do {
        const { response } = await client.listApplications({
          projectId: projectId.toWire(),
          pageSize: 100,
          pageToken,
        });
        all.push(...response.applications);
        pageToken = response.nextPageToken;
      } while (pageToken);
      applications.value = all;
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

  /** The application whose detail is shown; another one's starts empty. */
  let appShown: ApplicationId | null = null;

  async function getApplication(id: ApplicationId) {
    if (!appShown?.equals(id)) {
      appShown = id;
      currentApp.value = null;
    }
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getApplication({
        id: id.toWire(),
      });
      if (appShown?.equals(id)) currentApp.value = response;
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

  /** Every access `clientId` holds: the resources it may obtain tokens for. */
  async function listClientAccess(clientId: string): Promise<ResourceAccess[]> {
    const { response } = await getClient().listResourceAccess({
      subject: { oneofKind: "clientId", clientId },
    });
    return response.access;
  }

  /**
   * Gives `clientId` access to the resource with exactly `scopes`, replacing
   * the scopes of an access it already has: repeating it changes nothing.
   */
  async function setClientAccess(
    clientId: string,
    resourceId: ResourceAccess["resourceId"],
    scopes: string[],
  ): Promise<ResourceAccess> {
    const { response } = await getClient().setResourceAccess({
      clientId,
      resourceId,
      scopes,
    });
    return response;
  }

  /** Ends `clientId`'s access to the resource. */
  async function removeClientAccess(
    clientId: string,
    resourceId: ResourceAccess["resourceId"],
  ): Promise<void> {
    await getClient().removeResourceAccess({ clientId, resourceId });
  }

  /**
   * Saves the resource `clientId`'s tokens are for when a request names
   * none; without `resourceId` the default is removed. The client must have
   * access to it. No other client setting is touched.
   */
  async function setDefaultTarget(
    clientId: string,
    resourceId: ResourceAccess["resourceId"],
  ): Promise<Application> {
    const { response } = await getClient().updateClientRole({
      clientId,
      redirectUris: [],
      allowedScopes: [],
      grantTypes: [],
      defaultResource: { resourceId },
    });
    replace(response);
    return response;
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
    listClientAccess,
    setClientAccess,
    removeClientAccess,
    setDefaultTarget,
    deleteApplication,
  };
});
