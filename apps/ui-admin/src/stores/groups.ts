import { defineStore } from "pinia";
import { ref } from "vue";
import { AuthzServiceClient } from "@structured-id/proto/sid/v1/authz/authz.client";
import type { Group } from "@structured-id/proto/sid/v1/authz/authz";
import { getAccountTransport } from "@structured-id/ui-core";
import {
  ProjectId,
  type GroupId,
  type ProfileId,
  type wire,
} from "@structured-id/ids";
import { names } from "#admin/ids";

function getClient() {
  return new AuthzServiceClient(getAccountTransport());
}

export const useGroupsStore = defineStore("groups", () => {
  const groups = ref<Group[]>([]);
  const currentGroup = ref<Group | null>(null);
  /** The members as the installation answered them. */
  const members = ref<wire.ProfileId[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // The console administers the installation's system project.
  const projectId = ProjectId.system();

  async function fetchGroups() {
    loading.value = true;
    error.value = null;
    try {
      // Every group, page by page: the page searches and pages locally.
      const client = getClient();
      const all: Group[] = [];
      let pageToken = "";
      do {
        const { response } = await client.listGroups({
          projectId: projectId.toWire(),
          pageSize: 100,
          pageToken,
        });
        all.push(...response.groups);
        pageToken = response.nextPageToken;
      } while (pageToken);
      groups.value = all;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load groups";
    } finally {
      loading.value = false;
    }
  }

  async function getGroup(id: GroupId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getGroup({
        identifier: { oneofKind: "id", id: id.toWire() },
      });
      currentGroup.value = response.group ?? null;
      return response.group;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load group";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createGroup(req: { name: string; description?: string }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().createGroup({
        projectId: projectId.toWire(),
        name: req.name,
        description: req.description,
      });
      if (response.group) {
        groups.value.push(response.group);
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to create group";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateGroup(id: GroupId, description?: string) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateGroup({
        id: id.toWire(),
        description,
      });
      currentGroup.value = response.group ?? null;
      const idx = groups.value.findIndex((g) => names(g.id, id));
      if (idx !== -1 && response.group) {
        groups.value[idx] = response.group;
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update group";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteGroup(id: GroupId) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().deleteGroup({ id: id.toWire() });
      groups.value = groups.value.filter((g) => !names(g.id, id));
      if (names(currentGroup.value?.id, id)) {
        currentGroup.value = null;
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete group";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMembers(groupId: GroupId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listGroupMembers({
        groupId: groupId.toWire(),
      });
      members.value = response.profileIds;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load members";
    } finally {
      loading.value = false;
    }
  }

  async function addMember(groupId: GroupId, profileId: ProfileId) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().addToGroup({
        groupId: groupId.toWire(),
        profileId: profileId.toWire(),
      });
      members.value.push(profileId.toWire());
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to add member";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function removeMember(groupId: GroupId, profileId: ProfileId) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().removeFromGroup({
        groupId: groupId.toWire(),
        profileId: profileId.toWire(),
      });
      members.value = members.value.filter((m) => !names(m, profileId));
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to remove member";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    groups,
    currentGroup,
    members,
    loading,
    error,
    fetchGroups,
    getGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    fetchMembers,
    addMember,
    removeMember,
  };
});
