<template>
  <q-page padding>
    <!-- Header -->
    <div class="row items-center q-mb-lg">
      <q-btn
        flat
        round
        icon="sym_o_arrow_back"
        :to="{ name: 'admin-applications' }"
      />
      <div class="col q-ml-sm">
        <div class="row items-center q-gutter-sm">
          <div class="text-h5">
            {{ store.currentApp?.name || "Application" }}
          </div>
          <q-badge
            v-if="client"
            :color="applicationTypeColor(client.type)"
            :label="applicationTypeLabel(client.type)"
          />
          <q-badge v-if="resource" color="teal" label="Resource" />
          <q-badge
            v-if="store.currentApp"
            :color="isApplicationActive(store.currentApp) ? 'positive' : 'grey'"
            :label="
              isApplicationActive(store.currentApp) ? 'Active' : 'Inactive'
            "
          />
          <q-badge
            v-if="client?.dynamicallyRegistered"
            color="info"
            label="DCR"
          />
          <q-badge v-if="isSystem" color="grey-7" label="Managed by SID" />
        </div>
        <div v-if="store.currentApp" class="text-caption text-grey">
          <template v-if="client">
            Client ID: {{ client.clientId }}
            <q-btn
              flat
              round
              dense
              size="xs"
              icon="sym_o_content_copy"
              @click="copyToClipboard(client.clientId)"
            />
          </template>
          <template v-if="store.currentApp.createdAt">
            · Created {{ formatDate(store.currentApp.createdAt) }}
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
      <q-tab name="general" label="General" icon="sym_o_info" />
      <template v-if="client">
        <q-tab name="protocol" label="Protocol" icon="sym_o_settings" />
        <q-tab name="credentials" label="Credentials" icon="sym_o_key" />
        <q-tab name="scopes" label="Scopes & Claims" icon="sym_o_badge" />
        <q-tab
          name="device-auth"
          label="Device Auth"
          icon="sym_o_devices_other"
        />
      </template>
      <q-tab
        v-if="resource"
        name="resource"
        label="Resource"
        icon="sym_o_api"
      />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <!-- General Tab -->
      <q-tab-panel name="general">
        <div
          v-if="store.currentApp"
          class="q-gutter-md"
          style="max-width: 600px"
        >
          <q-banner v-if="isSystem" dense class="bg-grey-2 text-dark" rounded>
            SID provisions and keeps this integration: only its client's
            activity can be changed here.
          </q-banner>
          <q-input
            v-model="generalForm.name"
            outlined
            label="Application name"
            :readonly="isSystem"
            :rules="[(v: string) => !!v || 'Name is required']"
          />
          <template v-if="client">
            <div class="text-subtitle2">Client status</div>
            <q-toggle
              :model-value="client.active"
              :label="client.active ? 'Active' : 'Inactive'"
              color="positive"
              @update:model-value="toggleStatus"
            />
          </template>

          <q-btn
            v-if="!isSystem"
            color="primary"
            label="Save Changes"
            no-caps
            :loading="store.loading"
            :disable="!generalFormChanged"
            @click="saveGeneral"
          />

          <!-- Danger Zone -->
          <template v-if="!isSystem">
            <q-separator class="q-my-lg" />
            <div class="text-subtitle1 text-negative">Danger Zone</div>
            <q-card flat bordered class="q-pa-md">
              <div class="row items-center justify-between">
                <div>
                  <div class="text-subtitle2">Delete this application</div>
                  <div class="text-caption text-grey">
                    Its client and the client's access are deleted; its resource
                    is retired and access to it ends.
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
          </template>
        </div>
      </q-tab-panel>

      <!-- Protocol Tab -->
      <q-tab-panel name="protocol">
        <div v-if="client" class="q-gutter-md" style="max-width: 600px">
          <!-- Redirect URIs (not for M2M) -->
          <template v-if="client.type !== ApplicationType.API">
            <div class="text-subtitle2">Redirect URIs</div>
            <div
              v-for="(uri, i) in protocolForm.redirectUris"
              :key="i"
              class="row items-center q-gutter-sm"
            >
              <q-input
                v-model="protocolForm.redirectUris[i]"
                outlined
                dense
                class="col"
                placeholder="https://app.example.com/callback"
              />
              <q-btn
                flat
                round
                dense
                icon="sym_o_close"
                @click="protocolForm.redirectUris.splice(i, 1)"
              />
            </div>
            <q-btn
              flat
              dense
              icon="sym_o_add"
              label="Add URI"
              no-caps
              @click="protocolForm.redirectUris.push('')"
            />
          </template>

          <!-- Grant Types -->
          <div class="text-subtitle2 q-mt-md">Grant Types</div>
          <div class="q-gutter-sm">
            <q-checkbox
              v-for="gt in grantTypeOptions"
              :key="gt.value"
              v-model="protocolForm.grantTypes"
              :val="gt.value"
              :label="gt.label"
            />
          </div>

          <!-- Allowed Scopes -->
          <div class="text-subtitle2 q-mt-md">Allowed Scopes</div>
          <div class="q-gutter-sm">
            <q-checkbox
              v-for="scope in scopeOptions"
              :key="scope"
              v-model="protocolForm.allowedScopes"
              :val="scope"
              :label="scope"
            />
          </div>

          <!-- Issuer (read-only, assigned at registration) -->
          <div class="text-subtitle2 q-mt-md">Issuer</div>
          <q-input
            :model-value="client.issuer"
            outlined
            dense
            readonly
            hint="The relying party configures this issuer verbatim"
          >
            <template #append>
              <q-btn
                flat
                round
                dense
                icon="sym_o_content_copy"
                @click="copyToClipboard(client.issuer)"
              />
            </template>
          </q-input>

          <!-- Response Types (read-only) -->
          <template v-if="client.responseTypes.length">
            <div class="text-subtitle2 q-mt-md">Response Types</div>
            <div class="q-gutter-xs">
              <q-badge
                v-for="rt in client.responseTypes"
                :key="rt"
                color="grey-3"
                text-color="grey-8"
                :label="rt"
              />
            </div>
          </template>

          <!-- Token Auth Method (read-only) -->
          <div class="text-subtitle2 q-mt-md">Token Endpoint Auth Method</div>
          <q-input
            :model-value="tokenAuthMethodLabel(client.tokenEndpointAuthMethod)"
            outlined
            dense
            readonly
            hint="Set at application creation"
          />

          <!-- Contacts -->
          <template v-if="client.contacts.length">
            <div class="text-subtitle2 q-mt-md">Contacts</div>
            <div class="q-gutter-xs">
              <q-chip
                v-for="contact in client.contacts"
                :key="contact"
                dense
                icon="sym_o_mail"
                :label="contact"
              />
            </div>
          </template>

          <q-btn
            v-if="!isSystem"
            color="primary"
            label="Save Protocol"
            no-caps
            :loading="store.loading"
            @click="saveProtocol"
          />
        </div>
      </q-tab-panel>

      <!-- Credentials Tab -->
      <q-tab-panel name="credentials">
        <div v-if="client" class="q-gutter-md" style="max-width: 600px">
          <div class="text-subtitle2">Client ID</div>
          <q-input :model-value="client.clientId" outlined readonly dense>
            <template #append>
              <q-btn
                flat
                round
                dense
                icon="sym_o_content_copy"
                @click="copyToClipboard(client.clientId)"
              />
            </template>
          </q-input>

          <div class="text-subtitle2">Client Authentication Method</div>
          <q-input
            :model-value="tokenAuthMethodLabel(client.tokenEndpointAuthMethod)"
            outlined
            readonly
            dense
          />

          <template
            v-if="
              client.tokenEndpointAuthMethod ===
                TokenEndpointAuthMethod.CLIENT_SECRET_BASIC ||
              client.tokenEndpointAuthMethod ===
                TokenEndpointAuthMethod.CLIENT_SECRET_POST
            "
          >
            <q-separator class="q-my-md" />
            <div class="text-subtitle2">Client Secret</div>
            <div class="text-caption text-grey q-mb-sm">
              The secret is only shown at creation time. Use "Regenerate" to
              create a new one.
            </div>
            <q-btn
              outline
              color="warning"
              label="Regenerate Secret"
              icon="sym_o_refresh"
              no-caps
              @click="confirmRegenerate"
            />
          </template>

          <!-- Secret expiry -->
          <template v-if="client.clientSecretExpiresAt">
            <div class="text-caption text-warning q-mt-sm">
              Secret expires:
              {{ formatDate(client.clientSecretExpiresAt) }}
            </div>
          </template>

          <!-- Show secret after regeneration -->
          <template v-if="newSecret">
            <q-banner class="bg-warning text-dark q-mt-md">
              <template #avatar>
                <q-icon name="sym_o_warning" />
              </template>
              Save the new client secret now. It will not be shown again.
            </q-banner>
            <q-input
              :model-value="newSecret"
              outlined
              readonly
              dense
              :type="showSecret ? 'text' : 'password'"
            >
              <template #append>
                <q-btn
                  flat
                  round
                  dense
                  :icon="
                    showSecret ? 'sym_o_visibility_off' : 'sym_o_visibility'
                  "
                  @click="showSecret = !showSecret"
                />
                <q-btn
                  flat
                  round
                  dense
                  icon="sym_o_content_copy"
                  @click="copyToClipboard(newSecret)"
                />
              </template>
            </q-input>
          </template>
        </div>
      </q-tab-panel>

      <!-- Scopes & Claims Tab -->
      <q-tab-panel name="scopes">
        <div v-if="client" class="q-gutter-md" style="max-width: 600px">
          <!-- Assigned Scopes -->
          <div class="text-subtitle2">Assigned Scopes</div>
          <div class="text-caption text-grey q-mb-sm">
            Scopes this client may request at all; access to a resource further
            limits them to what that access grants.
          </div>
          <div class="q-gutter-sm">
            <q-checkbox
              v-for="scope in allScopeOptions"
              :key="scope"
              v-model="scopeForm.allowedScopes"
              :val="scope"
              :label="scope"
            />
          </div>

          <q-btn
            v-if="!isSystem"
            color="primary"
            label="Save Scopes"
            no-caps
            :loading="store.loading"
            @click="saveScopes"
          />

          <!-- Subject Identifier -->
          <q-separator class="q-my-lg" />
          <div class="text-subtitle2">Subject Identifier</div>
          <q-card flat bordered class="q-pa-md">
            <div class="text-subtitle2">
              {{ subjectTypeLabel(client.subjectType) }}
            </div>
            <div class="text-caption text-grey">
              The subject a user gets is decided by the recipient organization
              and the user's relation to it, not by this setting: users of
              another organization always get an identifier for that
              organization alone. The subject type metadata never changes the
              users' subjects; moving them is an account migration.
            </div>
            <template v-if="client.orgId">
              <q-separator class="q-my-sm" />
              <div class="text-caption">
                <strong>Recipient organization:</strong>
                {{ client.orgId }}
              </div>
            </template>
          </q-card>
        </div>
      </q-tab-panel>

      <!-- Device Auth Tab (RFC 8628) -->
      <q-tab-panel name="device-auth">
        <div v-if="client" class="q-gutter-md" style="max-width: 600px">
          <q-banner class="bg-blue-1 text-dark q-mb-md" rounded>
            <template #avatar>
              <q-icon name="sym_o_info" color="primary" />
            </template>
            Device Authorization Grant (RFC 8628) enables login on devices with
            limited input capability — smart TVs, CLI tools, IoT devices. Users
            enter a short code on their phone or laptop to authorize the device.
          </q-banner>

          <!-- Enable toggle -->
          <div class="text-subtitle2">Enable Device Auth</div>
          <q-toggle
            v-model="deviceAuthForm.enabled"
            label="Allow device_code grant for this application"
            color="primary"
          />

          <template v-if="deviceAuthForm.enabled">
            <!-- User Code Format -->
            <div class="text-subtitle2 q-mt-md">User Code Format</div>
            <q-select
              v-model="deviceAuthForm.userCodeFormat"
              outlined
              dense
              :options="userCodeFormatOptions"
              emit-value
              map-options
              hint="Format of the code users will type on their authorizing device"
            />

            <!-- Code Expiry -->
            <div class="text-subtitle2 q-mt-md">Code Expiry (seconds)</div>
            <q-input
              v-model.number="deviceAuthForm.codeExpiry"
              outlined
              dense
              type="number"
              :rules="[
                (v: number) => v >= 60 || 'Minimum 60 seconds',
                (v: number) => v <= 3600 || 'Maximum 3600 seconds',
              ]"
              hint="Time before device_code and user_code expire (default: 600 = 10 min)"
            />

            <!-- Poll Interval -->
            <div class="text-subtitle2 q-mt-md">Poll Interval (seconds)</div>
            <q-input
              v-model.number="deviceAuthForm.pollInterval"
              outlined
              dense
              type="number"
              :rules="[
                (v: number) => v >= 1 || 'Minimum 1 second',
                (v: number) => v <= 60 || 'Maximum 60 seconds',
              ]"
              hint="Minimum delay between device polling attempts (default: 5)"
            />

            <!-- Verification URI (read-only) -->
            <div class="text-subtitle2 q-mt-md">Verification URI</div>
            <q-input
              :model-value="verificationUri"
              outlined
              dense
              readonly
              hint="Auto-configured. Users visit this URL to enter the code"
            >
              <template #append>
                <q-btn
                  flat
                  round
                  dense
                  icon="sym_o_content_copy"
                  @click="copyToClipboard(verificationUri)"
                />
              </template>
            </q-input>

            <!-- QR Code -->
            <div class="text-subtitle2 q-mt-md">QR Code</div>
            <q-toggle
              v-model="deviceAuthForm.showQrCode"
              label="Show QR code on device screen (encodes verification_uri_complete)"
              color="primary"
            />
            <div class="text-caption text-grey">
              When enabled, devices can display a QR code that users scan with
              their phone, bypassing manual code entry.
            </div>
          </template>

          <q-btn
            v-if="!isSystem"
            color="primary"
            label="Save Device Auth"
            no-caps
            :loading="store.loading"
            @click="saveDeviceAuth"
            class="q-mt-md"
          />
        </div>
      </q-tab-panel>

      <!-- Resource Tab -->
      <q-tab-panel name="resource">
        <div v-if="resource" class="q-gutter-md" style="max-width: 600px">
          <div class="text-subtitle2">Resource indicator</div>
          <q-input
            :model-value="resource.indicator"
            outlined
            readonly
            dense
            hint="The audience of every access token issued for this resource (RFC 8707)"
          >
            <template #append>
              <q-btn
                flat
                round
                dense
                icon="sym_o_content_copy"
                @click="copyToClipboard(resource.indicator)"
              />
            </template>
          </q-input>

          <div class="text-subtitle2">Issuer</div>
          <q-input
            :model-value="resource.issuer"
            outlined
            readonly
            dense
            hint="The resource accepts tokens of this issuer only"
          />

          <div class="text-subtitle2">Scopes</div>
          <div class="q-gutter-xs">
            <q-badge
              v-for="scope in resource.scopes"
              :key="scope"
              color="grey-3"
              text-color="grey-8"
              :label="scope"
            />
            <span v-if="!resource.scopes.length" class="text-caption text-grey"
              >No scopes</span
            >
          </div>

          <div class="text-subtitle2">State</div>
          <q-badge
            :color="resourceStateColor(resource.state)"
            :label="resourceStateLabel(resource.state)"
          />
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Delete confirmation dialog -->
    <q-dialog v-model="deleteDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Delete Application</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete
            <strong>{{ store.currentApp?.name }}</strong>?
          </p>
          <p class="text-negative text-caption">
            Its client and the client's access are deleted; its resource is
            retired and access to it ends. This cannot be undone.
          </p>
          <q-input
            v-model="deleteConfirmName"
            outlined
            dense
            :placeholder="`Type '${store.currentApp?.name}' to confirm`"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            flat
            color="negative"
            label="Delete"
            :disable="deleteConfirmName !== store.currentApp?.name"
            @click="executeDelete"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Regenerate secret confirmation -->
    <q-dialog v-model="regenerateDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Regenerate Client Secret</div>
        </q-card-section>
        <q-card-section>
          <p>
            This will invalidate the current secret. All integrations using the
            old secret will break.
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            flat
            color="warning"
            label="Regenerate"
            @click="executeRegenerate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { copyToClipboard, useQuasar } from "quasar";
