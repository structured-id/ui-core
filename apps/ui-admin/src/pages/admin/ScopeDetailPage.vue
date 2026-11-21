<template>
  <q-page padding>
    <!-- Header -->
    <div class="row items-center q-mb-lg">
      <q-btn
        flat
        round
        icon="sym_o_arrow_back"
        @click="router.push({ name: 'admin-scopes' })"
      />
      <div class="col q-ml-sm">
        <div class="text-h5">
          {{ store.currentScope?.name || "Scope" }}
          <q-badge
            v-if="store.currentScope"
            :color="scopeTypeColor(store.currentScope.type)"
            :label="scopeTypeLabel(store.currentScope.type)"
            class="q-ml-sm"
          />
        </div>
        <div
          v-if="store.currentScope?.displayName"
          class="text-caption text-grey"
        >
          {{ store.currentScope.displayName }}
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
    <q-tabs
      v-model="tab"
      dense
      class="text-grey"
      active-color="primary"
      narrow-indicator
      align="left"
    >
      <q-tab name="settings" label="Settings" />
      <q-tab name="claims" label="Claim Mappings" />
    </q-tabs>
    <q-separator />

    <q-tab-panels v-model="tab" animated class="q-mt-md">
      <!-- ── Settings Tab ── -->
      <q-tab-panel name="settings">
        <div style="max-width: 600px">
          <div class="text-subtitle1 text-weight-medium q-mb-md">
            Scope Settings
          </div>
          <div class="q-gutter-md">
            <q-input
              v-model="settingsForm.displayName"
              outlined
              dense
              label="Display name"
              hint="Shown on consent screen"
            />
            <q-input
              v-model="settingsForm.description"
              outlined
              dense
              label="Description"
              type="textarea"
              autogrow
            />
            <q-toggle
              v-model="settingsForm.consentRequired"
              label="Require user consent"
            />
            <q-toggle
              v-model="settingsForm.includeInTokenScope"
              label="Include in token scope claim"
            />
            <div>
              <q-btn
                color="primary"
                label="Save"
                no-caps
                :loading="store.loading"
                @click="saveSettings"
              />
            </div>
          </div>
        </div>
      </q-tab-panel>

      <!-- ── Claim Mappings Tab ── -->
      <q-tab-panel name="claims">
        <div class="row items-center q-mb-md">
          <div class="col text-subtitle1 text-weight-medium">
            Claim Mappings
            <q-badge
              v-if="store.claimMappings.length"
              color="primary"
              :label="store.claimMappings.length"
              class="q-ml-sm"
            />
          </div>
          <q-btn
            color="primary"
            icon="sym_o_add"
            label="Add Mapping"
            no-caps
            size="sm"
            @click="openAddMapping"
          />
        </div>

        <q-table
          :rows="store.claimMappings"
          :columns="claimColumns"
          row-key="id"
          flat
          bordered
          :pagination="{ rowsPerPage: 20 }"
        >
          <template #body-cell-source="props">
            <q-td :props="props">
              <q-icon
                :name="claimSourceIcon(props.row.source)"
                size="xs"
                class="q-mr-xs"
              />
              {{ claimSourceLabel(props.row.source) }}
            </q-td>
          </template>

          <template #body-cell-sourceKey="props">
            <q-td :props="props">
              <code v-if="props.row.sourceKey">{{ props.row.sourceKey }}</code>
              <code v-else-if="props.row.staticValue" class="text-grey">{{
                props.row.staticValue
              }}</code>
              <span v-else class="text-grey">—</span>
            </q-td>
          </template>

          <template #body-cell-targets="props">
            <q-td :props="props">
              <q-badge
                v-if="props.row.addToIdToken"
                color="blue"
                label="ID"
                class="q-mr-xs"
              />
              <q-badge
                v-if="props.row.addToAccessToken"
                color="teal"
                label="Access"
                class="q-mr-xs"
              />
              <q-badge
                v-if="props.row.addToUserinfo"
                color="purple"
                label="Userinfo"
              />
            </q-td>
          </template>

          <template #body-cell-multivalued="props">
            <q-td :props="props">
              <q-icon
                :name="
                  props.row.multivalued ? 'sym_o_check_circle' : 'sym_o_cancel'
                "
                :color="props.row.multivalued ? 'positive' : 'grey'"
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
                icon="sym_o_edit"
                size="sm"
                @click="openEditMapping(props.row)"
              >
                <q-tooltip>Edit</q-tooltip>
              </q-btn>
              <q-btn
                flat
                round
                dense
                icon="sym_o_delete"
                color="negative"
                size="sm"
                @click="confirmDeleteMapping(props.row)"
              >
                <q-tooltip>Delete</q-tooltip>
              </q-btn>
            </q-td>
          </template>

          <template #no-data>
            <div class="full-width text-center q-pa-lg">
              <q-icon name="sym_o_label" size="48px" color="grey-4" />
              <div class="text-body1 text-grey-6 q-mt-sm">
                No claim mappings
              </div>
              <div class="text-body2 text-grey q-mb-md">
                Add mappings to include claims in tokens for this scope.
              </div>
              <q-btn
                color="primary"
                icon="sym_o_add"
                label="Add Mapping"
                no-caps
                size="sm"
                @click="openAddMapping"
              />
            </div>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Add/Edit Claim Mapping Dialog -->
    <q-dialog v-model="mappingDialog">
      <q-card style="min-width: 550px">
        <q-card-section>
          <div class="text-h6">
            {{ editingMapping ? "Edit" : "Add" }} Claim Mapping
          </div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="mappingForm.claimName"
            outlined
            dense
            label="Claim name"
            hint='JWT claim key, e.g. "email", "roles", "org_id"'
            :rules="[(v: string) => !!v || 'Claim name is required']"
          />
          <q-select
            v-model="mappingForm.source"
            :options="claimSourceOptions"
            outlined
            dense
            emit-value
            map-options
            label="Source"
          />
          <q-input
            v-if="mappingForm.source === ClaimSource.STATIC"
            v-model="mappingForm.staticValue"
            outlined
            dense
            label="Static value"
          />
          <q-input
            v-if="
              mappingForm.source !== ClaimSource.STATIC &&
              mappingForm.source !== ClaimSource.UNSPECIFIED
            "
            v-model="mappingForm.sourceKey"
            outlined
            dense
            label="Source key"
            :hint="sourceKeyHint"
          />
          <q-toggle v-model="mappingForm.multivalued" label="Multivalued" />
          <div class="text-subtitle2">Include in tokens</div>
          <div class="q-gutter-sm">
            <q-toggle v-model="mappingForm.addToIdToken" label="ID Token" />
            <q-toggle
              v-model="mappingForm.addToAccessToken"
              label="Access Token"
            />
            <q-toggle v-model="mappingForm.addToUserinfo" label="Userinfo" />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            :label="editingMapping ? 'Save' : 'Add'"
            no-caps
            :disable="!mappingForm.claimName"
            :loading="store.loading"
            @click="executeMapping"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Delete mapping confirmation -->
    <q-dialog v-model="deleteMappingDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Delete Claim Mapping</div>
        </q-card-section>
        <q-card-section>
          <p>
            Delete mapping for claim
            <strong>{{ mappingToDelete?.claimName }}</strong>?
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            flat
            color="negative"
            label="Delete"
            @click="executeDeleteMapping"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuasar } from "quasar";
