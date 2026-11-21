<template>
  <q-page padding>
    <!-- Header -->
    <div class="row items-center q-mb-lg">
      <q-btn
        flat
        round
        icon="sym_o_arrow_back"
        :to="{ name: 'admin-identity-providers' }"
      />
      <div class="col q-ml-sm">
        <div class="text-h5">
          {{ store.currentProvider?.name || "Provider" }}
          <q-badge
            v-if="store.currentProvider"
            :color="store.currentProvider.enabled ? 'positive' : 'grey'"
            :label="store.currentProvider.enabled ? 'Enabled' : 'Disabled'"
            class="q-ml-sm"
          />
        </div>
        <div class="text-caption text-grey">
          {{ upstreamProtocolLabel(store.currentProvider?.protocol) }}
          &middot;
          {{ trustCategoryLabel(store.currentProvider?.trustCategory) }}
        </div>
      </div>
      <q-btn
        v-if="store.currentProvider && !store.currentProvider.enabled"
        outline
        color="positive"
        label="Enable"
        no-caps
        @click="toggleEnabled(true)"
      />
      <q-btn
        v-if="store.currentProvider?.enabled"
        outline
        color="warning"
        label="Disable"
        no-caps
        @click="toggleEnabled(false)"
      />
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
      <q-tab name="general" label="General" icon="sym_o_settings" />
      <q-tab name="endpoints" label="Endpoints" icon="sym_o_link" />
      <q-tab name="display" label="Display" icon="sym_o_palette" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <!-- General Tab -->
      <q-tab-panel name="general">
        <div
          v-if="store.currentProvider"
          class="q-gutter-md"
          style="max-width: 600px"
        >
          <q-input v-model="form.name" outlined label="Provider Name" dense />
          <q-select
            v-model="form.protocol"
            outlined
            dense
            label="Protocol"
            :options="protocolOptions"
            emit-value
            map-options
          />
          <q-select
            v-model="form.trustCategory"
            outlined
            dense
            label="Trust Category"
            :options="trustOptions"
            emit-value
            map-options
          />
          <q-input v-model="form.clientId" outlined label="Client ID" dense />
          <q-input
            v-model="form.clientSecret"
            outlined
            label="Client Secret"
            dense
            type="password"
            hint="Leave empty to keep current value"
          />
          <q-input
            v-model="form.scopes"
            outlined
            label="Scopes (space-separated)"
            dense
          />

          <q-btn
            color="primary"
            label="Save Changes"
            no-caps
            :loading="store.loading"
            @click="saveGeneral"
          />

          <!-- Danger Zone -->
          <q-separator class="q-my-lg" />
          <div class="text-subtitle1 text-negative">Danger Zone</div>
          <q-card flat bordered class="q-pa-md">
            <div class="row items-center justify-between">
              <div>
                <div class="text-subtitle2">Delete this provider</div>
                <div class="text-caption text-grey">
                  Users linked to this provider will lose their external
                  identity.
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

      <!-- Endpoints Tab -->
      <q-tab-panel name="endpoints">
        <div
          v-if="store.currentProvider"
          class="q-gutter-md"
          style="max-width: 600px"
        >
          <q-input
            v-model="form.discoveryUrl"
            outlined
            label="Discovery URL"
            dense
            hint="OIDC .well-known/openid-configuration URL"
          />
          <q-input
            v-model="form.authorizationEndpoint"
            outlined
            label="Authorization Endpoint"
            dense
          />
          <q-input
            v-model="form.tokenEndpoint"
            outlined
            label="Token Endpoint"
            dense
          />
          <q-input
            v-model="form.userinfoEndpoint"
            outlined
            label="Userinfo Endpoint"
            dense
          />

          <q-btn
            color="primary"
            label="Save Endpoints"
            no-caps
            :loading="store.loading"
            @click="saveEndpoints"
          />
        </div>
      </q-tab-panel>

      <!-- Display Tab -->
      <q-tab-panel name="display">
        <div
          v-if="store.currentProvider"
          class="q-gutter-md"
          style="max-width: 600px"
        >
          <q-toggle v-model="form.showOnLogin" label="Show on login screen" />
          <q-input
            v-model.number="form.displayOrder"
            outlined
            label="Display Order"
            dense
            type="number"
            hint="Lower number = shown first"
          />
          <q-input
            v-model="form.logoUrl"
            outlined
            label="Logo URL"
            dense
            hint="Square image recommended (48x48px minimum)"
          />
          <div v-if="form.logoUrl" class="q-mt-sm">
            <div class="text-caption text-grey q-mb-xs">Preview:</div>
            <q-avatar size="48px">
              <img :src="form.logoUrl" />
            </q-avatar>
          </div>

          <q-btn
            color="primary"
            label="Save Display Settings"
            no-caps
            :loading="store.loading"
            @click="saveDisplay"
          />
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Delete confirmation -->
    <q-dialog v-model="deleteDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Delete Provider</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete
            <strong>{{ store.currentProvider?.name }}</strong>?
          </p>
          <p class="text-negative text-caption">
            Users linked to this provider will lose their external identity.
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
import { ref, reactive, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuasar } from "quasar";
import { useUpstreamProvidersStore } from "src/stores/upstreamProviders";
import {
  UpstreamProtocol,
  TrustCategory,
} from "@structured-id/proto/sid/v1/federation/upstream";
import {
  upstreamProtocolLabel,
  trustCategoryLabel,
} from "src/composables/useEnumLabels";