import {
  useApplicationsStore,
  isApplicationActive,
} from "src/stores/applications";
import {
  ApplicationType,
  SystemIntegration,
  TokenEndpointAuthMethod,
  type UpdateClientRoleRequest,
} from "@structured-id/proto/sid/v1/projects/projects";
import { Timestamp } from "@structured-id/ui-core";
import {
  applicationTypeLabel,
  applicationTypeColor,
  tokenAuthMethodLabel,
  subjectTypeLabel,
  resourceStateLabel,
  resourceStateColor,
} from "src/composables/useEnumLabels";

const store = useApplicationsStore();
const route = useRoute();
const router = useRouter();
const $q = useQuasar();

const tab = ref("general");
const deleteDialog = ref(false);
const deleteConfirmName = ref("");
const regenerateDialog = ref(false);
const newSecret = ref<string | null>(null);
const showSecret = ref(false);

const generalForm = reactive({
  name: "",
});

const protocolForm = reactive({
  redirectUris: [] as string[],
  grantTypes: [] as string[],
  allowedScopes: [] as string[],
});

const scopeForm = reactive({
  allowedScopes: [] as string[],
});

const deviceAuthForm = reactive({
  enabled: false,
  userCodeFormat: "XXXX-XXXX",
  codeExpiry: 600,
  pollInterval: 5,
  showQrCode: true,
});

