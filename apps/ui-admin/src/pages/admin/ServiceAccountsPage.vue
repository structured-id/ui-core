<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h4">
          Service Accounts
          <q-badge
            v-if="store.machineUsers.length"
            color="primary"
            :label="store.machineUsers.length"
            class="q-ml-sm"
          />
        </div>
        <div class="text-caption text-grey">
          Machine users, service accounts, bots, and API keys
        </div>
      </div>
      <q-btn
        color="primary"
        icon="sym_o_smart_toy"
        label="New Machine User"
        no-caps
        @click="createDialog = true"
      />
    </div>

    <!-- Tabs: Machine Users / PATs -->
    <q-tabs v-model="mainTab" dense align="left" class="q-mb-lg" no-caps>
      <q-tab
        name="machine-users"
        label="Machine Users"
        icon="sym_o_smart_toy"
      />
      <q-tab name="pats" label="Personal Access Tokens" icon="sym_o_key" />
    </q-tabs>

    <q-tab-panels v-model="mainTab" animated>
      <!-- Machine Users Tab -->
      <q-tab-panel name="machine-users" class="q-pa-none">
        <!-- Filters -->
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12 col-sm-4">
            <q-input
              v-model="search"
              outlined
              dense
              placeholder="Search by name, ID, or owner..."
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
              clearable
              label="Type"
              style="min-width: 140px"
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
              clearable
              label="Status"
              style="min-width: 140px"
            />
          </div>
        </div>

        <q-linear-progress
          v-if="store.loading"
          indeterminate
          color="primary"
          class="q-mb-md"
        />

        <q-banner
          v-if="store.error"
          dense
          class="bg-negative text-white q-mb-md"
        >
          {{ store.error }}
        </q-banner>

        <q-table
          :rows="filteredMachineUsers"
          :columns="muColumns"
          row-key="id"
          flat
          bordered
          :pagination="{ rowsPerPage: 25 }"
          :loading="store.loading"
          @row-click="onMuRowClick"
          class="cursor-pointer"
        >
          <template #body-cell-displayName="props">
            <q-td :props="props">
              <div class="text-weight-medium">
                {{ props.row.displayName }}
              </div>
              <div class="text-caption text-grey">
                {{ machineUserTypeLabel(props.row.machineType) }}
              </div>
            </q-td>
          </template>

          <template #body-cell-status="props">
            <q-td :props="props">
              <q-badge
                :color="machineUserStatusColor(props.row.status)"
                :label="machineUserStatusLabel(props.row.status)"
              />
            </q-td>
          </template>

          <template #body-cell-lastUsedAt="props">
            <q-td :props="props">
              <template v-if="props.row.lastUsedAt">
                {{ formatDate(props.row.lastUsedAt) }}
              </template>
              <span v-else class="text-grey">Never</span>
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
            <div class="full-width text-center q-pa-xl">
              <q-icon name="sym_o_smart_toy" size="64px" color="grey-4" />
              <div class="text-h6 text-grey-6 q-mt-md">
                No machine users yet
              </div>
              <div class="text-body2 text-grey q-mb-lg">
                Create service accounts for backend services, bots, and
                automated workflows.
              </div>
              <q-btn
                color="primary"
                icon="sym_o_smart_toy"
                label="New Machine User"
                no-caps
                @click="createDialog = true"
              />
            </div>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- PATs Tab -->
      <q-tab-panel name="pats" class="q-pa-none">
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12 col-sm-4">
            <q-input
              v-model="patSearch"
              outlined
              dense
              placeholder="Search by name, owner, or prefix..."
              clearable
            >
              <template #prepend>
                <q-icon name="sym_o_search" />
              </template>
            </q-input>
          </div>
          <div class="col-auto">
            <q-select
              v-model="patStatusFilter"
              outlined
              dense
              :options="patStatusOptions"
              emit-value
              map-options
              clearable
              label="Status"
              style="min-width: 140px"
            />
          </div>
        </div>

        <q-linear-progress
          v-if="patStore.loading"
          indeterminate
          color="primary"
          class="q-mb-md"
        />

        <q-table
          :rows="filteredPats"
          :columns="patColumns"
          row-key="id"
          flat
          bordered
          :pagination="{ rowsPerPage: 25 }"
          :loading="patStore.loading"
        >
          <template #body-cell-name="props">
            <q-td :props="props">
              <div class="text-weight-medium">{{ props.row.name }}</div>
              <div v-if="props.row.description" class="text-caption text-grey">
                {{ props.row.description }}
              </div>
            </q-td>
          </template>

          <template #body-cell-tokenPrefix="props">
            <q-td :props="props">
              <code class="text-caption">{{ props.row.tokenPrefix }}...</code>
            </q-td>
          </template>

          <template #body-cell-profileId="props">
            <q-td :props="props">
              <code class="text-caption"
                >{{ shown(props.row.profileId).substring(0, 12) }}...</code
              >
            </q-td>
          </template>

          <template #body-cell-status="props">
            <q-td :props="props">
              <q-badge
                :color="patStatusColor(props.row.status)"
                :label="patStatusLabel(props.row.status)"
              />
            </q-td>
          </template>

          <template #body-cell-expiresAt="props">
            <q-td :props="props">
              <template v-if="props.row.expiresAt">
                {{ formatDate(props.row.expiresAt) }}
              </template>
              <span v-else class="text-grey">Never</span>
            </q-td>
          </template>

          <template #body-cell-lastUsedAt="props">
            <q-td :props="props">
              <template v-if="props.row.lastUsedAt">
                {{ formatDate(props.row.lastUsedAt) }}
              </template>
              <span v-else class="text-grey">Never</span>
            </q-td>
          </template>

          <template #body-cell-actions="props">
            <q-td :props="props" auto-width>
              <q-btn
                v-if="props.row.status === 1"
                flat
                round
                dense
                icon="sym_o_block"
                color="negative"
                @click="revokePatAction(props.row.id)"
              >
                <q-tooltip>Revoke</q-tooltip>
              </q-btn>
            </q-td>
          </template>

          <template #no-data>
            <div class="full-width text-center q-pa-xl">
              <q-icon name="sym_o_key" size="64px" color="grey-4" />
              <div class="text-h6 text-grey-6 q-mt-md">No PATs found</div>
              <div class="text-body2 text-grey">
                Users create Personal Access Tokens from their Account
                Dashboard.
              </div>
            </div>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Create Machine User Dialog -->
    <q-dialog v-model="createDialog" persistent>
      <q-card style="min-width: 550px">
        <q-card-section>
          <div class="text-h6">New Machine User</div>
        </q-card-section>

        <q-stepper v-model="createStep" animated flat>
          <!-- Step 1: Identity -->
          <q-step
            :name="1"
            title="Identity"
            icon="sym_o_badge"
            :done="createStep > 1"
          >
            <div class="q-gutter-md">
              <q-input
                v-model="createForm.displayName"
                outlined
                dense
                label="Name"
                :rules="[(v: string) => !!v || 'Name is required']"
              />
              <q-select
                v-model="createForm.machineType"
                outlined
                dense
                label="Type"
                :options="machineTypeOptions"
                emit-value
                map-options
              />
              <q-input
                v-model="createForm.description"
                outlined
                dense
                label="Description (optional)"
                type="textarea"
                autogrow
              />
            </div>
          </q-step>

          <!-- Step 2: Permissions -->
          <q-step
            :name="2"
            title="Permissions"
            icon="sym_o_shield"
            :done="createStep > 2"
          >
            <div class="q-gutter-md">
              <q-input
                v-model="scopeInput"
                outlined
                dense
                label="Scopes (comma-separated)"
                hint="e.g., openid, profile, email"
              />
              <div class="text-caption text-grey">
                Roles are assigned on the machine user's Roles tab once it
                exists.
              </div>
            </div>
          </q-step>

          <!-- Step 3: Restrictions -->
          <q-step :name="3" title="Restrictions" icon="sym_o_security">
            <div class="q-gutter-md">
              <q-input
                v-model="ipInput"
                outlined
                dense
                label="IP Allowlist (comma-separated CIDRs)"
                hint="Leave empty for unrestricted access"
              />
              <q-input
                v-model.number="createForm.rateLimitRpm"
                outlined
                dense
                label="Rate Limit (req/min)"
                type="number"
                hint="0 = site default"
              />
              <q-input
                v-model.number="createForm.maxTokenLifetime"
                outlined
                dense
                label="Max Token Lifetime (seconds)"
                type="number"
                hint="0 = default"
              />
            </div>
          </q-step>
        </q-stepper>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            v-if="createStep > 1"
            flat
            label="Back"
            @click="createStep--"
          />
          <q-btn
            v-if="createStep < 3"
            color="primary"
            label="Next"
            no-caps
            :disable="createStep === 1 && !createForm.displayName"
            @click="createStep++"
          />
          <q-btn
            v-if="createStep === 3"
            color="primary"
            label="Create"
            no-caps
            :loading="store.loading"
            :disable="!createForm.displayName"
            @click="executeCreate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Delete confirmation -->
    <q-dialog v-model="deleteDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Delete Machine User</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete
            <strong>{{ muToDelete?.displayName }}</strong>?
          </p>
          <p class="text-negative text-caption">
            All credentials and active tokens will be permanently invalidated
            after 30 days.
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
import { useMachineUsersStore } from "src/stores/machineUsers";
import { usePatsStore } from "src/stores/pats";
import type { MachineUserInfo } from "@structured-id/proto/sid/v1/machine/machine_user";
import {
  MachineUserType,
  MachineUserStatus,
} from "@structured-id/proto/sid/v1/machine/machine_user";
import { PatStatus } from "@structured-id/proto/sid/v1/machine/pat";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import {
  machineUserTypeLabel,
  machineUserStatusLabel,
  machineUserStatusColor,
  patStatusLabel,
  patStatusColor,
} from "src/composables/useEnumLabels";

