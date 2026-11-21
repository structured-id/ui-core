<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h4">
          Authentication Flows
          <q-badge
            v-if="store.flows.length"
            color="primary"
            :label="store.flows.length"
            class="q-ml-sm"
          />
        </div>
        <div class="text-body2 text-grey-7 q-mt-xs">
          Configure authentication pipelines for login, registration, and
          credential recovery
        </div>
      </div>
      <div class="q-gutter-sm">
        <q-btn
          outline
          color="primary"
          icon="sym_o_upload"
          label="Import"
          no-caps
          @click="showImportDialog = true"
        />
        <q-btn
          color="primary"
          icon="sym_o_add"
          label="Create Flow"
          no-caps
          @click="showCreateDialog = true"
        />
      </div>
    </div>

    <!-- Purpose filter tabs -->
    <q-tabs
      v-model="purposeFilter"
      dense
      align="left"
      active-color="primary"
      indicator-color="primary"
      class="q-mb-md"
      no-caps
    >
      <q-tab name="all" label="All" />
      <q-tab
        v-for="p in purposeOptions"
        :key="p.value"
        :name="String(p.value)"
        :label="p.label"
      />
    </q-tabs>

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

    <!-- Flows table -->
    <q-table
      :rows="filteredFlows"
      :columns="columns"
      row-key="id"
      flat
      bordered
      :pagination="{ rowsPerPage: 20 }"
    >
      <template #body-cell-name="props">
        <q-td :props="props">
          <router-link
            :to="{
              name: 'admin-flow-detail',
              params: { flowId: props.row.id },
            }"
            class="text-primary text-weight-medium"
            style="text-decoration: none"
          >
            {{ props.row.name }}
          </router-link>
          <q-badge
            v-if="props.row.builtIn"
            color="blue-grey"
            label="Built-in"
            class="q-ml-sm"
          />
        </q-td>
      </template>

      <template #body-cell-purpose="props">
        <q-td :props="props">
          <q-badge
            :color="flowPurposeColor(props.row.purpose)"
            :label="flowPurposeLabel(props.row.purpose)"
          />
        </q-td>
      </template>

      <template #body-cell-bound="props">
        <q-td :props="props">
          <q-icon
            v-if="props.row.bound"
            name="sym_o_check_circle"
            color="positive"
            size="sm"
          >
            <q-tooltip>Active binding</q-tooltip>
          </q-icon>
          <q-icon v-else name="sym_o_circle" color="grey-4" size="sm">
            <q-tooltip>Not bound</q-tooltip>
          </q-icon>
        </q-td>
      </template>

      <template #body-cell-actions="props">
        <q-td :props="props" auto-width>
          <q-btn flat round dense icon="sym_o_more_vert" size="sm">
            <q-menu>
              <q-list dense style="min-width: 180px">
                <q-item clickable v-close-popup @click="handleBind(props.row)">
                  <q-item-section avatar>
                    <q-icon name="sym_o_link" size="xs" />
                  </q-item-section>
                  <q-item-section>Bind as Active</q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  @click="handleDuplicate(props.row)"
                >
                  <q-item-section avatar>
                    <q-icon name="sym_o_content_copy" size="xs" />
                  </q-item-section>
                  <q-item-section>Duplicate</q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  @click="handleExport(props.row)"
                >
                  <q-item-section avatar>
                    <q-icon name="sym_o_download" size="xs" />
                  </q-item-section>
                  <q-item-section>Export Blueprint</q-item-section>
                </q-item>
                <q-separator v-if="!props.row.builtIn" />
                <q-item
                  v-if="!props.row.builtIn"
                  clickable
                  v-close-popup
                  class="text-negative"
                  @click="handleDelete(props.row)"
                >
                  <q-item-section avatar>
                    <q-icon name="sym_o_delete" size="xs" />
                  </q-item-section>
                  <q-item-section>Delete</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- Create Flow Dialog -->
    <q-dialog v-model="showCreateDialog" persistent>
      <q-card style="min-width: 420px">
        <q-card-section>
          <div class="text-h6">Create Flow</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="createForm.name"
            outlined
            dense
            label="Name"
            class="q-mb-md"
          />
          <q-input
            v-model="createForm.description"
            outlined
            dense
            label="Description"
            type="textarea"
            rows="2"
            class="q-mb-md"
          />
          <q-select
            v-model="createForm.purpose"
            outlined
            dense
            :options="purposeOptions"
            emit-value
            map-options
            label="Purpose"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Create"
            no-caps
            :loading="store.loading"
            @click="submitCreate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Import Blueprint Dialog -->
    <q-dialog v-model="showImportDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Import Blueprint</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="importForm.name"
            outlined
            dense
            label="Flow Name"
            class="q-mb-md"
          />
          <q-input
            v-model="importForm.yaml"
            outlined
            dense
            label="YAML Blueprint"
            type="textarea"
            rows="10"
            class="font-mono"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Import"
            no-caps
            :loading="store.loading"
            @click="submitImport"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Duplicate Dialog -->
    <q-dialog v-model="showDuplicateDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Duplicate Flow</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="duplicateName" outlined dense label="New Name" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Duplicate"
            no-caps
            :loading="store.loading"
            @click="submitDuplicate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useFlowsStore } from "#admin/stores/flows";