const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

const userCodeFormatOptions = [
  { value: "XXXX-XXXX", label: "XXXX-XXXX (8 alphanumeric, recommended)" },
  { value: "XXXXXX", label: "XXXXXX (6 alphanumeric)" },
  { value: "000000", label: "000000 (6 numeric)" },
];

const verificationUri = computed(() => {
  return `${window.location.origin}/device`;
});

const client = computed(() => store.currentApp?.client);
const resource = computed(() => store.currentApp?.resource);
const isSystem = computed(
  () =>
    (store.currentApp?.systemIntegration ?? SystemIntegration.UNSPECIFIED) !==
    SystemIntegration.UNSPECIFIED,
);

const generalFormChanged = computed(
  () => store.currentApp && generalForm.name !== store.currentApp.name,
);

const grantTypeOptions = [
  { value: "authorization_code", label: "Authorization Code" },
  { value: "client_credentials", label: "Client Credentials" },
  { value: "refresh_token", label: "Refresh Token" },
  {
    value: "urn:ietf:params:oauth:grant-type:device_code",
    label: "Device Code",
  },
];

const scopeOptions = ["openid", "profile", "email", "address", "phone"];

const allScopeOptions = [
  "openid",
  "profile",
  "email",
  "address",
  "phone",
  "offline_access",
];

