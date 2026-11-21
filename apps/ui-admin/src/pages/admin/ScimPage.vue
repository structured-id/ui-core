<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h4">SCIM Provisioning</div>
        <div class="text-caption text-grey">
          Inbound user provisioning via SCIM 2.0 (RFC 7644)
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

    <q-tabs v-model="tab" dense align="left" class="q-mb-lg" no-caps>
      <q-tab name="users" label="Users" icon="sym_o_people" />
      <q-tab name="groups" label="Groups" icon="sym_o_workspaces" />
      <q-tab name="config" label="Configuration" icon="sym_o_settings" />
      <q-tab name="schemas" label="Schemas" icon="sym_o_schema" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <!-- ═══════ Users Tab ═══════ -->
      <q-tab-panel name="users">
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12 col-sm-4">
            <q-input
              v-model="userFilter"
              outlined
              dense
              placeholder='SCIM filter (e.g. userName eq "alice")'
              clearable
              @keyup.enter="store.fetchUsers(userFilter)"
            >
              <template #prepend>
                <q-icon name="sym_o_filter_alt" />
              </template>
            </q-input>
          </div>
          <div class="col-auto">
            <q-btn
              color="primary"
              icon="sym_o_search"
              label="Search"
              no-caps
              @click="store.fetchUsers(userFilter)"
            />
          </div>
        </div>

        <q-table
          :rows="store.users"
          :columns="userColumns"
          row-key="id"
          flat
          bordered
          :pagination="{ rowsPerPage: 25 }"
        >
          <template #body-cell-active="props">
            <q-td :props="props">
              <q-badge
                :color="props.row.active ? 'positive' : 'grey'"
                :label="props.row.active ? 'Active' : 'Inactive'"
              />
            </q-td>
          </template>
          <template #body-cell-emails="props">
            <q-td :props="props">
              <span v-if="props.row.emails.length" class="text-caption">
                {{ props.row.emails[0].value }}
                <q-badge
                  v-if="props.row.emails.length > 1"
                  :label="`+${props.row.emails.length - 1}`"
                  color="grey"
                  dense
                  class="q-ml-xs"
                />
              </span>
              <span v-else class="text-grey text-caption">—</span>
            </q-td>
          </template>
          <template #body-cell-groups="props">
            <q-td :props="props">
              <q-badge
                v-if="props.row.groups.length"
                :label="props.row.groups.length"
                color="primary"
              />
              <span v-else class="text-grey text-caption">—</span>
            </q-td>
          </template>
          <template #body-cell-meta="props">
            <q-td :props="props">
              <span v-if="props.row.meta" class="text-caption text-grey">
                {{ formatTimestamp(props.row.meta.lastModified) }}
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
                @click="confirmDeleteUser(props.row)"
              >
                <q-tooltip>Delete</q-tooltip>
              </q-btn>
            </q-td>
          </template>
          <template #no-data>
            <div class="full-width text-center q-pa-xl">
              <q-icon name="sym_o_person_search" size="64px" color="grey-4" />
              <div class="text-h6 text-grey-6 q-mt-md">No SCIM users</div>
              <div class="text-body2 text-grey">
                Users provisioned via SCIM will appear here.
              </div>
            </div>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- ═══════ Groups Tab ═══════ -->
      <q-tab-panel name="groups">
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12 col-sm-4">
            <q-input
              v-model="groupFilter"
              outlined
              dense
              placeholder='SCIM filter (e.g. displayName co "eng")'
              clearable
              @keyup.enter="store.fetchGroups(groupFilter)"
            >
              <template #prepend>
                <q-icon name="sym_o_filter_alt" />
              </template>
            </q-input>
          </div>
          <div class="col-auto">
            <q-btn
              color="primary"
              icon="sym_o_search"
              label="Search"
              no-caps
              @click="store.fetchGroups(groupFilter)"
            />
          </div>
        </div>

        <q-table
          :rows="store.groups"
          :columns="groupColumns"
          row-key="id"
          flat
          bordered
          :pagination="{ rowsPerPage: 25 }"
        >
          <template #body-cell-members="props">
            <q-td :props="props">
              <q-badge
                v-if="props.row.members.length"
                :label="props.row.members.length"
                color="primary"
              />
              <span v-else class="text-grey text-caption">0</span>
            </q-td>
          </template>
          <template #body-cell-meta="props">
            <q-td :props="props">
              <span v-if="props.row.meta" class="text-caption text-grey">
                {{ formatTimestamp(props.row.meta.lastModified) }}
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
                @click="confirmDeleteGroup(props.row)"
              >
                <q-tooltip>Delete</q-tooltip>
              </q-btn>
            </q-td>
          </template>
          <template #no-data>
            <div class="full-width text-center q-pa-xl">
              <q-icon name="sym_o_workspaces" size="64px" color="grey-4" />
              <div class="text-h6 text-grey-6 q-mt-md">No SCIM groups</div>
              <div class="text-body2 text-grey">
                Groups provisioned via SCIM will appear here.
              </div>
            </div>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- ═══════ Configuration Tab ═══════ -->
      <q-tab-panel name="config">
        <div style="max-width: 800px">
          <div v-if="store.providerConfig" class="q-gutter-md">
            <!-- Endpoint Info -->
            <q-card flat bordered>
              <q-card-section>
                <div class="text-subtitle1 q-mb-sm">SCIM Endpoint</div>
                <q-input
                  :model-value="scimEndpointUrl"
                  outlined
                  dense
                  readonly
                  label="Base URL"
                >
                  <template #append>
                    <q-btn
                      flat
                      round
                      dense
                      icon="sym_o_content_copy"
                      @click="copyToClipboard(scimEndpointUrl)"
                    />
                  </template>
                </q-input>
                <div
                  v-if="store.providerConfig.documentationUri"
                  class="q-mt-sm"
                >
                  <a
                    :href="store.providerConfig.documentationUri"
                    target="_blank"
                    class="text-primary"
                  >
                    Documentation
                  </a>
                </div>
              </q-card-section>
            </q-card>

            <!-- Supported Features -->
            <q-card flat bordered>
              <q-card-section>
                <div class="text-subtitle1 q-mb-md">Supported Features</div>
                <div class="row q-col-gutter-md">
                  <div
                    v-for="feat in configFeatures"
                    :key="feat.label"
                    class="col-6 col-sm-4"
                  >
                    <div class="row items-center no-wrap">
                      <q-icon
                        :name="
                          feat.supported ? 'sym_o_check_circle' : 'sym_o_cancel'
                        "
                        :color="feat.supported ? 'positive' : 'grey-5'"
                        size="sm"
                        class="q-mr-xs"
                      />
                      <span class="text-body2">{{ feat.label }}</span>
                    </div>
                  </div>
                </div>
              </q-card-section>
            </q-card>

            <!-- Authentication Schemes -->
            <q-card
              v-if="store.providerConfig.authenticationSchemes.length"
              flat
              bordered
            >
              <q-card-section>
                <div class="text-subtitle1 q-mb-md">Authentication Schemes</div>
                <q-list dense separator>
                  <q-item
                    v-for="scheme in store.providerConfig.authenticationSchemes"
                    :key="scheme.type"
                  >
                    <q-item-section>
                      <q-item-label>
                        {{ scheme.name }}
                        <q-badge
                          v-if="scheme.primary"
                          label="Primary"
                          color="primary"
                          dense
                          class="q-ml-xs"
                        />
                      </q-item-label>
                      <q-item-label caption>
                        {{ scheme.description }}
                      </q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <code class="text-caption">{{ scheme.type }}</code>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>

            <!-- Resource Types -->
            <q-card v-if="store.resourceTypes.length" flat bordered>
              <q-card-section>
                <div class="text-subtitle1 q-mb-md">Resource Types</div>
                <q-list dense separator>
                  <q-item v-for="rt in store.resourceTypes" :key="rt.id">
                    <q-item-section>
                      <q-item-label>{{ rt.name }}</q-item-label>
                      <q-item-label caption>
                        {{ rt.description }}
                      </q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <code class="text-caption">{{ rt.endpoint }}</code>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>
          </div>
          <div v-else-if="!store.loading" class="text-grey text-center q-pa-xl">
            Unable to load SCIM configuration.
          </div>
        </div>
      </q-tab-panel>

      <!-- ═══════ Schemas Tab ═══════ -->
      <q-tab-panel name="schemas">
        <div style="max-width: 900px">
          <div v-if="store.schemas.length" class="q-gutter-md">
            <q-expansion-item
              v-for="schema in store.schemas"
              :key="schema.id"
              group="schemas"
              :label="schema.name"
              :caption="schema.id"
              header-class="text-weight-medium"
              bordered
              expand-separator
            >
              <q-card>
                <q-card-section
                  v-if="schema.description"
                  class="text-body2 text-grey-7"
                >
                  {{ schema.description }}
                </q-card-section>
                <q-table
                  v-if="schema.attributes.length"
                  :rows="schema.attributes"
                  :columns="schemaAttributeColumns"
                  row-key="name"
                  flat
                  dense
                  :pagination="{ rowsPerPage: 50 }"
                >
                  <template #body-cell-required="props">
                    <q-td :props="props">
                      <q-icon
                        v-if="props.row.required"
                        name="sym_o_check"
                        color="positive"
                        size="xs"
                      />
                    </q-td>
                  </template>
                  <template #body-cell-mutability="props">
                    <q-td :props="props">
                      <q-badge
                        :color="mutabilityColor(props.row.mutability)"
                        :label="props.row.mutability"
                        dense
                      />
                    </q-td>
                  </template>
                </q-table>
              </q-card>
            </q-expansion-item>
          </div>
          <div v-else-if="!store.loading" class="text-grey text-center q-pa-xl">
            No SCIM schemas available.
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Delete User Confirmation -->
    <q-dialog v-model="deleteUserDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Delete SCIM User</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete user
            <strong>{{ userToDelete?.userName }}</strong>?
          </p>
          <p class="text-negative text-caption">
            This will deprovision the user from SID.
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            flat
            color="negative"
            label="Delete"
            @click="executeDeleteUser"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Delete Group Confirmation -->
    <q-dialog v-model="deleteGroupDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Delete SCIM Group</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete group
            <strong>{{ groupToDelete?.displayName }}</strong>?
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            flat
            color="negative"
            label="Delete"
            @click="executeDeleteGroup"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { copyToClipboard, useQuasar } from "quasar";
