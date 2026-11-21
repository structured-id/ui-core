<template>
  <q-page padding>
    <!-- Header -->
    <div class="row items-center q-mb-lg">
      <q-btn
        flat
        round
        icon="sym_o_arrow_back"
        :to="{ name: 'admin-groups' }"
      />
      <div class="col q-ml-sm">
        <div class="row items-center q-gutter-sm">
          <div class="text-h5">
            {{ store.currentGroup?.name || "Group" }}
          </div>
          <q-badge
            v-if="store.members.length"
            color="primary"
            :label="`${store.members.length} members`"
          />
        </div>
        <div v-if="store.currentGroup" class="text-caption text-grey">
          {{ store.currentGroup.description || "No description" }}
          <template v-if="store.currentGroup.createdAt">
            · Created {{ formatDate(store.currentGroup.createdAt) }}
          </template>
        </div>
      </div>
    </div>

    <q-linear-progress
      v-if="store.loading"
      indeterminate
      color="primary"
      class="q-mb-md"
    />

    <q-banner v-if="store.error" dense class="bg-negative text-white q-mb-md">
      {{ store.error }}
    </q-banner>

    <!-- Tabs -->
    <q-tabs v-model="tab" dense align="left" class="q-mb-lg" no-caps>
      <q-tab name="settings" label="Settings" icon="sym_o_settings" />
      <q-tab name="members" label="Members" icon="sym_o_people" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <!-- Settings Tab -->
      <q-tab-panel name="settings">
        <div
          v-if="store.currentGroup"
          class="q-gutter-md"
          style="max-width: 600px"
        >
          <q-input
            :model-value="store.currentGroup.name"
            outlined
            label="Group name"
            readonly
            dense
            hint="Cannot be changed after creation"
          />
          <q-input
            v-model="settingsForm.description"
            outlined
            label="Description"
            dense
            type="textarea"
            autogrow
          />

          <q-btn
            color="primary"
            label="Save Changes"
            no-caps
            :loading="store.loading"
            :disable="
              settingsForm.description ===
              (store.currentGroup.description || '')
            "
            @click="saveSettings"
          />

          <!-- Danger Zone -->
          <q-separator class="q-my-lg" />
          <div class="text-subtitle1 text-negative">Danger Zone</div>
          <q-card flat bordered class="q-pa-md">
            <div class="row items-center justify-between">
              <div>
                <div class="text-subtitle2">Delete this group</div>
                <div class="text-caption text-grey">
                  All members will lose roles assigned through this group.
                </div>
              </div>
              <q-btn
                outline
                color="negative"
                label="Delete"
                no-caps
                @click="confirmDelete"
              />
            </div>
          </q-card>
        </div>
      </q-tab-panel>

      <!-- Members Tab -->
      <q-tab-panel name="members">
        <div style="max-width: 600px">
          <div class="row items-center q-mb-md">
            <div class="col text-subtitle2">
              Members ({{ store.members.length }})
            </div>
            <q-btn
              flat
              dense
              icon="sym_o_person_add"
              label="Add Member"
              no-caps
              @click="addMemberDialog = true"
            />
          </div>

          <q-list bordered separator v-if="store.members.length">
            <q-item v-for="member in store.members" :key="memberText(member)">
              <q-item-section avatar>
                <q-icon name="sym_o_person" />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  <code class="text-caption">{{ memberText(member) }}</code>
                  <q-btn
                    flat
                    round
                    dense
                    size="xs"
                    icon="sym_o_content_copy"
                    @click="copyToClipboard(memberText(member))"
                  />
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  round
                  dense
                  icon="sym_o_person_remove"
                  color="negative"
                  @click="removeMember(member)"
                >
                  <q-tooltip>Remove</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="text-grey q-pa-md text-center">
            No members in this group.
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Delete confirmation -->
    <q-dialog v-model="deleteDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Delete Group</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete group
            <strong>{{ store.currentGroup?.name }}</strong
            >?
          </p>
          <p class="text-negative text-caption">
            All members will lose roles assigned through this group.
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn flat color="negative" label="Delete" @click="executeDelete" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Add Member Dialog -->
    <q-dialog v-model="addMemberDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Add Member</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="newMemberId"
            outlined
            dense
            label="Profile ID"
            placeholder="Enter user profile ID"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Add"
            no-caps
            :disable="!newMemberId"
            :loading="store.loading"
            @click="executeAddMember"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { copyToClipboard, useQuasar } from "quasar";
import { useGroupsStore } from "src/stores/groups";
import { Timestamp } from "@structured-id/ui-core";
import { GroupId, ProfileId, required, type wire } from "@structured-id/ids";
import { shown } from "src/ids";

const store = useGroupsStore();
const route = useRoute();
const router = useRouter();
const $q = useQuasar();

const tab = ref("settings");
const deleteDialog = ref(false);
const addMemberDialog = ref(false);
const newMemberId = ref("");

const settingsForm = reactive({
  description: "",
});

function populateForm() {
  const g = store.currentGroup;
  if (!g) return;
  settingsForm.description = g.description || "";
}

watch(() => store.currentGroup, populateForm, { immediate: true });

function formatDate(ts?: { seconds: bigint; nanos: number }): string {
  if (!ts) return "—";
  return Timestamp.toDate(ts).toLocaleDateString();
}

/** A member's id as text, for display and as its list key. */
function memberText(member: wire.ProfileId): string {
  return shown(member);
}

async function saveSettings() {
  if (!store.currentGroup) return;
  try {
    await store.updateGroup(
      required(GroupId, store.currentGroup.id),
      settingsForm.description || undefined,
    );
    $q.notify({ type: "positive", message: "Group updated" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Update failed" });
  }
}

async function removeMember(member: wire.ProfileId) {
  if (!store.currentGroup) return;
  try {
    await store.removeMember(
      required(GroupId, store.currentGroup.id),
      required(ProfileId, member),
    );
    $q.notify({ type: "positive", message: "Member removed" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Remove failed" });
  }
}

async function executeAddMember() {
  if (!store.currentGroup || !newMemberId.value) return;
  let profileId: ProfileId;
  try {
    profileId = ProfileId.parse(newMemberId.value.trim());
  } catch {
    $q.notify({ type: "negative", message: "This is not a profile ID" });
    return;
  }
  try {
    await store.addMember(required(GroupId, store.currentGroup.id), profileId);
    addMemberDialog.value = false;
    newMemberId.value = "";
    $q.notify({ type: "positive", message: "Member added" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Add failed" });
  }
}

function confirmDelete() {
  deleteDialog.value = true;
}

async function executeDelete() {
  if (!store.currentGroup) return;
  try {
    await store.deleteGroup(required(GroupId, store.currentGroup.id));
    deleteDialog.value = false;
    $q.notify({ type: "positive", message: "Group deleted" });
    router.push({ name: "admin-groups" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Delete failed" });
  }
}

onMounted(async () => {
  let groupId: GroupId;
  try {
    groupId = GroupId.parse(route.params.groupId as string);
  } catch {
    store.error = "This address names no group";
    return;
  }
  await store.getGroup(groupId);
  store.fetchMembers(groupId);
});
</script>
