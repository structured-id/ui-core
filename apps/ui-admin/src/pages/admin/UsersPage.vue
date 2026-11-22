<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h4">
          Users
          <q-badge
            v-if="store.profiles.length"
            color="primary"
            :label="store.profiles.length"
            class="q-ml-sm"
          />
        </div>
      </div>
      <q-btn
        color="primary"
        icon="sym_o_person_add"
        label="Create User"
        no-caps
        @click="createDialog = true"
      />
    </div>

    <!-- Status filter tabs -->
    <q-tabs v-model="statusTab" dense align="left" class="q-mb-md" no-caps>
      <q-tab name="all" :label="`All (${store.profiles.length})`" />
      <q-tab
        name="active"
        :label="`Active (${countByStatus(ProfileStatus.ACTIVE)})`"
      />
      <q-tab
        name="suspended"
        :label="`Suspended (${countByStatus(ProfileStatus.SUSPENDED)})`"
      />
    </q-tabs>

    <!-- Search -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-12 col-sm-4">
        <q-input
          v-model="search"
          outlined
          dense
          placeholder="Search by name, email, or username..."
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
      :rows="filteredProfiles"
      :columns="columns"
      :row-key="(p: Profile) => shown(p.id)"
      flat
      bordered
      :pagination="{ rowsPerPage: 25 }"
      :loading="store.loading"
      @row-click="onRowClick"
      class="cursor-pointer"
    >
      <template #body-cell-formattedName="props">
        <q-td :props="props">
          <div class="text-weight-medium">
            {{ props.row.formattedName || props.row.username || "—" }}
          </div>
        </q-td>
      </template>

      <template #body-cell-email="props">
        <q-td :props="props">
          <span>{{ props.row.email || "—" }}</span>
          <q-icon
            v-if="props.row.email && props.row.emailVerified"
            name="sym_o_verified"
            color="positive"
            size="xs"
            class="q-ml-xs"
          />
        </q-td>
      </template>

      <template #body-cell-status="props">
        <q-td :props="props">
          <q-badge
            :color="profileStatusColor(props.row.status)"
            :label="profileStatusLabel(props.row.status)"
          />
        </q-td>
      </template>

      <template #body-cell-lastLoginAt="props">
        <q-td :props="props">
          {{ formatDate(props.row.lastLoginAt) }}
        </q-td>
      </template>

      <template #body-cell-createdAt="props">
        <q-td :props="props">
          {{ formatDate(props.row.createdAt) }}
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
          <q-icon name="sym_o_people" size="64px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-md">No users yet</div>
          <div class="text-body2 text-grey q-mb-lg">
            Create your first user or configure self-registration.
          </div>
          <q-btn
            color="primary"
            icon="sym_o_person_add"
            label="Create User"
            no-caps
            @click="createDialog = true"
          />
        </div>
      </template>
    </q-table>

    <!-- Create User Dialog -->
    <q-dialog v-model="createDialog">
      <q-card style="min-width: 450px">
        <q-card-section>
          <div class="text-h6">Create User</div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="createForm.username"
            outlined
            dense
            label="Username"
            :rules="[(v: string) => !!v || 'Username is required']"
          />
          <q-input
            v-model="createForm.email"
            outlined
            dense
            label="Email"
            type="email"
          />
          <q-input
            v-model="createForm.givenName"
            outlined
            dense
            label="Given name"
          />
          <q-input
            v-model="createForm.familyName"
            outlined
            dense
            label="Family name"
            hint="Optional"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Create"
            no-caps
            :disable="!createForm.username"
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
          <div class="text-h6">Delete User</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete
            <strong>{{
              profileToDelete?.formattedName || profileToDelete?.username
            }}</strong>?
          </p>
          <p class="text-negative text-caption">
            This action is permanent and cannot be undone.
          </p>
          <q-input
            v-model="deleteConfirmName"
            outlined
            dense
            :placeholder="`Type '${profileToDelete?.username}' to confirm`"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            flat
            color="negative"
            label="Delete"
            :disable="deleteConfirmName !== profileToDelete?.username"
            @click="executeDelete"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useQuasar } from "quasar";
import { useUsersStore } from "#admin/stores/users";
import {
  ProfileStatus,
  ProfileType,
} from "@structured-id/proto/sid/v1/identity/identity";
import type { Profile } from "@structured-id/proto/sid/v1/identity/identity";
import {
  profileStatusLabel,
  profileStatusColor,
} from "#admin/composables/useEnumLabels";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import { ProfileId, required } from "@structured-id/ids";
import { shown } from "#admin/ids";

const store = useUsersStore();
const router = useRouter();
const $q = useQuasar();

const search = ref("");
const statusTab = ref("all");
const createDialog = ref(false);
const deleteDialog = ref(false);
const profileToDelete = ref<Profile | null>(null);
const deleteConfirmName = ref("");

const createForm = ref({
  username: "",
  email: "",
  givenName: "",
  familyName: "",
});

const columns = [
  {
    name: "formattedName",
    label: "Name",
    field: "formattedName",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "username",
    label: "Username",
    field: "username",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "email",
    label: "Email",
    field: "email",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "status",
    label: "Status",
    field: "status",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "lastLoginAt",
    label: "Last Login",
    field: "lastLoginAt",
    align: "left" as const,
    sortable: true,
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

function countByStatus(status: ProfileStatus): number {
  return store.profiles.filter((p) => p.status === status).length;
}

const filteredProfiles = computed(() => {
  let result = store.profiles;

  if (statusTab.value === "active") {
    result = result.filter((p) => p.status === ProfileStatus.ACTIVE);
  } else if (statusTab.value === "suspended") {
    result = result.filter((p) => p.status === ProfileStatus.SUSPENDED);
  }

  if (search.value) {
    const q = search.value.toLowerCase();
    result = result.filter(
      (p) =>
        (p.formattedName || "").toLowerCase().includes(q) ||
        (p.username || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q),
    );
  }

  return result;
});

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  const d = new Date(Number(ts.seconds) * 1000);
  return d.toLocaleDateString();
}

function onRowClick(_evt: Event, row: Profile) {
  router.push({
    name: "admin-user-detail",
    params: { userId: shown(row.id) },
  });
}

function confirmDelete(profile: Profile) {
  profileToDelete.value = profile;
  deleteConfirmName.value = "";
  deleteDialog.value = true;
}

async function executeDelete() {
  if (!profileToDelete.value) return;
  try {
    await store.deleteProfile(required(ProfileId, profileToDelete.value.id));
    deleteDialog.value = false;
    $q.notify({ type: "positive", message: "User deleted" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Delete failed" });
  }
}

async function executeCreate() {
  try {
    const response = await store.createProfile({
      username: createForm.value.username || undefined,
      email: createForm.value.email || undefined,
      givenName: createForm.value.givenName || undefined,
      familyName: createForm.value.familyName || undefined,
      profileType: ProfileType.PERSONAL,
    });
    createDialog.value = false;
    createForm.value = {
      username: "",
      email: "",
      givenName: "",
      familyName: "",
    };
    $q.notify({ type: "positive", message: "User created" });
    if (response.profile) {
      router.push({
        name: "admin-user-detail",
        params: { userId: shown(response.profile.id) },
      });
    }
  } catch {
    $q.notify({ type: "negative", message: store.error || "Create failed" });
  }
}

onMounted(() => {
  store.fetchProfiles();
});
</script>
