<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h4">
          Roles
          <q-badge
            v-if="store.roles.length"
            color="primary"
            :label="store.roles.length"
            class="q-ml-sm"
          />
        </div>
      </div>
      <q-btn
        color="primary"
        icon="sym_o_add"
        label="Create Role"
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
      :rows="filteredRoles"
      :columns="columns"
      :row-key="roleKey"
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

      <template #body-cell-permissions="props">
        <q-td :props="props">
          <q-badge
            color="blue-grey"
            :label="`${props.row.permissions.length} permissions`"
          />
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
        <div class="full-width text-center q-pa-xl">
          <q-icon name="sym_o_shield_person" size="64px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-md">No roles defined</div>
          <div class="text-body2 text-grey q-mb-lg">
            Create roles to manage access control.
          </div>
          <q-btn
            color="primary"
            icon="sym_o_add"
            label="Create Role"
            no-caps
            @click="createDialog = true"
          />
        </div>
      </template>
    </q-table>

    <!-- Create Role Dialog -->
    <q-dialog v-model="createDialog">
      <q-card style="min-width: 450px">
        <q-card-section>
          <div class="text-h6">Create Role</div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="createForm.name"
            outlined
            dense
            label="Role name"
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
          <div class="text-subtitle2">Permissions</div>
          <div class="q-gutter-sm">
            <q-checkbox
              v-for="perm in availablePermissions"
              :key="perm"
              v-model="createForm.permissions"
              :val="perm"
              :label="perm"
            />
          </div>
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
          <div class="text-h6">Delete Role</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete role
            <strong>{{ roleToDelete?.name }}</strong>?
          </p>
          <p class="text-negative text-caption">
            All users and groups with this role will lose it.
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
import { useRolesStore } from "#admin/stores/roles";
import type { Role } from "@structured-id/proto/sid/v1/authz/authz";
import { RoleId, required } from "@structured-id/ids";
import { shown } from "#admin/ids";

const store = useRolesStore();
const router = useRouter();
const $q = useQuasar();

const search = ref("");
const createDialog = ref(false);
const deleteDialog = ref(false);
const roleToDelete = ref<Role | null>(null);

const createForm = ref({
  name: "",
  description: "",
  permissions: [] as string[],
});

const availablePermissions = [
  "profiles:read",
  "profiles:write",
  "profiles:delete",
  "clients:read",
  "clients:write",
  "clients:delete",
  "roles:read",
  "roles:write",
  "roles:delete",
  "groups:read",
  "groups:write",
  "groups:delete",
  "sessions:read",
  "sessions:revoke",
  "settings:read",
  "settings:write",
  "audit:read",
];

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
    name: "permissions",
    label: "Permissions",
    field: "permissions",
    align: "left" as const,
  },
  { name: "actions", label: "", field: "id" },
];

const filteredRoles = computed(() => {
  if (!search.value) return store.roles;
  const q = search.value.toLowerCase();
  return store.roles.filter((r) => r.name.toLowerCase().includes(q));
});

/** A role's row key and route parameter: its id's text. */
function roleKey(role: Role): string {
  return shown(role.id);
}

function onRowClick(_evt: Event, row: Role) {
  router.push({
    name: "admin-role-detail",
    params: { roleId: roleKey(row) },
  });
}

function confirmDelete(role: Role) {
  roleToDelete.value = role;
  deleteDialog.value = true;
}

async function executeDelete() {
  if (!roleToDelete.value) return;
  try {
    await store.deleteRole(required(RoleId, roleToDelete.value.id));
    deleteDialog.value = false;
    $q.notify({ type: "positive", message: "Role deleted" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Delete failed" });
  }
}

async function executeCreate() {
  try {
    await store.createRole({
      name: createForm.value.name,
      description: createForm.value.description || undefined,
      permissions: createForm.value.permissions,
    });
    createDialog.value = false;
    createForm.value = { name: "", description: "", permissions: [] };
    $q.notify({ type: "positive", message: "Role created" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Create failed" });
  }
}

onMounted(() => {
  store.fetchRoles();
});
</script>