import { useScopesStore } from "src/stores/scopes";
import type { ClaimMapping } from "@structured-id/proto/sid/v1/admin/scopes";
import { ClaimSource } from "@structured-id/proto/sid/v1/admin/scopes";
import {
  scopeTypeLabel,
  scopeTypeColor,
  claimSourceLabel,
  claimSourceIcon,
} from "src/composables/useEnumLabels";

const store = useScopesStore();
const route = useRoute();
const router = useRouter();
const $q = useQuasar();

const scopeId = computed(() => route.params.scopeId as string);
const tab = ref("settings");

// ── Settings form ──
const settingsForm = ref({
  displayName: "",
  description: "",
  consentRequired: false,
  includeInTokenScope: false,
});

// ── Claim mapping form ──
const mappingDialog = ref(false);
const editingMapping = ref<ClaimMapping | null>(null);
const deleteMappingDialog = ref(false);
const mappingToDelete = ref<ClaimMapping | null>(null);

const mappingForm = ref({
  claimName: "",
  source: ClaimSource.PROFILE as ClaimSource,
  sourceKey: "",
  staticValue: "",
  multivalued: false,
  addToIdToken: true,
  addToAccessToken: false,
  addToUserinfo: true,
});

const claimSourceOptions = [
  { label: "Profile", value: ClaimSource.PROFILE },
  { label: "Metadata", value: ClaimSource.METADATA },
  { label: "Roles", value: ClaimSource.ROLES },
  { label: "Groups", value: ClaimSource.GROUPS },
  { label: "Static", value: ClaimSource.STATIC },
  { label: "CEL Expression", value: ClaimSource.EXPRESSION },
];

