<template>
  <q-page padding>
    <div class="text-h5 q-mb-md">Blueprints & Migration</div>

    <q-tabs
      v-model="activeTab"
      dense
      align="left"
      class="text-grey"
      active-color="primary"
      indicator-color="primary"
    >
      <q-tab name="blueprints" label="Blueprints" icon="sym_o_file_copy" />
      <q-tab name="migration" label="Migration Wizard" icon="sym_o_move_down" />
      <q-tab
        name="passwords"
        label="Password Migration"
        icon="sym_o_password"
      />
    </q-tabs>

    <q-separator />

    <q-tab-panels v-model="activeTab" animated class="q-mt-md">
      <!-- ═══════════════════════════ BLUEPRINTS ═══════════════════════════ -->
      <q-tab-panel name="blueprints">
        <div class="row q-gutter-lg">
          <!-- Export -->
          <q-card flat bordered class="col-12 col-md-5">
            <q-card-section>
              <div class="text-subtitle1 q-mb-md">Export Blueprint</div>

              <div class="text-caption text-grey q-mb-sm">Categories</div>
              <q-option-group
                v-model="exportCategories"
                :options="categoryOptions"
                type="checkbox"
                dense
              />

              <q-separator class="q-my-md" />

              <q-select
                v-model="exportScope"
                :options="scopeOptions"
                label="Scope"
                outlined
                dense
                emit-value
                map-options
                class="q-mb-sm"
              />

              <q-input
                v-if="exportScope !== BlueprintScope.INSTANCE"
                v-model="exportScopeTargetId"
                :label="
                  exportScope === BlueprintScope.SITE
                    ? 'Site ID'
                    : 'Organization ID'
                "
                outlined
                dense
                class="q-mb-md"
              />
            </q-card-section>
            <q-card-actions>
              <q-btn
                color="primary"
                label="Export Blueprint"
                icon="sym_o_download"
                :loading="store.loading"
                @click="doExportBlueprint"
              />
            </q-card-actions>
          </q-card>

          <!-- Import -->
          <q-card flat bordered class="col-12 col-md-5">
            <q-card-section>
              <div class="text-subtitle1 q-mb-md">Import Blueprint</div>

              <q-file
                v-model="importFile"
                label="Upload YAML blueprint"
                outlined
                dense
                accept=".yaml,.yml"
                class="q-mb-md"
              >
                <template #prepend>
                  <q-icon name="sym_o_upload_file" />
                </template>
              </q-file>

              <q-select
                v-model="defaultConflictResolution"
                :options="conflictOptions"
                label="Default Conflict Resolution"
                outlined
                dense
                emit-value
                map-options
                class="q-mb-md"
              />

              <q-btn
                color="warning"
                label="Dry Run (Preview)"
                icon="sym_o_preview"
                :loading="store.saving"
                :disable="!importFile"
                class="q-mr-sm"
                @click="doImportBlueprint(true)"
              />
              <q-btn
                color="primary"
                label="Import"
                icon="sym_o_publish"
                :loading="store.saving"
                :disable="!importFile"
                @click="doImportBlueprint(false)"
              />
            </q-card-section>

            <!-- Import preview results -->
            <q-card-section v-if="store.importPreview">
              <q-separator class="q-mb-md" />
              <div class="text-subtitle2 q-mb-sm">
                {{ store.importPreview.dryRun ? "Preview" : "Result" }}
              </div>

              <div class="row q-gutter-sm q-mb-md">
                <q-badge color="positive"
                  >Created: {{ store.importPreview.created }}</q-badge
                >
                <q-badge color="warning"
                  >Updated: {{ store.importPreview.updated }}</q-badge
                >
                <q-badge color="grey"
                  >Skipped: {{ store.importPreview.skipped }}</q-badge
                >
                <q-badge v-if="store.importPreview.errors > 0" color="negative">
                  Errors: {{ store.importPreview.errors }}
                </q-badge>
              </div>

              <q-list dense separator>
                <q-item v-for="(item, i) in store.importPreview.items" :key="i">
                  <q-item-section avatar>
                    <q-badge :color="importActionColor(item.action)">
                      {{ importActionLabel(item.action) }}
                    </q-badge>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ item.entityName }}</q-item-label>
                    <q-item-label caption>{{ item.entityType }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>

              <div
                v-if="store.importPreview.errorMessages.length > 0"
                class="q-mt-sm"
              >
                <q-banner
                  v-for="(msg, i) in store.importPreview.errorMessages"
                  :key="i"
                  class="bg-negative text-white q-mb-xs"
                  dense
                >
                  {{ msg }}
                </q-banner>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </q-tab-panel>

      <!-- ═══════════════════════════ MIGRATION WIZARD ═══════════════════════════ -->
      <q-tab-panel name="migration">
        <q-stepper v-model="wizardStep" vertical color="primary" animated>
          <!-- Step 1: Source Selection -->
          <q-step
            :name="1"
            title="Source Selection"
            icon="sym_o_input"
            :done="wizardStep > 1"
          >
            <div class="text-body2 q-mb-md">
              Select the identity provider you are migrating from:
            </div>

            <div class="row q-gutter-md">
              <q-card
                v-for="src in sourceOptions"
                :key="src.value"
                flat
                bordered
                :class="{
                  'bg-blue-1 border-primary': selectedSource === src.value,
                }"
                class="col-12 col-sm-4 col-md-3 cursor-pointer"
                @click="selectedSource = src.value"
              >
                <q-card-section class="text-center">
                  <q-icon
                    :name="migrationSourceIcon(src.value)"
                    size="lg"
                    class="q-mb-sm"
                  />
                  <div class="text-weight-medium">{{ src.label }}</div>
                </q-card-section>
              </q-card>
            </div>

            <q-stepper-navigation>
              <q-btn
                color="primary"
                label="Next"
                :disable="selectedSource === MigrationSource.UNSPECIFIED"
                @click="wizardStep = 2"
              />
            </q-stepper-navigation>
          </q-step>

          <!-- Step 2: Upload & Parse -->
          <q-step
            :name="2"
            title="Upload & Parse"
            icon="sym_o_upload_file"
            :done="wizardStep > 2"
          >
            <q-file
              v-model="migrationFile"
              :label="`Upload ${migrationSourceLabel(selectedSource)} export file`"
              outlined
              dense
              class="q-mb-md"
              style="max-width: 500px"
            >
              <template #prepend>
                <q-icon name="sym_o_upload_file" />
              </template>
            </q-file>

            <q-btn
              color="primary"
              label="Parse File"
              :loading="store.loading"
              :disable="!migrationFile"
              class="q-mb-md"
              @click="doParseFile"
            />

            <!-- Parse results -->
            <div v-if="store.parseResult">
              <q-banner class="bg-info text-white q-mb-md">
                Detected:
                {{ migrationSourceLabel(store.parseResult.detectedSource) }}
                <span v-if="store.parseResult.sourceVersion"
                  >({{ store.parseResult.sourceVersion }})</span
                >
              </q-banner>

              <q-list bordered separator>
                <q-item
                  v-for="entity in store.parseResult.entities"
                  :key="entity.entityType"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ entity.count }} {{ entity.entityType }}
                    </q-item-label>
                    <q-item-label caption>
                      → {{ entity.sidEntity }}
                      <span v-if="entity.notes" class="text-grey">
                        ({{ entity.notes }})</span
                      >
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>

              <div
                v-if="store.parseResult.passwordAlgorithm"
                class="q-mt-sm text-caption"
              >
                Password hashes:
                {{
                  legacyHashAlgorithmLabel(store.parseResult.passwordAlgorithm)
                }}
                ({{ store.parseResult.userCount }} users)
              </div>
            </div>

            <q-stepper-navigation>
              <q-btn
                color="primary"
                label="Next"
                :disable="!store.parseResult"
                @click="wizardStep = 3"
              />
              <q-btn
                flat
                label="Back"
                @click="wizardStep = 1"
                class="q-ml-sm"
              />
            </q-stepper-navigation>
          </q-step>

          <!-- Step 3: Mapping -->
          <q-step
            :name="3"
            title="Mapping Configuration"
            icon="sym_o_compare_arrows"
            :done="wizardStep > 3"
          >
            <div class="text-body2 q-mb-md">
              Review and adjust entity mapping. Source fields will be mapped to
              StructuredID entities.
            </div>

            <q-table
              v-if="store.parseResult"
              :rows="store.parseResult.entities"
              :columns="mappingColumns"
              row-key="entityType"
              flat
              bordered
              :pagination="{ rowsPerPage: 20 }"
            >
              <template #body-cell-arrow="props">
                <q-td :props="props">
                  <q-icon name="sym_o_arrow_forward" />
                </q-td>
              </template>
            </q-table>

            <q-input
              v-model="passwordDeadlineStr"
              label="Password Migration Deadline (optional)"
              type="date"
              outlined
              dense
              class="q-mt-md"
              style="max-width: 300px"
              hint="Unmigrated users will be forced to reset password after this date"
            />

            <q-stepper-navigation>
              <q-btn color="primary" label="Next" @click="wizardStep = 4" />
              <q-btn
                flat
                label="Back"
                @click="wizardStep = 3"
                class="q-ml-sm"
              />
            </q-stepper-navigation>
          </q-step>

          <!-- Step 4: Execute -->
          <q-step :name="4" title="Execute Migration" icon="sym_o_play_arrow">
            <div class="text-body2 q-mb-md">
              Choose how to proceed with the migration:
            </div>

            <div class="row q-gutter-md q-mb-lg">
              <q-btn
                color="warning"
                label="Dry Run"
                icon="sym_o_preview"
                :loading="store.saving"
                @click="doExecuteMigration(true)"
              />
              <q-btn
                color="primary"
                label="Execute Migration"
                icon="sym_o_play_arrow"
                :loading="store.saving"
                @click="doExecuteMigration(false)"
              />
            </div>

            <!-- Migration result -->
            <div v-if="store.migrationResult">
              <q-banner
                :class="
                  store.migrationResult.state === MigrationState.COMPLETED
                    ? 'bg-positive'
                    : store.migrationResult.state === MigrationState.FAILED
                      ? 'bg-negative'
                      : 'bg-info'
                "
                class="text-white q-mb-md"
              >
                {{ migrationStateLabel(store.migrationResult.state) }}
                <span v-if="store.migrationResult.dryRun"> (Dry Run)</span>
              </q-banner>

              <div class="row q-gutter-sm q-mb-md">
                <q-badge color="info"
                  >Total: {{ store.migrationResult.totalEntities }}</q-badge
                >
                <q-badge color="positive"
                  >Succeeded: {{ store.migrationResult.succeeded }}</q-badge
                >
                <q-badge
                  v-if="store.migrationResult.failed > 0"
                  color="negative"
                >
                  Failed: {{ store.migrationResult.failed }}
                </q-badge>
              </div>

              <div v-if="store.migrationResult.errorMessages.length > 0">
                <q-banner
                  v-for="(msg, i) in store.migrationResult.errorMessages"
                  :key="i"
                  class="bg-negative text-white q-mb-xs"
                  dense
                >
                  {{ msg }}
                </q-banner>
              </div>
            </div>

            <q-stepper-navigation>
              <q-btn flat label="Back" @click="wizardStep = 3" />
            </q-stepper-navigation>
          </q-step>
        </q-stepper>
      </q-tab-panel>

      <!-- ═══════════════════════════ PASSWORD MIGRATION ═══════════════════════════ -->
      <q-tab-panel name="passwords">
        <div v-if="store.passwordProgress" style="max-width: 600px">
          <div class="text-subtitle1 q-mb-md">Password Migration Progress</div>

          <q-linear-progress
            :value="store.passwordProgress.progressPercent / 100"
            size="30px"
            color="positive"
            track-color="grey-3"
            class="q-mb-md"
          >
            <div class="absolute-full flex flex-center">
              <span class="text-white text-weight-medium">
                {{ store.passwordProgress.progressPercent.toFixed(1) }}%
              </span>
            </div>
          </q-linear-progress>

          <q-list bordered separator>
            <q-item>
              <q-item-section>
                <q-item-label caption>Total Users</q-item-label>
                <q-item-label>{{
                  store.passwordProgress.totalUsers
                }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Migrated (OPAQUE)</q-item-label>
                <q-item-label class="text-positive text-weight-medium">
                  {{ store.passwordProgress.migrated }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Pending (awaiting login)</q-item-label>
                <q-item-label class="text-warning">{{
                  store.passwordProgress.pending
                }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="store.passwordProgress.failed > 0">
              <q-item-section>
                <q-item-label caption>Failed</q-item-label>
                <q-item-label class="text-negative">{{
                  store.passwordProgress.failed
                }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Legacy Hash Algorithm</q-item-label>
                <q-item-label>{{
                  legacyHashAlgorithmLabel(store.passwordProgress.algorithm)
                }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="store.passwordProgress.deadline">
              <q-item-section>
                <q-item-label caption>Deadline</q-item-label>
                <q-item-label>{{
                  formatTimestamp(store.passwordProgress.deadline)
                }}</q-item-label>
                <q-item-label caption class="text-grey">
                  After deadline: unmigrated users forced to reset password
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <div v-else class="text-grey text-center q-pa-xl">
          <q-icon name="sym_o_info" size="lg" class="q-mb-md" />
          <div>No active password migration</div>
          <div class="text-caption">
            Use the Migration Wizard to import users with legacy password hashes
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useMigrationStore } from "#admin/stores/migration";
import {
  BlueprintCategory,
  BlueprintScope,
  MigrationSource,
  MigrationState,
  ConflictResolution,
} from "@structured-id/proto/sid/v1/admin/migration";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import {
  migrationSourceLabel,
  migrationSourceIcon,
  migrationStateLabel,
  importActionLabel,
  importActionColor,
  legacyHashAlgorithmLabel,
  conflictResolutionLabel,
} from "#admin/composables/useEnumLabels";
import type { QTableColumn } from "quasar";

const store = useMigrationStore();
const activeTab = ref("blueprints");

// ── Blueprint Export ──
const exportCategories = ref<BlueprintCategory[]>([
  BlueprintCategory.SITES,
  BlueprintCategory.AUTH_FLOWS,
  BlueprintCategory.APPLICATIONS,
  BlueprintCategory.ROLES,
  BlueprintCategory.IDENTITY_PROVIDERS,
  BlueprintCategory.PASSWORD_POLICY,
  BlueprintCategory.BRANDING,
  BlueprintCategory.FEATURE_FLAGS,
  BlueprintCategory.NOTIFICATION_TEMPLATES,
]);
const exportScope = ref(BlueprintScope.INSTANCE);
const exportScopeTargetId = ref("");

const categoryOptions = [
  { label: "Sites / Realms", value: BlueprintCategory.SITES },
  { label: "Auth Flows", value: BlueprintCategory.AUTH_FLOWS },
  { label: "Applications", value: BlueprintCategory.APPLICATIONS },
  { label: "Roles & Permissions", value: BlueprintCategory.ROLES },
  { label: "Identity Providers", value: BlueprintCategory.IDENTITY_PROVIDERS },
  { label: "Password Policy", value: BlueprintCategory.PASSWORD_POLICY },
  { label: "Branding / Themes", value: BlueprintCategory.BRANDING },
  { label: "Feature Flags", value: BlueprintCategory.FEATURE_FLAGS },
  {
    label: "Notification Templates",
    value: BlueprintCategory.NOTIFICATION_TEMPLATES,
  },
];

const scopeOptions = [
  { label: "Entire Instance", value: BlueprintScope.INSTANCE },
  { label: "Specific Site", value: BlueprintScope.SITE },
  { label: "Specific Organization", value: BlueprintScope.ORGANIZATION },
];

async function doExportBlueprint() {
  const result = await store.exportBlueprint(
    exportCategories.value,
    exportScope.value,
    exportScopeTargetId.value,
  );
  if (result) {
    const blob = new Blob([result.yamlContent], { type: "application/x-yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename || "blueprint.yaml";
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ── Blueprint Import ──
const importFile = ref<File | null>(null);
const defaultConflictResolution = ref(ConflictResolution.SKIP);

const conflictOptions = [
  {
    label: conflictResolutionLabel(ConflictResolution.SKIP),
    value: ConflictResolution.SKIP,
  },
  {
    label: conflictResolutionLabel(ConflictResolution.OVERWRITE),
    value: ConflictResolution.OVERWRITE,
  },
  {
    label: conflictResolutionLabel(ConflictResolution.RENAME),
    value: ConflictResolution.RENAME,
  },
];

async function doImportBlueprint(dryRun: boolean) {
  if (!importFile.value) return;
  const text = await importFile.value.text();
  await store.importBlueprint(
    text,
    dryRun,
    defaultConflictResolution.value,
    [],
  );
}

// ── Migration Wizard ──
const wizardStep = ref(1);
const selectedSource = ref(MigrationSource.UNSPECIFIED);
const migrationFile = ref<File | null>(null);
const passwordDeadlineStr = ref("");

const sourceOptions = [
  { label: "Keycloak", value: MigrationSource.KEYCLOAK },
  { label: "Auth0", value: MigrationSource.AUTH0 },
  { label: "Okta", value: MigrationSource.OKTA },
  { label: "Zitadel", value: MigrationSource.ZITADEL },
  { label: "Authentik", value: MigrationSource.AUTHENTIK },
  { label: "LDAP/AD", value: MigrationSource.LDAP },
  { label: "SCIM 2.0", value: MigrationSource.SCIM },
  { label: "Custom CSV", value: MigrationSource.CSV },
];

const mappingColumns: QTableColumn[] = [
  {
    name: "entityType",
    label: "Source Entity",
    field: "entityType",
    align: "left",
  },
  { name: "count", label: "Count", field: "count", align: "center" },
  {
    name: "arrow",
    label: "",
    field: "entityType",
    align: "center",
    style: "width: 40px",
  },
  { name: "sidEntity", label: "SID Entity", field: "sidEntity", align: "left" },
  { name: "notes", label: "Notes", field: "notes", align: "left" },
];

async function doParseFile() {
  if (!migrationFile.value) return;
  const content = await migrationFile.value.text();
  await store.parseMigrationFile(
    selectedSource.value,
    content,
    migrationFile.value.name,
  );
}

async function doExecuteMigration(dryRun: boolean) {
  if (!migrationFile.value) return;
  const content = await migrationFile.value.text();
  let deadline: Timestamp | undefined;
  if (passwordDeadlineStr.value) {
    const d = new Date(passwordDeadlineStr.value);
    deadline = { seconds: BigInt(Math.floor(d.getTime() / 1000)), nanos: 0 };
  }
  await store.executeMigration(
    selectedSource.value,
    content,
    [],
    dryRun,
    deadline,
  );
}

// ── Timestamp formatting ──
function formatTimestamp(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  const d = new Date(Number(ts.seconds) * 1000);
  return d.toLocaleDateString();
}

// ── Load data ──
onMounted(() => {
  store.fetchPasswordProgress();
});
</script>