import { FlowPurpose } from "@structured-id/proto/sid/v1/authn/flows";
import type { Flow } from "@structured-id/proto/sid/v1/authn/flows";
import {
  flowPurposeLabel,
  flowPurposeColor,
} from "#admin/composables/useEnumLabels";
import type { QTableColumn } from "quasar";

const store = useFlowsStore();

const purposeFilter = ref("all");
const showCreateDialog = ref(false);
const showImportDialog = ref(false);
const showDuplicateDialog = ref(false);
const duplicateFlowId = ref("");
const duplicateName = ref("");

const createForm = ref({
  name: "",
  description: "",
  purpose: FlowPurpose.LOGIN,
});

const importForm = ref({
  name: "",
  yaml: "",
});

const purposeOptions = [
  { label: "Login", value: FlowPurpose.LOGIN },
  { label: "Registration", value: FlowPurpose.REGISTRATION },
  { label: "Reset Credentials", value: FlowPurpose.RESET_CREDENTIALS },
  { label: "First Broker Login", value: FlowPurpose.FIRST_BROKER_LOGIN },
  { label: "Post Broker Login", value: FlowPurpose.POST_BROKER_LOGIN },
  { label: "Docker Auth", value: FlowPurpose.DOCKER_AUTH },
];

const columns: QTableColumn[] = [
  {
    name: "name",
    label: "Name",
    field: "name",
    align: "left",
    sortable: true,
  },
  {
    name: "purpose",
    label: "Purpose",
    field: "purpose",
    align: "left",
    sortable: true,
  },
  {
    name: "stepCount",
    label: "Steps",
    field: "stepCount",
    align: "center",
    sortable: true,
  },
  {
    name: "bound",
    label: "Active",
    field: "bound",
    align: "center",
    sortable: true,
  },
  {
    name: "actions",
    label: "",
    field: "id",
    align: "right",
  },
];

const filteredFlows = computed(() => {
  if (purposeFilter.value === "all") return store.flows;
  const p = Number(purposeFilter.value);
  return store.flows.filter((f) => f.purpose === p);
});

onMounted(() => {
  store.fetchFlows();
});

async function submitCreate() {
  try {
    await store.createFlow(createForm.value);
    showCreateDialog.value = false;
    createForm.value = {
      name: "",
      description: "",
      purpose: FlowPurpose.LOGIN,
    };
  } catch {
    // error shown via store.error
  }
}

async function submitImport() {
  try {
    await store.importBlueprint(importForm.value.yaml, importForm.value.name);
    showImportDialog.value = false;
    importForm.value = { name: "", yaml: "" };
  } catch {
    // error shown via store.error
  }
}

function handleDuplicate(flow: Flow) {
  duplicateFlowId.value = flow.id;
  duplicateName.value = flow.name + " (copy)";
  showDuplicateDialog.value = true;
}

async function submitDuplicate() {
  try {
    await store.duplicateFlow(duplicateFlowId.value, duplicateName.value);
    showDuplicateDialog.value = false;
  } catch {
    // error shown via store.error
  }
}

async function handleBind(flow: Flow) {
  try {
    await store.bindFlow(flow.id, flow.purpose);
  } catch {
    // error shown via store.error
  }
}

async function handleExport(flow: Flow) {
  try {
    const yaml = await store.exportBlueprint(flow.id);
    const blob = new Blob([yaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flow.name.toLowerCase().replace(/\s+/g, "-")}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // error shown via store.error
  }
}

async function handleDelete(flow: Flow) {
  try {
    await store.deleteFlow(flow.id);
  } catch {
    // error shown via store.error
  }
}
</script>