import { useScimStore } from "src/stores/scim";
import type {
  ScimUser,
  ScimGroup,
} from "@structured-id/proto/sid/v1/scim/scim";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";

const store = useScimStore();
const $q = useQuasar();

const tab = ref("users");
const userFilter = ref("");
const groupFilter = ref("");
const deleteUserDialog = ref(false);
const deleteGroupDialog = ref(false);
const userToDelete = ref<ScimUser | null>(null);
const groupToDelete = ref<ScimGroup | null>(null);

const scimEndpointUrl = computed(() => `${window.location.origin}/scim/v2`);

const configFeatures = computed(() => {
  const c = store.providerConfig;
  if (!c) return [];
  return [
    { label: "PATCH", supported: c.patch?.supported ?? false },
    { label: "Bulk", supported: c.bulk?.supported ?? false },
    { label: "Filter", supported: c.filter?.supported ?? false },
    {
      label: "Change Password",
      supported: c.changePassword?.supported ?? false,
    },
    { label: "Sort", supported: c.sort?.supported ?? false },
    { label: "ETag", supported: c.etag?.supported ?? false },
  ];
});

const userColumns = [
  {
    name: "userName",
    label: "Username",
    field: "userName",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "displayName",
    label: "Display Name",
    field: "displayName",
    align: "left" as const,
  },
  {
    name: "emails",
    label: "Email",
    field: "emails",
    align: "left" as const,
  },
  {
    name: "department",
    label: "Department",
    field: "department",
    align: "left" as const,
  },
  {
    name: "active",
    label: "Status",
    field: "active",
    align: "center" as const,
  },
  {
    name: "groups",
    label: "Groups",
    field: "groups",
    align: "center" as const,
  },
  {
    name: "meta",
    label: "Last Modified",
    field: "meta",
    align: "left" as const,
  },
  { name: "actions", label: "", field: "id" },
];

