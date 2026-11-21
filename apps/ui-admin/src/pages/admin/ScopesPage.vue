<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h4">
          Scopes & Claims
          <q-badge
            v-if="store.scopes.length"
            color="primary"
            :label="store.scopes.length"
            class="q-ml-sm"
          />
        </div>
      </div>
      <div class="q-gutter-sm">
        <q-btn
          outline
          color="primary"
          icon="sym_o_tune"
          label="Realm Defaults"
          no-caps
          @click="openRealmDefaults"
        />
        <q-btn
          color="primary"
          icon="sym_o_add"
          label="Create Scope"
          no-caps
          @click="createDialog = true"
        />
      </div>
    </div>

    <!-- Filters -->
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
      <div class="col-12 col-sm-3">
        <q-select
          v-model="typeFilter"
          :options="typeOptions"
          outlined
          dense
          emit-value
          map-options
          clearable
          label="Type"
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

    <!-- Table -->
    <q-table
      :rows="filteredScopes"
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
          <div class="text-weight-medium">{{ props.row.name }}</div>
          <div v-if="props.row.displayName" class="text-caption text-grey">
            {{ props.row.displayName }}
          </div>
        </q-td>
      </template>

      <template #body-cell-type="props">
        <q-td :props="props">
          <q-badge
            :color="scopeTypeColor(props.row.type)"
            :label="scopeTypeLabel(props.row.type)"
          />
        </q-td>
      </template>

      <template #body-cell-claims="props">
        <q-td :props="props">
          <q-badge
            color="blue-grey"
            :label="`${props.row.claimMappings.length} claims`"
          />
        </q-td>
      </template>

      <template #body-cell-consent="props">
        <q-td :props="props">
          <q-icon
            :name="
              props.row.consentRequired ? 'sym_o_check_circle' : 'sym_o_cancel'
            "
            :color="props.row.consentRequired ? 'positive' : 'grey'"
            size="sm"
          />
        </q-td>
      </template>

      <template #body-cell-token="props">
        <q-td :props="props">
          <q-icon
            :name="
              props.row.includeInTokenScope
                ? 'sym_o_check_circle'
                : 'sym_o_cancel'
            "
            :color="props.row.includeInTokenScope ? 'positive' : 'grey'"
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
        <div class="full-width text-center q-pa-xl">
          <q-icon name="sym_o_verified_user" size="64px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-md">No scopes defined</div>
          <div class="text-body2 text-grey q-mb-lg">
            Create scopes to control what data applications can access.
          </div>
          <q-btn
            color="primary"
            icon="sym_o_add"
            label="Create Scope"
            no-caps
            @click="createDialog = true"
          />
        </div>
      </template>
    </q-table>

    <!-- Create Scope Dialog -->
    <q-dialog v-model="createDialog">
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Create Scope</div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="createForm.name"
            outlined
            dense
            label="Scope name"
            hint='e.g. "profile", "email", "custom:billing"'
            :rules="[(v: string) => !!v || 'Name is required']"
          />
          <q-input
            v-model="createForm.displayName"
            outlined
            dense
            label="Display name"
            hint="Shown on consent screen"
          />
          <q-input
            v-model="createForm.description"
            outlined
            dense
            label="Description"
            type="textarea"
            autogrow
          />
          <q-toggle
            v-model="createForm.consentRequired"
            label="Require consent"
          />
          <q-toggle
            v-model="createForm.includeInTokenScope"
            label="Include in token scope"
          />
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

    <!-- Realm Defaults Dialog -->
    <q-dialog v-model="realmDefaultsDialog">
      <q-card style="min-width: 550px">
        <q-card-section>
          <div class="text-h6">Realm Scope Defaults</div>
          <div class="text-caption text-grey">
            Configure which scopes are granted by default and which are
            available for request.
          </div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="realmDefaultsForm.defaultScopes"
            :options="scopeNameOptions"
            outlined
            dense
            multiple
            use-chips
            label="Default scopes"
            hint="Granted without explicit consent"
          />
          <q-select
            v-model="realmDefaultsForm.optionalScopes"
            :options="scopeNameOptions"
            outlined
            dense
            multiple
            use-chips
            label="Optional scopes"
            hint="Available but not granted by default"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Save"
            no-caps
            :loading="store.loading"
            @click="saveRealmDefaults"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Delete confirmation -->
    <q-dialog v-model="deleteDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Delete Scope</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete scope
            <strong>{{ scopeToDelete?.name }}</strong>?
          </p>
          <p class="text-negative text-caption">
            Applications using this scope will no longer receive its claims.
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
import { useScopesStore } from "src/stores/scopes";
import type { Scope } from "@structured-id/proto/sid/v1/admin/scopes";
import { ScopeType } from "@structured-id/proto/sid/v1/admin/scopes";
import { scopeTypeLabel, scopeTypeColor } from "src/composables/useEnumLabels";