import { MachineUserId, PatId, required } from "@structured-id/ids";
import { shown, type WireId } from "src/ids";

const store = useMachineUsersStore();
const patStore = usePatsStore();
const router = useRouter();
const $q = useQuasar();

const mainTab = ref("machine-users");
const search = ref("");
const typeFilter = ref<number | null>(null);
const statusFilter = ref<number | null>(null);
const patSearch = ref("");
const patStatusFilter = ref<number | null>(null);

const createDialog = ref(false);
const deleteDialog = ref(false);
const muToDelete = ref<MachineUserInfo | null>(null);
const createStep = ref(1);
const scopeInput = ref("");
const ipInput = ref("");

const createForm = ref({
  displayName: "",
  machineType: MachineUserType.SERVICE,
  description: "",
  rateLimitRpm: 0,
  maxTokenLifetime: 0,
});

const typeOptions = [
  { label: "Service", value: MachineUserType.SERVICE },
  { label: "Bot", value: MachineUserType.BOT },
  { label: "Agent", value: MachineUserType.AGENT },
];

const machineTypeOptions = [
  {
    label: "Service — backend service",
    value: MachineUserType.SERVICE,
  },
  {
    label: "Bot — automated workflow",
    value: MachineUserType.BOT,
  },
  {
    label: "Agent — AI/LLM agent",
    value: MachineUserType.AGENT,
  },
];