function populateForms() {
  const app = store.currentApp;
  if (!app) return;
  generalForm.name = app.name;
  const c = app.client;
  protocolForm.redirectUris = c ? [...c.redirectUris] : [];
  protocolForm.grantTypes = c ? [...c.grantTypes] : [];
  protocolForm.allowedScopes = c ? [...c.allowedScopes] : [];
  scopeForm.allowedScopes = c ? [...c.allowedScopes] : [];
  deviceAuthForm.enabled = c?.grantTypes.includes(DEVICE_CODE_GRANT) ?? false;
}

function formatDate(ts?: { seconds: bigint; nanos: number }): string {
  if (!ts) return "—";
  return Timestamp.toDate(ts).toLocaleDateString();
}

watch(() => store.currentApp, populateForms, { immediate: true });

/**
 * Sends only the changed client settings: the server keeps every list that
 * arrives empty, so an untouched list is never resent.
 */
async function updateClient(
  change: Omit<
    UpdateClientRoleRequest,
    "clientId" | "redirectUris" | "allowedScopes" | "grantTypes"
  > &
    Partial<
      Pick<
        UpdateClientRoleRequest,
        "redirectUris" | "allowedScopes" | "grantTypes"
      >
    >,
  success: string,
) {
  if (!client.value) return;
  try {
    await store.updateClientRole({
      clientId: client.value.clientId,
      redirectUris: [],
      allowedScopes: [],
      grantTypes: [],
      ...change,
    });
    $q.notify({ type: "positive", message: success });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Update failed" });
  }
}

