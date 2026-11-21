import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";
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
  /** The members as the installation answered them, of `membersOf`. */
  const members = ref<wire.ProfileId[]>([]);
  /** The group the shown members belong to; actions on them target it. */
  const membersOf = shallowRef<GroupId | null>(null);
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

  /** The group whose detail is shown; another group's starts empty. */
  let groupShown: GroupId | null = null;

  async function getGroup(id: GroupId) {
    if (!groupShown?.equals(id)) {
      groupShown = id;
      currentGroup.value = null;
    }
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getGroup({
        identifier: { oneofKind: "id", id: id.toWire() },
      });
      if (groupShown?.equals(id)) currentGroup.value = response.group ?? null;
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
      // Another group opened meanwhile keeps its detail; the list still
      // takes the answer.
      if (groupShown?.equals(id)) currentGroup.value = response.group ?? null;
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

  /**
   * The members of `groupId`. Another group's rows are cleared at once, and
   * an answer for a group no longer shown is dropped.
   */
  async function fetchMembers(groupId: GroupId) {
    loading.value = true;
    error.value = null;
    membersOf.value = groupId;
    members.value = [];
    try {
      const { response } = await getClient().listGroupMembers({
        groupId: groupId.toWire(),
      });
      if (membersOf.value !== groupId) return;
      members.value = response.profileIds;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load members";
    } finally {
      loading.value = false;
    }
  }

  /** Add `profileId` to the group whose members are shown. */
  async function addMember(profileId: ProfileId) {
    const groupId = membersOf.value;
    if (!groupId) throw new Error("No group's members are shown");
    loading.value = true;
    error.value = null;
    try {
      await getClient().addToGroup({
        groupId: groupId.toWire(),
        profileId: profileId.toWire(),
      });
      if (membersOf.value === groupId) members.value.push(profileId.toWire());
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to add member";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /** Remove `profileId` from the group whose members are shown. */
  async function removeMember(profileId: ProfileId) {
    const groupId = membersOf.value;
    if (!groupId) throw new Error("No group's members are shown");
    loading.value = true;
    error.value = null;
    try {
      await getClient().removeFromGroup({
        groupId: groupId.toWire(),
        profileId: profileId.toWire(),
      });
      if (membersOf.value === groupId) {
        members.value = members.value.filter((m) => !names(m, profileId));
      }
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
    membersOf,
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
