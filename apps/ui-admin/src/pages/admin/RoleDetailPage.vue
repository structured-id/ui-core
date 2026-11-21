<template>
  <q-page padding>
    <!-- Header -->
    <div class="row items-center q-mb-lg">
      <q-btn flat round icon="sym_o_arrow_back" :to="{ name: 'admin-roles' }" />
      <div class="col q-ml-sm">
        <div class="text-h5">
          {{ store.currentRole?.name || "Role" }}
        </div>
        <div
          v-if="store.currentRole?.description"
          class="text-caption text-grey"
        >
          {{ store.currentRole.description }}
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
      <q-tab name="settings" label="Settings" icon="sym_o_settings" />
      <q-tab name="members" label="Members" icon="sym_o_people" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <!-- Settings Tab -->
      <q-tab-panel name="settings">
        <div
          v-if="store.currentRole"
          class="q-gutter-md"
          style="max-width: 600px"
        >
          <q-input
            :model-value="store.currentRole.name"
            outlined
            label="Role name"
            readonly
            dense
            hint="Cannot be changed after creation"
          />
          <q-input
            v-model="settingsForm.description"
            outlined
            label="Description"
            dense
            type="textarea"
            autogrow
          />

          <div class="text-subtitle2">Permissions</div>
          <div class="q-gutter-sm">
            <q-checkbox
              v-for="perm in availablePermissions"
              :key="perm"
              v-model="settingsForm.permissions"
              :val="perm"
              :label="perm"
            />
          </div>

          <q-btn
            color="primary"
            label="Save Changes"
            no-caps
            :loading="store.loading"
            @click="saveSettings"
          />

          <!-- Danger Zone -->
          <q-separator class="q-my-lg" />
          <div class="text-subtitle1 text-negative">Danger Zone</div>
          <q-card flat bordered class="q-pa-md">
            <div class="row items-center justify-between">
              <div>
                <div class="text-subtitle2">Delete this role</div>
                <div class="text-caption text-grey">
                  All users and groups will lose this role assignment.
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

      <!-- Members Tab -->
      <q-tab-panel name="members">
        <div style="max-width: 800px">
          <div class="row items-center q-mb-md">
            <div class="col text-subtitle2">
              Assignments ({{ store.assignments.length }})
            </div>
            <q-btn
              color="primary"
              icon="sym_o_person_add"
              label="Assign"
              no-caps
              dense
              @click="openAssignDialog"
            />
          </div>

          <q-table
            v-if="store.assignments.length"
            :rows="store.assignments"
            :columns="assignmentColumns"
            :row-key="assignmentKey"
            flat
            bordered
            :pagination="{ rowsPerPage: 25 }"
          >
            <template #body-cell-principal="props">
              <q-td :props="props">
                <template v-if="props.row.principal.oneofKind === 'profileId'">
                  <q-icon name="sym_o_person" class="q-mr-xs" />
                </template>
                <template
                  v-else-if="props.row.principal.oneofKind === 'groupId'"
                >
                  <q-icon name="sym_o_group" class="q-mr-xs" />
                </template>
                <template
                  v-else-if="props.row.principal.oneofKind === 'machineUserId'"
                >
                  <q-icon name="sym_o_smart_toy" class="q-mr-xs" />
                </template>
                <code
                  v-if="principalShort(props.row.principal)"
                  class="text-caption"
                  >{{ principalShort(props.row.principal) }}...</code
                >
              </q-td>
            </template>

            <template #body-cell-type="props">
              <q-td :props="props">
                <q-badge
                  :color="principalTypeColor(props.row.principal.oneofKind)"
                  :label="principalTypeLabel(props.row.principal.oneofKind)"
                />
              </q-td>
            </template>

            <template #body-cell-scope="props">
              <q-td :props="props">
                <code v-if="props.row.scope" class="text-caption">{{
                  props.row.scope
                }}</code>
                <span v-else class="text-grey text-caption">Global</span>
              </q-td>
            </template>

            <template #body-cell-expiresAt="props">
              <q-td :props="props">
                <template v-if="props.row.expiresAt">
                  <span class="text-caption">{{
                    formatDate(props.row.expiresAt)
                  }}</span>
                  <q-badge
                    v-if="isExpired(props.row.expiresAt)"
                    color="negative"
                    label="Expired"
                    class="q-ml-xs"
                    dense
                  />
                </template>
                <span v-else class="text-grey text-caption">Never</span>
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props" auto-width>
                <q-btn
                  flat
                  round
                  dense
                  icon="sym_o_person_remove"
                  color="negative"
                  @click="revokeAssignment(props.row)"
                >
                  <q-tooltip>Revoke</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>

          <div v-else class="text-grey q-pa-md text-center">
            No users or groups assigned to this role.
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Assign Role dialog -->
    <q-dialog v-model="assignDialog">
      <q-card style="min-width: 450px">
        <q-card-section>
          <div class="text-h6">Assign Role</div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="assignForm.principalType"
            outlined
            dense
            :options="principalTypeOptions"
            emit-value
            map-options
            label="Principal type"
          />
          <q-input
            v-model="assignForm.principalId"
            outlined
            dense
            label="Principal ID"
            hint="UUID of the user, group, or service account"
          />
          <q-input
            v-model="assignForm.scope"
            outlined
            dense
            label="Scope (optional)"
            hint="Resource constraint, e.g. project:abc123"
            clearable
          />
          <q-input
            v-model="assignForm.expiresAt"
            outlined
            dense
            label="Expires (optional)"
            type="date"
            clearable
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            flat
            color="primary"
            label="Assign"
            :disable="!assignForm.principalId"
            :loading="store.loading"
            @click="executeAssign"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Delete confirmation -->
    <q-dialog v-model="deleteDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Delete Role</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete role
            <strong>{{ store.currentRole?.name }}</strong>?
          </p>
          <p class="text-negative text-caption">
            All assignments will be removed.
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
import { useRolesStore, type RolePrincipal } from "src/stores/roles";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import type { RoleAssignment } from "@structured-id/proto/sid/v1/authz/authz";
import {
  GroupId,
  MachineUserId,
  ProfileId,
  RoleAssignmentId,
  RoleId,
  required,
} from "@structured-id/ids";
import { shown } from "src/ids";

