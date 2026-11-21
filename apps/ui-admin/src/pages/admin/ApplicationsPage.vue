<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h4">
          Applications
          <q-badge
            v-if="store.applications.length"
            color="primary"
            :label="store.applications.length"
            class="q-ml-sm"
          />
        </div>
      </div>
      <q-btn
        color="primary"
        icon="sym_o_add"
        label="Create Application"
        no-caps
        :to="{ name: 'admin-application-create' }"
      />
    </div>

    <!-- Filters -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-12 col-sm-4">
        <q-input
          v-model="search"
          outlined
          dense
          placeholder="Search by name or client_id..."
          clearable
        >
          <template #prepend>
            <q-icon name="sym_o_search" />
          </template>
        </q-input>
      </div>
      <div class="col-auto">
        <q-select
          v-model="typeFilter"
          outlined
          dense
          :options="typeOptions"
          emit-value
          map-options
          label="Type"
          style="min-width: 140px"
          clearable
        />
      </div>
      <div class="col-auto">
        <q-select
          v-model="statusFilter"
          outlined
          dense
          :options="statusOptions"
          emit-value
          map-options
          label="Status"
          style="min-width: 140px"
          clearable
        />
      </div>
    </div>

    <!-- Loading -->
    <q-linear-progress
      v-if="store.loading"
      indeterminate
      color="primary"
      class="q-mb-md"
    />

    <!-- Error -->
    <q-banner v-if="store.error" dense class="bg-negative text-white q-mb-md">
      {{ store.error }}
    </q-banner>

    <!-- Table -->
    <q-table
      :rows="filteredApps"
      :columns="columns"
      row-key="id"
      flat
      bordered
      :pagination="{ rowsPerPage: 25 }"
      :loading="store.loading"
      @row-click="onRowClick"
      class="cursor-pointer"
    >
      <template #body-cell-name="props">
        <q-td :props="props">
          <div class="text-weight-medium">
            {{ props.row.name }}
            <q-badge
              v-if="props.row.client?.dynamicallyRegistered"
              color="info"
              label="DCR"
              class="q-ml-xs"
              dense
            />
          </div>
        </q-td>
      </template>

      <template #body-cell-roles="props">
        <q-td :props="props">
          <q-badge
            v-if="props.row.client"
            :color="applicationTypeColor(props.row.client.type)"
            :label="applicationTypeLabel(props.row.client.type)"
            class="q-mr-xs"
          />
          <q-badge v-if="props.row.resource" color="teal" label="Resource" />
        </q-td>
      </template>

      <template #body-cell-active="props">
        <q-td :props="props">
          <q-badge
            :color="isApplicationActive(props.row) ? 'positive' : 'grey'"
            :label="isApplicationActive(props.row) ? 'Active' : 'Inactive'"
          />
        </q-td>
      </template>

      <template #body-cell-clientId="props">
        <q-td :props="props">
          <template v-if="props.row.client">
            <code class="text-caption"
              >{{ props.row.client.clientId.substring(0, 16) }}...</code
            >
            <q-btn
              flat
              round
              dense
              size="xs"
              icon="sym_o_content_copy"
              @click.stop="copyToClipboard(props.row.client.clientId)"
            />
          </template>
          <span v-else class="text-caption text-grey">—</span>
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

      <!-- Empty state -->
      <template #no-data>
        <div class="full-width text-center q-pa-xl">
          <q-icon name="sym_o_apps" size="64px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-md">No applications yet</div>
          <div class="text-body2 text-grey q-mb-lg">
            Create your first application to start integrating with
            StructuredID.
          </div>
          <q-btn
            color="primary"
            icon="sym_o_add"
            label="Create Application"
            no-caps
            :to="{ name: 'admin-application-create' }"
          />
        </div>
      </template>
    </q-table>

    <!-- Delete confirmation -->
    <q-dialog v-model="deleteDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Delete Application</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete
            <strong>{{ appToDelete?.name }}</strong>?
          </p>
          <p class="text-negative text-caption">
            Its client and the client's access are deleted; its resource is
            retired and access to it ends. This cannot be undone.
          </p>
          <q-input
            v-model="deleteConfirmName"
            outlined
            dense
            :placeholder="`Type '${appToDelete?.name}' to confirm`"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            flat
            color="negative"
            label="Delete"
            :disable="deleteConfirmName !== appToDelete?.name"
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
import { copyToClipboard, useQuasar } from "quasar";
import {
  useApplicationsStore,
  isApplicationActive,
} from "#admin/stores/applications";
import { ApplicationType } from "@structured-id/proto/sid/v1/projects/projects";
import type { Application } from "@structured-id/proto/sid/v1/projects/projects";
import {
  applicationTypeLabel,
  applicationTypeColor,
} from "#admin/composables/useEnumLabels";
import { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import { ApplicationId, ProjectId, required } from "@structured-id/ids";
import { shown } from "#admin/ids";

const store = useApplicationsStore();
const router = useRouter();
const $q = useQuasar();

const search = ref("");
const typeFilter = ref<number | null>(null);
const statusFilter = ref<boolean | null>(null);
const deleteDialog = ref(false);
const appToDelete = ref<Application | null>(null);
const deleteConfirmName = ref("");

// The console administers the installation's own project.
const projectId = ProjectId.system();

const typeOptions = [
  { label: "Web App", value: ApplicationType.WEB },
  { label: "SPA", value: ApplicationType.SPA },
  { label: "Native", value: ApplicationType.NATIVE },
  { label: "M2M / API", value: ApplicationType.API },
];

const statusOptions = [
  { label: "Active", value: true },
  { label: "Inactive", value: false },
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
    name: "roles",
    label: "Roles",
    field: (a: Application) => a.client?.type,
    align: "left" as const,
    sortable: true,
  },
  {
    name: "active",
    label: "Status",
    field: isApplicationActive,
    align: "left" as const,
    sortable: true,
  },
  {
    name: "clientId",
    label: "Client ID",
    field: (a: Application) => a.client?.clientId,
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

const filteredApps = computed(() => {
  let result = store.applications;

  if (search.value) {
    const q = search.value.toLowerCase();
    result = result.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.client?.clientId.toLowerCase().includes(q) ?? false),
    );
  }

  if (typeFilter.value !== null) {
    result = result.filter((a) => a.client?.type === typeFilter.value);
  }

  if (statusFilter.value !== null) {
    result = result.filter(
      (a) => isApplicationActive(a) === statusFilter.value,
    );
  }

  return result;
});

function onRowClick(_evt: Event, row: Application) {
  router.push({
    name: "admin-application-detail",
    params: { id: shown(row.id) },
  });
}

function confirmDelete(app: Application) {
  appToDelete.value = app;
  deleteConfirmName.value = "";
  deleteDialog.value = true;
}

async function executeDelete() {
  if (!appToDelete.value) return;
  try {
    await store.deleteApplication(
      required(ApplicationId, appToDelete.value.id),
    );
    deleteDialog.value = false;
    $q.notify({ type: "positive", message: "Application deleted" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Delete failed" });
  }
}

function formatDate(ts?: { seconds: bigint; nanos: number }): string {
  if (!ts) return "—";
  return Timestamp.toDate(ts).toLocaleDateString();
}

onMounted(() => {
  store.fetchApplications(projectId);
});
</script>