const store = useScopesStore();
const router = useRouter();
const $q = useQuasar();

const search = ref("");
const typeFilter = ref<ScopeType | null>(null);
const createDialog = ref(false);
const realmDefaultsDialog = ref(false);
const deleteDialog = ref(false);
const scopeToDelete = ref<Scope | null>(null);

const createForm = ref({
  name: "",
  displayName: "",
  description: "",
  consentRequired: true,
  includeInTokenScope: true,
});

const realmDefaultsForm = ref({
  defaultScopes: [] as string[],
  optionalScopes: [] as string[],
});

const typeOptions = [
  { label: "OIDC", value: ScopeType.OPENID },
  { label: "Custom", value: ScopeType.CUSTOM },
];

const columns = [
  {
    name: "name",
    label: "Scope",
    field: "name",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "type",
    label: "Type",
    field: "type",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "claims",
    label: "Claims",
    field: "claimMappings",
    align: "left" as const,
  },
  {
    name: "consent",
    label: "Consent",
    field: "consentRequired",
    align: "center" as const,
  },
  {
    name: "token",
    label: "In Token",
    field: "includeInTokenScope",
    align: "center" as const,
  },
  { name: "actions", label: "", field: "id" },
];

const scopeNameOptions = computed(() => store.scopes.map((s) => s.name));

const filteredScopes = computed(() => {
  let result = store.scopes;
  if (search.value) {
    const q = search.value.toLowerCase();
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.displayName.toLowerCase().includes(q),
    );
  }
  if (typeFilter.value !== null) {
    result = result.filter((s) => s.type === typeFilter.value);
  }
  return result;
});

function onRowClick(_evt: Event, row: Scope) {
  router.push({
    name: "admin-scope-detail",
    params: { scopeId: row.id },
  });
}

function confirmDelete(scope: Scope) {
  scopeToDelete.value = scope;
  deleteDialog.value = true;
}

async function executeDelete() {
  if (!scopeToDelete.value) return;
  try {
    await store.deleteScope(scopeToDelete.value.id);
    deleteDialog.value = false;
    $q.notify({ type: "positive", message: "Scope deleted" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Delete failed" });
  }
}

async function executeCreate() {
  try {
    await store.createScope({
      name: createForm.value.name,
      displayName: createForm.value.displayName,
      description: createForm.value.description,
      consentRequired: createForm.value.consentRequired,
      includeInTokenScope: createForm.value.includeInTokenScope,
    });
    createDialog.value = false;
    createForm.value = {
      name: "",
      displayName: "",
      description: "",
      consentRequired: true,
      includeInTokenScope: true,
    };
    $q.notify({ type: "positive", message: "Scope created" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Create failed" });
  }
}

async function openRealmDefaults() {
  await store.fetchRealmDefaults();
  if (store.realmDefaults) {
    realmDefaultsForm.value = {
      defaultScopes: [...store.realmDefaults.defaultScopes],
      optionalScopes: [...store.realmDefaults.optionalScopes],
    };
  }
  realmDefaultsDialog.value = true;
}

async function saveRealmDefaults() {
  try {
    await store.updateRealmDefaults({
      defaultScopes: realmDefaultsForm.value.defaultScopes,
      optionalScopes: realmDefaultsForm.value.optionalScopes,
    });
    realmDefaultsDialog.value = false;
    $q.notify({ type: "positive", message: "Realm defaults updated" });
  } catch {
    $q.notify({
      type: "negative",
      message: store.error || "Update failed",
    });
  }
}

onMounted(() => {
  store.fetchScopes();
});
</script>
