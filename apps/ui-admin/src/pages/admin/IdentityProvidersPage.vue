<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h4">
          Identity Providers
          <q-badge
            v-if="store.providers.length"
            color="primary"
            :label="store.providers.length"
            class="q-ml-sm"
          />
        </div>
        <div class="text-caption text-grey">
          Upstream identity providers for social and enterprise login
        </div>
      </div>
      <q-btn
        color="primary"
        icon="sym_o_add"
        label="Add Provider"
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
      <div class="col-auto">
        <q-select
          v-model="protocolFilter"
          outlined
          dense
          :options="protocolOptions"
          emit-value
          map-options
          clearable
          label="Protocol"
          style="min-width: 140px"
        />
      </div>
      <div class="col-auto">
        <q-select
          v-model="trustFilter"
          outlined
          dense
          :options="trustOptions"
          emit-value
          map-options
          clearable
          label="Category"
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

    <q-banner v-if="store.error" dense class="bg-negative text-white q-mb-md">
      {{ store.error }}
    </q-banner>

    <q-table
      :rows="filteredProviders"
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
          <div class="row items-center no-wrap">
            <q-avatar v-if="props.row.logoUrl" size="24px" class="q-mr-sm">
              <img :src="props.row.logoUrl" />
            </q-avatar>
            <q-icon
              v-else
              name="sym_o_login"
              size="24px"
              class="q-mr-sm text-grey"
            />
            <div>
              <div class="text-weight-medium">{{ props.row.name }}</div>
            </div>
          </div>
        </q-td>
      </template>

      <template #body-cell-protocol="props">
        <q-td :props="props">
          <q-badge
            :color="props.row.protocol === 1 ? 'primary' : 'teal'"
            :label="upstreamProtocolLabel(props.row.protocol)"
          />
        </q-td>
      </template>

      <template #body-cell-trustCategory="props">
        <q-td :props="props">
          <q-badge
            outline
            :color="trustCategoryColor(props.row.trustCategory)"
            :label="trustCategoryLabel(props.row.trustCategory)"
          />
        </q-td>
      </template>

      <template #body-cell-enabled="props">
        <q-td :props="props">
          <q-icon
            :name="props.row.enabled ? 'sym_o_check_circle' : 'sym_o_cancel'"
            :color="props.row.enabled ? 'positive' : 'grey'"
            size="sm"
          />
        </q-td>
      </template>

      <template #body-cell-showOnLogin="props">
        <q-td :props="props">
          <q-icon
            :name="
              props.row.showOnLogin
                ? 'sym_o_visibility'
                : 'sym_o_visibility_off'
            "
            :color="props.row.showOnLogin ? 'primary' : 'grey'"
            size="sm"
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
        <div v-if="!store.error" class="full-width text-center q-pa-xl">
          <q-icon name="sym_o_login" size="64px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-md">
            No identity providers configured
          </div>
          <div class="text-body2 text-grey q-mb-lg">
            Add upstream providers to enable social and enterprise login.
          </div>
          <q-btn
            color="primary"
            icon="sym_o_add"
            label="Add Provider"
            no-caps
            @click="createDialog = true"
          />
        </div>
      </template>
    </q-table>

    <!-- Create Provider Dialog -->
    <q-dialog v-model="createDialog" persistent>
      <q-card style="min-width: 550px">
        <q-card-section>
          <div class="text-h6">Add Identity Provider</div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="createForm.name"
            outlined
            dense
            label="Provider Name"
            :rules="[(v: string) => !!v || 'Required']"
          />
          <q-select
            v-model="createForm.protocol"
            outlined
            dense
            label="Protocol"
            :options="protocolOptions"
            emit-value
            map-options
          />
          <q-select
            v-model="createForm.trustCategory"
            outlined
            dense
            label="Trust Category"
            :options="trustOptions"
            emit-value
            map-options
          />

          <q-separator />
          <div class="text-subtitle2">OAuth2 / OIDC Configuration</div>

          <q-input
            v-model="createForm.clientId"
            outlined
            dense
            label="Client ID"
          />
          <q-input
            v-model="createForm.clientSecret"
            outlined
            dense
            label="Client Secret"
            type="password"
          />
          <q-input
            v-model="createForm.discoveryUrl"
            outlined
            dense
            label="Discovery URL"
            hint="OIDC well-known endpoint (auto-configures endpoints)"
          />

          <q-expansion-item label="Manual Endpoint Configuration" dense>
            <div class="q-gutter-sm q-pa-sm">
              <q-input
                v-model="createForm.authorizationEndpoint"
                outlined
                dense
                label="Authorization Endpoint"
              />
              <q-input
                v-model="createForm.tokenEndpoint"
                outlined
                dense
                label="Token Endpoint"
              />
              <q-input
                v-model="createForm.userinfoEndpoint"
                outlined
                dense
                label="Userinfo Endpoint"
              />
            </div>
          </q-expansion-item>

          <q-input
            v-model="createForm.scopes"
            outlined
            dense
            label="Scopes (space-separated)"
            hint="e.g., openid profile email"
          />

          <q-separator />
          <div class="text-subtitle2">Display</div>

          <q-toggle
            v-model="createForm.showOnLogin"
            label="Show on login screen"
          />
          <q-input
            v-model="createForm.logoUrl"
            outlined
            dense
            label="Logo URL (optional)"
          />
          <q-input
            v-model.number="createForm.displayOrder"
            outlined
            dense
            label="Display Order"
            type="number"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Create"
            no-caps
            :loading="store.loading"
            :disable="!createForm.name || !createForm.clientId"
            @click="executeCreate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Delete confirmation -->
    <q-dialog v-model="deleteDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Delete Provider</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete
            <strong>{{ providerToDelete?.name }}</strong>?
          </p>
          <p class="text-negative text-caption">
            Users who signed in with this provider will lose their linked
            identity.
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
import { useUpstreamProvidersStore } from "#admin/stores/upstreamProviders";
import type { UpstreamProvider } from "@structured-id/proto/sid/v1/federation/upstream";
import {
  UpstreamProtocol,
  TrustCategory,
} from "@structured-id/proto/sid/v1/federation/upstream";
import {
  upstreamProtocolLabel,
  trustCategoryLabel,
  trustCategoryColor,
} from "#admin/composables/useEnumLabels";