async function toggleStatus(val: boolean) {
  await updateClient(
    { active: val },
    val ? "Client activated" : "Client deactivated",
  );
}

async function saveGeneral() {
  if (!store.currentApp) return;
  try {
    await store.updateApplication({
      id: store.currentApp.id,
      name: generalForm.name,
    });
    $q.notify({ type: "positive", message: "Application updated" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Update failed" });
  }
}

async function saveProtocol() {
  await updateClient(
    {
      redirectUris: protocolForm.redirectUris.filter((u) => u.trim()),
      grantTypes: protocolForm.grantTypes,
      allowedScopes: protocolForm.allowedScopes,
    },
    "Protocol settings updated",
  );
}

async function saveScopes() {
  await updateClient(
    { allowedScopes: scopeForm.allowedScopes },
    "Scopes updated",
  );
}

async function saveDeviceAuth() {
  if (!client.value) return;
  const currentGrants = client.value.grantTypes.filter(
    (g) => g !== DEVICE_CODE_GRANT,
  );
  const grantTypes = deviceAuthForm.enabled
    ? [...currentGrants, DEVICE_CODE_GRANT]
    : currentGrants;
  await updateClient({ grantTypes }, "Device auth settings updated");
}

function confirmDelete() {
  deleteConfirmName.value = "";
  deleteDialog.value = true;
}

async function executeDelete() {
  if (!store.currentApp) return;
  try {
    await store.deleteApplication(store.currentApp.id);
    deleteDialog.value = false;
    $q.notify({ type: "positive", message: "Application deleted" });
    router.push({ name: "admin-applications" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Delete failed" });
  }
}

function confirmRegenerate() {
  regenerateDialog.value = true;
}

async function executeRegenerate() {
  if (!store.currentApp) return;
  try {
    // TODO: call RotateClientSecret RPC when available
    // For now, re-create would be needed — this is a placeholder
    regenerateDialog.value = false;
    $q.notify({
      type: "info",
      message: "Secret regeneration not yet implemented in backend",
    });
  } catch {
    $q.notify({
      type: "negative",
      message: store.error || "Regeneration failed",
    });
  }
}

onMounted(async () => {
  const id = route.params.id as string;
  if (id) {
    await store.getApplication(id);
  }
});
</script>