const store = useRolesStore();
const route = useRoute();
const router = useRouter();
const $q = useQuasar();

const tab = ref("settings");
const deleteDialog = ref(false);
const assignDialog = ref(false);

const assignForm = reactive({
  principalType: "profile" as "profile" | "group" | "machineUser",
  principalId: "",
  scope: "",
  expiresAt: "",
});

const principalTypeOptions = [
  { label: "User", value: "profile" },
  { label: "Group", value: "group" },
  { label: "Service Account", value: "machineUser" },
];

const settingsForm = reactive({
  description: "",
  permissions: [] as string[],
});

const availablePermissions = [
  "profiles:read",
  "profiles:write",
  "profiles:delete",
  "clients:read",
  "clients:write",
  "clients:delete",
  "roles:read",
  "roles:write",
  "roles:delete",
  "groups:read",
  "groups:write",
  "groups:delete",
  "sessions:read",
  "sessions:revoke",
  "settings:read",
  "settings:write",
  "audit:read",
];

const assignmentColumns = [
  {
    name: "principal",
    label: "Principal",
    field: "principal",
    align: "left" as const,
  },
  {
    name: "type",
    label: "Type",
    field: "principal",
    align: "left" as const,
  },
  {
    name: "scope",
    label: "Scope",
    field: "scope",
    align: "left" as const,
  },
  {
    name: "expiresAt",
    label: "Expires",
    field: "expiresAt",
    align: "left" as const,
    format: (val: Timestamp | undefined) => formatDate(val),
  },
  {
    name: "createdAt",
    label: "Assigned",
    field: "createdAt",
    align: "left" as const,
    format: (val: Timestamp | undefined) => formatDate(val),
  },
  { name: "actions", label: "", field: "id" },
];

function populateForm() {
  const r = store.currentRole;
  if (!r) return;
  settingsForm.description = r.description || "";
  settingsForm.permissions = [...r.permissions];
}

watch(() => store.currentRole, populateForm, { immediate: true });