import { UpstreamProviderId, required } from "@structured-id/ids";
import { shown } from "#admin/ids";

const store = useUpstreamProvidersStore();
const router = useRouter();
const $q = useQuasar();

const search = ref("");
const protocolFilter = ref<number | null>(null);
const trustFilter = ref<number | null>(null);
const createDialog = ref(false);
const deleteDialog = ref(false);
const providerToDelete = ref<UpstreamProvider | null>(null);

const createForm = ref({
  name: "",
  protocol: UpstreamProtocol.OIDC,
  trustCategory: TrustCategory.SOCIAL,
  clientId: "",
  clientSecret: "",
  discoveryUrl: "",
  authorizationEndpoint: "",
  tokenEndpoint: "",
  userinfoEndpoint: "",
  scopes: "openid profile email",
  showOnLogin: true,
  displayOrder: 0,
  logoUrl: "",
});

const protocolOptions = [
  { label: "OIDC", value: UpstreamProtocol.OIDC },
  { label: "OAuth2", value: UpstreamProtocol.OAUTH2 },
];

const trustOptions = [
  { label: "Social", value: TrustCategory.SOCIAL },
  { label: "Corporate", value: TrustCategory.CORPORATE },
  { label: "Government", value: TrustCategory.GOVERNMENT },
  { label: "Financial", value: TrustCategory.FINANCIAL },
];

const columns = [
  {
    name: "name",
    label: "Provider",
    field: "name",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "protocol",
    label: "Protocol",
    field: "protocol",
    align: "left" as const,
  },
  {
    name: "trustCategory",
    label: "Category",
    field: "trustCategory",
    align: "left" as const,
  },
  {
    name: "enabled",
    label: "Enabled",
    field: "enabled",
    align: "center" as const,
  },
  {
    name: "showOnLogin",
    label: "Login Screen",
    field: "showOnLogin",
    align: "center" as const,
  },
  { name: "actions", label: "", field: "id" },
];

const filteredProviders = computed(() => {
  let result = store.providers;
  if (protocolFilter.value !== null) {
    result = result.filter((p) => p.protocol === protocolFilter.value);
  }
  if (trustFilter.value !== null) {
    result = result.filter((p) => p.trustCategory === trustFilter.value);
  }
  if (search.value) {
    const q = search.value.toLowerCase();
    result = result.filter((p) => p.name.toLowerCase().includes(q));
  }
  return result;
});

function onRowClick(_evt: Event, row: UpstreamProvider) {
  router.push({
    name: "admin-identity-provider-detail",
    params: { providerId: shown(row.id) },
  });
}

function confirmDelete(provider: UpstreamProvider) {
  providerToDelete.value = provider;
  deleteDialog.value = true;
}

async function executeDelete() {
  if (!providerToDelete.value) return;
  try {
    await store.deleteProvider(
      required(UpstreamProviderId, providerToDelete.value.id),
    );
    deleteDialog.value = false;
    $q.notify({ type: "positive", message: "Provider deleted" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Delete failed" });
  }
}

async function executeCreate() {
  try {
    await store.createProvider({
      name: createForm.value.name,
      protocol: createForm.value.protocol,
      trustCategory: createForm.value.trustCategory,
      clientId: createForm.value.clientId,
      clientSecret: createForm.value.clientSecret,
      discoveryUrl: createForm.value.discoveryUrl,
      authorizationEndpoint: createForm.value.authorizationEndpoint,
      tokenEndpoint: createForm.value.tokenEndpoint,
      userinfoEndpoint: createForm.value.userinfoEndpoint,
      scopes: createForm.value.scopes.split(/\s+/).filter(Boolean),
      showOnLogin: createForm.value.showOnLogin,
      displayOrder: createForm.value.displayOrder,
      logoUrl: createForm.value.logoUrl,
    });
    createDialog.value = false;
    createForm.value = {
      name: "",
      protocol: UpstreamProtocol.OIDC,
      trustCategory: TrustCategory.SOCIAL,
      clientId: "",
      clientSecret: "",
      discoveryUrl: "",
      authorizationEndpoint: "",
      tokenEndpoint: "",
      userinfoEndpoint: "",
      scopes: "openid profile email",
      showOnLogin: true,
      displayOrder: 0,
      logoUrl: "",
    };
    $q.notify({ type: "positive", message: "Provider created" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Create failed" });
  }
}

onMounted(() => {
  store.fetchProviders();
});
</script>