const statusOptions = [
  { label: "Active", value: MachineUserStatus.ACTIVE },
  {
    label: "Suspended",
    value: MachineUserStatus.SUSPENDED,
  },
  { label: "Expired", value: MachineUserStatus.EXPIRED },
];

const patStatusOptions = [
  { label: "Active", value: PatStatus.ACTIVE },
  { label: "Revoked", value: PatStatus.REVOKED },
  { label: "Expired", value: PatStatus.EXPIRED },
];

const muColumns = [
  {
    name: "displayName",
    label: "Name",
    field: "displayName",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "clientId",
    label: "Client ID",
    field: "clientId",
    align: "left" as const,
  },
  {
    name: "status",
    label: "Status",
    field: "status",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "rateLimitRpm",
    label: "Rate Limit",
    field: (row: MachineUserInfo) =>
      row.rateLimitRpm ? `${row.rateLimitRpm} req/min` : "default",
    align: "left" as const,
  },
  {
    name: "lastUsedAt",
    label: "Last Used",
    field: "lastUsedAt",
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

const patColumns = [
  {
    name: "name",
    label: "Name",
    field: "name",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "tokenPrefix",
    label: "Prefix",
    field: "tokenPrefix",
    align: "left" as const,
  },
  {
    name: "profileId",
    label: "Owner",
    field: "profileId",
    align: "left" as const,
  },
  {
    name: "status",
    label: "Status",
    field: "status",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "expiresAt",
    label: "Expires",
    field: "expiresAt",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "lastUsedAt",
    label: "Last Used",
    field: "lastUsedAt",
    align: "left" as const,
    sortable: true,
  },
  { name: "actions", label: "", field: "id" },
];

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  return new Date(Number(ts.seconds) * 1000).toLocaleDateString();
}

function splitInput(val: string): string[] {
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const filteredMachineUsers = computed(() => {
  let result = store.machineUsers;
  if (typeFilter.value !== null) {
    result = result.filter((m) => m.machineType === typeFilter.value);
  }
  if (statusFilter.value !== null) {
    result = result.filter((m) => m.status === statusFilter.value);
  }
  if (search.value) {
    const q = search.value.toLowerCase();
    result = result.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        shown(m.id).includes(q) ||
        m.clientId.toLowerCase().includes(q),
    );
  }
  return result;
});

const filteredPats = computed(() => {
  let result = patStore.pats;
  if (patStatusFilter.value !== null) {
    result = result.filter((p) => p.status === patStatusFilter.value);
  }
  if (patSearch.value) {
    const q = patSearch.value.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        shown(p.profileId).includes(q) ||
        p.tokenPrefix.toLowerCase().includes(q),
    );
  }
  return result;
});

