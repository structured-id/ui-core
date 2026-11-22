<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h4">
          Groups
          <q-badge
            v-if="store.groups.length"
            color="primary"
            :label="store.groups.length"
            class="q-ml-sm"
          />
        </div>
      </div>
      <q-btn
        color="primary"
        icon="sym_o_group_add"
        label="Create Group"
        no-caps
        @click="createDialog = true"
      />
    </div>

    <!-- Search -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-12 col-sm-4">
        <q-input
          v-model="search"
          outlined
          dense
          placeholder="Search by name..."
          clearable
        >
          <template #prepend>
            <q-icon name="sym_o_search" />
          </template>
        </q-input>
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

    <!-- Table -->
    <q-table
      :rows="filteredGroups"
      :columns="columns"
      :row-key="groupKey"
      flat
      bordered
      :pagination="{ rowsPerPage: 25 }"
      :loading="store.loading"
      @row-click="onRowClick"
      class="cursor-pointer"
    >
      <template #body-cell-name="props">
        <q-td :props="props">
          <div class="text-weight-medium">{{ props.row.name }}</div>
        </q-td>
      </template>

      <template #body-cell-createdAt="props">
        <q-td :props="props">
          <span class="text-caption text-grey">
            {{ formatDate(props.row.createdAt) }}
          </span>
        </q-td>
      </template>

      <template #body-cell-actions="props">
        <q-td :props="props" auto-width>
          <q-btn
            flat
            round
            dense
            icon="sym_o_delete"
            color="negative"
            @click.stop="confirmDelete(props.row)"
          >
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>

      <template #no-data>
        <div v-if="!store.error" class="full-width text-center q-pa-xl">
          <q-icon name="sym_o_groups" size="64px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-md">No groups yet</div>
          <div class="text-body2 text-grey q-mb-lg">
            Create groups to organize users and assign roles collectively.
          </div>
          <q-btn
            color="primary"
            icon="sym_o_group_add"
            label="Create Group"
            no-caps
            @click="createDialog = true"
          />
        </div>
      </template>
    </q-table>

    <!-- Create Group Dialog -->
    <q-dialog v-model="createDialog">
      <q-card style="min-width: 450px">
        <q-card-section>
          <div class="text-h6">Create Group</div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="createForm.name"
            outlined
            dense
            label="Group name"
            :rules="[(v: string) => !!v || 'Name is required']"
          />
          <q-input
            v-model="createForm.description"
            outlined
            dense
            label="Description (optional)"
            type="textarea"
            autogrow
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Create"
            no-caps
            :disable="!createForm.name"
            :loading="store.loading"
            @click="executeCreate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Delete confirmation -->
    <q-dialog v-model="deleteDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Delete Group</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete group
            <strong>{{ groupToDelete?.name }}</strong>?
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
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useQuasar } from "quasar";
import { useGroupsStore } from "#admin/stores/groups";
import type { Group } from "@structured-id/proto/sid/v1/authz/authz";
import { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import { GroupId, required } from "@structured-id/ids";
import { shown } from "#admin/ids";

const store = useGroupsStore();
const router = useRouter();
const $q = useQuasar();

const search = ref("");
const createDialog = ref(false);
const deleteDialog = ref(false);
const groupToDelete = ref<Group | null>(null);

const createForm = ref({
  name: "",
  description: "",
});

const columns = [
  {
    name: "name",
    label: "Name",
    field: "name",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "description",
    label: "Description",
    field: "description",
    align: "left" as const,
  },
  {
    name: "createdAt",
    label: "Created",
    field: "createdAt",
    align: "left" as const,
    sortable: true,
  },
  { name: "actions", label: "", field: "id" },
];

const filteredGroups = computed(() => {
  if (!search.value) return store.groups;
  const q = search.value.toLowerCase();
  return store.groups.filter((g) => g.name.toLowerCase().includes(q));
});

/** A group's row key and route parameter: its id's text. */
function groupKey(group: Group): string {
  return shown(group.id);
}

function onRowClick(_evt: Event, row: Group) {
  router.push({
    name: "admin-group-detail",
    params: { groupId: groupKey(row) },
  });
}

function confirmDelete(group: Group) {
  groupToDelete.value = group;
  deleteDialog.value = true;
}

async function executeDelete() {
  if (!groupToDelete.value) return;
  try {
    await store.deleteGroup(required(GroupId, groupToDelete.value.id));
    deleteDialog.value = false;
    $q.notify({ type: "positive", message: "Group deleted" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Delete failed" });
  }
}

async function executeCreate() {
  try {
    await store.createGroup({
      name: createForm.value.name,
      description: createForm.value.description || undefined,
    });
    createDialog.value = false;
    createForm.value = { name: "", description: "" };
    $q.notify({ type: "positive", message: "Group created" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Create failed" });
  }
}

function formatDate(ts?: { seconds: bigint; nanos: number }): string {
  if (!ts) return "—";
  return Timestamp.toDate(ts).toLocaleDateString();
}

onMounted(() => {
  store.fetchGroups();
});
</script>