const sourceKeyHint = computed(() => {
  switch (mappingForm.value.source) {
    case ClaimSource.PROFILE:
      return 'Profile field path, e.g. "email", "display_name"';
    case ClaimSource.METADATA:
      return "Metadata key";
    case ClaimSource.EXPRESSION:
      return "CEL expression (EE only)";
    default:
      return "Source field identifier";
  }
});

const claimColumns = [
  {
    name: "claimName",
    label: "Claim",
    field: "claimName",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "source",
    label: "Source",
    field: "source",
    align: "left" as const,
  },
  {
    name: "sourceKey",
    label: "Key / Value",
    field: "sourceKey",
    align: "left" as const,
  },
  {
    name: "targets",
    label: "Targets",
    field: "addToIdToken",
    align: "left" as const,
  },
  {
    name: "multivalued",
    label: "Multi",
    field: "multivalued",
    align: "center" as const,
  },
  { name: "actions", label: "", field: "id" },
];

// ── Settings ──

async function saveSettings() {
  try {
    await store.updateScope({
      scopeId: scopeId.value,
      displayName: settingsForm.value.displayName,
      description: settingsForm.value.description,
      consentRequired: settingsForm.value.consentRequired,
      includeInTokenScope: settingsForm.value.includeInTokenScope,
    });
    $q.notify({ type: "positive", message: "Scope updated" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Update failed" });
  }
}

// ── Claim mappings ──

function openAddMapping() {
  editingMapping.value = null;
  mappingForm.value = {
    claimName: "",
    source: ClaimSource.PROFILE,
    sourceKey: "",
    staticValue: "",
    multivalued: false,
    addToIdToken: true,
    addToAccessToken: false,
    addToUserinfo: true,
  };
  mappingDialog.value = true;
}

function openEditMapping(mapping: ClaimMapping) {
  editingMapping.value = mapping;
  mappingForm.value = {
    claimName: mapping.claimName,
    source: mapping.source,
    sourceKey: mapping.sourceKey,
    staticValue: mapping.staticValue,
    multivalued: mapping.multivalued,
    addToIdToken: mapping.addToIdToken,
    addToAccessToken: mapping.addToAccessToken,
    addToUserinfo: mapping.addToUserinfo,
  };
  mappingDialog.value = true;
}

async function executeMapping() {
  try {
    if (editingMapping.value) {
      await store.updateClaimMapping({
        scopeId: scopeId.value,
        mappingId: editingMapping.value.id,
        claimName: mappingForm.value.claimName,
        source: mappingForm.value.source,
        sourceKey: mappingForm.value.sourceKey,
        staticValue: mappingForm.value.staticValue,
        multivalued: mappingForm.value.multivalued,
        addToIdToken: mappingForm.value.addToIdToken,
        addToAccessToken: mappingForm.value.addToAccessToken,
        addToUserinfo: mappingForm.value.addToUserinfo,
      });
      $q.notify({ type: "positive", message: "Mapping updated" });
    } else {
      await store.addClaimMapping({
        scopeId: scopeId.value,
        claimName: mappingForm.value.claimName,
        source: mappingForm.value.source,
        sourceKey: mappingForm.value.sourceKey,
        staticValue: mappingForm.value.staticValue,
        multivalued: mappingForm.value.multivalued,
        addToIdToken: mappingForm.value.addToIdToken,
        addToAccessToken: mappingForm.value.addToAccessToken,
        addToUserinfo: mappingForm.value.addToUserinfo,
      });
      $q.notify({ type: "positive", message: "Mapping added" });
    }
    mappingDialog.value = false;
  } catch {
    $q.notify({ type: "negative", message: store.error || "Operation failed" });
  }
}

function confirmDeleteMapping(mapping: ClaimMapping) {
  mappingToDelete.value = mapping;
  deleteMappingDialog.value = true;
}

async function executeDeleteMapping() {
  if (!mappingToDelete.value) return;
  try {
    await store.deleteClaimMapping(scopeId.value, mappingToDelete.value.id);
    deleteMappingDialog.value = false;
    $q.notify({ type: "positive", message: "Mapping deleted" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Delete failed" });
  }
}

// ── Init ──

onMounted(async () => {
  try {
    const scope = await store.fetchScope(scopeId.value);
    settingsForm.value = {
      displayName: scope.displayName,
      description: scope.description,
      consentRequired: scope.consentRequired,
      includeInTokenScope: scope.includeInTokenScope,
    };
  } catch {
    // error shown in banner
  }
  store.fetchClaimMappings(scopeId.value);
});
</script>