function onMuRowClick(_evt: Event, row: MachineUserInfo) {
  router.push({
    name: "admin-service-account-detail",
    params: { machineUserId: shown(row.id) },
  });
}

function confirmDelete(mu: MachineUserInfo) {
  muToDelete.value = mu;
  deleteDialog.value = true;
}

async function executeDelete() {
  if (!muToDelete.value) return;
  try {
    await store.deleteMachineUser(required(MachineUserId, muToDelete.value.id));
    deleteDialog.value = false;
    $q.notify({ type: "positive", message: "Machine user deleted" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Delete failed" });
  }
}

async function executeCreate() {
  try {
    await store.createMachineUser({
      displayName: createForm.value.displayName,
      description: createForm.value.description,
      machineType: createForm.value.machineType,
      scopes: splitInput(scopeInput.value),
      ipAllowlist: splitInput(ipInput.value),
      rateLimitRpm: createForm.value.rateLimitRpm,
      maxTokenLifetime: createForm.value.maxTokenLifetime,
    });
    createDialog.value = false;
    createStep.value = 1;
    createForm.value = {
      displayName: "",
      machineType: MachineUserType.SERVICE,
      description: "",
      rateLimitRpm: 0,
      maxTokenLifetime: 0,
    };
    scopeInput.value = "";
    ipInput.value = "";
    $q.notify({ type: "positive", message: "Machine user created" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Create failed" });
  }
}

async function revokePatAction(patId: WireId | undefined) {
  try {
    await patStore.revokePat(required(PatId, patId));
    $q.notify({ type: "positive", message: "PAT revoked" });
  } catch {
    $q.notify({
      type: "negative",
      message: patStore.error || "Revoke failed",
    });
  }
}

onMounted(() => {
  store.fetchMachineUsers();
  patStore.fetchAllPats();
});
</script>