const PRINCIPAL_TYPE_LABELS: Record<string, string> = {
  profileId: "User",
  groupId: "Group",
  machineUserId: "Service Account",
};

const PRINCIPAL_TYPE_COLORS: Record<string, string> = {
  profileId: "blue",
  groupId: "teal",
  machineUserId: "orange",
};

function principalTypeLabel(kind: string | undefined): string {
  return (kind && PRINCIPAL_TYPE_LABELS[kind]) ?? "Unknown";
}

function principalTypeColor(kind: string | undefined): string {
  return (kind && PRINCIPAL_TYPE_COLORS[kind]) ?? "grey";
}

function assignmentKey(assignment: RoleAssignment): string {
  return shown(assignment.id);
}

/** The first characters of the assigned principal's id, for display. */
function principalShort(principal: RoleAssignment["principal"]): string {
  switch (principal.oneofKind) {
    case "profileId":
      return shown(principal.profileId).substring(0, 12);
    case "groupId":
      return shown(principal.groupId).substring(0, 12);
    case "machineUserId":
      return shown(principal.machineUserId).substring(0, 12);
    default:
      return "";
  }
}

/** The principal the form names, its id checked as its kind; throws when it is not one. */
function formPrincipal(): RolePrincipal {
  const text = assignForm.principalId.trim();
  switch (assignForm.principalType) {
    case "profile":
      return { kind: "profile", id: ProfileId.parse(text) };
    case "group":
      return { kind: "group", id: GroupId.parse(text) };
    case "machineUser":
      return { kind: "machineUser", id: MachineUserId.parse(text) };
  }
}

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  const d = new Date(Number(ts.seconds) * 1000);
  return d.toLocaleDateString();
}

function isExpired(ts: Timestamp | undefined): boolean {
  if (!ts) return false;
  return new Date(Number(ts.seconds) * 1000) < new Date();
}

async function saveSettings() {
  if (!store.currentRole) return;
  try {
    await store.updateRole(required(RoleId, store.currentRole.id), {
      description: settingsForm.description || undefined,
      permissions: settingsForm.permissions,
    });
    $q.notify({ type: "positive", message: "Role updated" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Update failed" });
  }
}

async function revokeAssignment(assignment: RoleAssignment) {
  try {
    await store.revokeAssignment(required(RoleAssignmentId, assignment.id));
    $q.notify({ type: "positive", message: "Assignment revoked" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Revoke failed" });
  }
}

function openAssignDialog() {
  assignForm.principalType = "profile";
  assignForm.principalId = "";
  assignForm.scope = "";
  assignForm.expiresAt = "";
  assignDialog.value = true;
}

async function executeAssign() {
  if (!store.currentRole || !assignForm.principalId) return;
  let principal: RolePrincipal;
  try {
    principal = formPrincipal();
  } catch {
    $q.notify({
      type: "negative",
      message: "The principal ID is not an identifier of its type",
    });
    return;
  }
  try {
    let expiresAt: Timestamp | undefined;
    if (assignForm.expiresAt) {
      const d = new Date(assignForm.expiresAt);
      expiresAt = {
        seconds: BigInt(Math.floor(d.getTime() / 1000)),
        nanos: 0,
      };
    }
    await store.assignRole({
      roleId: required(RoleId, store.currentRole.id),
      principal,
      scope: assignForm.scope || undefined,
      expiresAt,
    });
    assignDialog.value = false;
    $q.notify({ type: "positive", message: "Role assigned" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Assign failed" });
  }
}

function confirmDelete() {
  deleteDialog.value = true;
}

async function executeDelete() {
  if (!store.currentRole) return;
  try {
    await store.deleteRole(required(RoleId, store.currentRole.id));
    deleteDialog.value = false;
    $q.notify({ type: "positive", message: "Role deleted" });
    router.push({ name: "admin-roles" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Delete failed" });
  }
}

onMounted(async () => {
  let roleId: RoleId;
  try {
    roleId = RoleId.parse(route.params.roleId as string);
  } catch {
    store.error = "This address names no role";
    return;
  }
  await store.getRole(roleId);
  store.fetchRoleAssignments(roleId);
});
</script>