const groupColumns = [
  {
    name: "displayName",
    label: "Name",
    field: "displayName",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "members",
    label: "Members",
    field: "members",
    align: "center" as const,
  },
  {
    name: "meta",
    label: "Last Modified",
    field: "meta",
    align: "left" as const,
  },
  { name: "actions", label: "", field: "id" },
];

const schemaAttributeColumns = [
  {
    name: "name",
    label: "Name",
    field: "name",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "type",
    label: "Type",
    field: "type",
    align: "left" as const,
  },
  {
    name: "multiValued",
    label: "Multi",
    field: "multiValued",
    align: "center" as const,
    format: (v: boolean) => (v ? "Yes" : "No"),
  },
  {
    name: "required",
    label: "Required",
    field: "required",
    align: "center" as const,
  },
  {
    name: "mutability",
    label: "Mutability",
    field: "mutability",
    align: "left" as const,
  },
  {
    name: "returned",
    label: "Returned",
    field: "returned",
    align: "left" as const,
  },
];

const MUTABILITY_COLORS: Record<string, string> = {
  readWrite: "blue",
  readOnly: "grey",
  immutable: "orange",
  writeOnly: "purple",
};

function mutabilityColor(m: string): string {
  return MUTABILITY_COLORS[m] ?? "grey";
}

function formatTimestamp(ts?: Timestamp): string {
  if (!ts) return "—";
  return new Date(Number(ts.seconds) * 1000).toLocaleString();
}

function confirmDeleteUser(user: ScimUser) {
  userToDelete.value = user;
  deleteUserDialog.value = true;
}

async function executeDeleteUser() {
  if (!userToDelete.value) return;
  try {
    await store.deleteUser(userToDelete.value.id);
    deleteUserDialog.value = false;
    $q.notify({ type: "positive", message: "SCIM user deleted" });
  } catch {
    $q.notify({
      type: "negative",
      message: store.error || "Delete failed",
    });
  }
}

function confirmDeleteGroup(group: ScimGroup) {
  groupToDelete.value = group;
  deleteGroupDialog.value = true;
}

async function executeDeleteGroup() {
  if (!groupToDelete.value) return;
  try {
    await store.deleteGroup(groupToDelete.value.id);
    deleteGroupDialog.value = false;
    $q.notify({ type: "positive", message: "SCIM group deleted" });
  } catch {
    $q.notify({
      type: "negative",
      message: store.error || "Delete failed",
    });
  }
}

async function loadTabData(tabName: string) {
  switch (tabName) {
    case "users":
      await store.fetchUsers();
      break;
    case "groups":
      await store.fetchGroups();
      break;
    case "config":
      await store.fetchProviderConfig();
      store.fetchResourceTypes();
      break;
    case "schemas":
      await store.fetchSchemas();
      break;
  }
}

watch(tab, (newTab) => loadTabData(newTab));

onMounted(() => {
  loadTabData(tab.value);
});
</script>