const store = useUpstreamProvidersStore();
const route = useRoute();
const router = useRouter();
const $q = useQuasar();

const tab = ref("general");
const deleteDialog = ref(false);

const form = reactive({
  name: "",
  protocol: UpstreamProtocol.OIDC as number,
  trustCategory: TrustCategory.SOCIAL as number,
  clientId: "",
  clientSecret: "",
  discoveryUrl: "",
  authorizationEndpoint: "",
  tokenEndpoint: "",
  userinfoEndpoint: "",
  scopes: "",
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

function populateForm() {
  const p = store.currentProvider;
  if (!p) return;
  form.name = p.name;
  form.protocol = p.protocol;
  form.trustCategory = p.trustCategory;
  form.clientId = p.clientId;
  form.clientSecret = "";
  form.discoveryUrl = p.discoveryUrl;
  form.authorizationEndpoint = p.authorizationEndpoint;
  form.tokenEndpoint = p.tokenEndpoint;
  form.userinfoEndpoint = p.userinfoEndpoint;
  form.scopes = p.scopes.join(" ");
  form.showOnLogin = p.showOnLogin;
  form.displayOrder = p.displayOrder;
  form.logoUrl = p.logoUrl;
}

watch(() => store.currentProvider, populateForm, { immediate: true });

async function saveGeneral() {
  if (!store.currentProvider) return;
  try {
    await store.updateProvider(store.currentProvider.id, {
      name: form.name,
      protocol: form.protocol,
      trustCategory: form.trustCategory,
      clientId: form.clientId,
      clientSecret: form.clientSecret || undefined,
      scopes: form.scopes.split(/\s+/).filter(Boolean),
    });
    $q.notify({ type: "positive", message: "Provider updated" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Update failed" });
  }
}

async function saveEndpoints() {
  if (!store.currentProvider) return;
  try {
    await store.updateProvider(store.currentProvider.id, {
      discoveryUrl: form.discoveryUrl,
      authorizationEndpoint: form.authorizationEndpoint,
      tokenEndpoint: form.tokenEndpoint,
      userinfoEndpoint: form.userinfoEndpoint,
      scopes: store.currentProvider.scopes,
    });
    $q.notify({ type: "positive", message: "Endpoints updated" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Update failed" });
  }
}

async function saveDisplay() {
  if (!store.currentProvider) return;
  try {
    await store.updateProvider(store.currentProvider.id, {
      showOnLogin: form.showOnLogin,
      displayOrder: form.displayOrder,
      logoUrl: form.logoUrl,
      scopes: store.currentProvider.scopes,
    });
    $q.notify({ type: "positive", message: "Display settings updated" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Update failed" });
  }
}

async function toggleEnabled(enabled: boolean) {
  if (!store.currentProvider) return;
  try {
    await store.updateProvider(store.currentProvider.id, {
      enabled,
      scopes: store.currentProvider.scopes,
    });
    $q.notify({
      type: "positive",
      message: enabled ? "Provider enabled" : "Provider disabled",
    });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Update failed" });
  }
}

function confirmDelete() {
  deleteDialog.value = true;
}

async function executeDelete() {
  if (!store.currentProvider) return;
  try {
    await store.deleteProvider(store.currentProvider.id);
    deleteDialog.value = false;
    $q.notify({ type: "positive", message: "Provider deleted" });
    router.push({ name: "admin-identity-providers" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Delete failed" });
  }
}

onMounted(async () => {
  const providerId = route.params.providerId as string;
  if (providerId) {
    await store.getProvider(providerId);
  }
});
</script>
