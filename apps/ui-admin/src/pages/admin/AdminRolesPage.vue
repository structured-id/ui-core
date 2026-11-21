<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none">Admin Roles & Delegation</h5>
        <p class="text-caption text-grey q-mb-none">
          Manage admin roles, assignments, and session security.
        </p>
      </div>
    </div>

    <q-banner v-if="store.error" type="negative" class="q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <q-tabs
      v-model="tab"
      align="left"
      active-color="primary"
      indicator-color="primary"
      class="q-mb-md"
    >
      <q-tab name="roles" icon="sym_o_shield" label="Roles" />
      <q-tab
        name="assignments"
        icon="sym_o_assignment_ind"
        label="Assignments"
      />
      <q-tab name="security" icon="sym_o_security" label="Session Security" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <!-- ═══ Tab 1: Role Catalog ═══ -->
      <q-tab-panel name="roles" class="q-pa-none">
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12 col-sm-3">
            <q-select
              v-model="roleScopeFilter"
              label="Scope"
              :options="roleScopeOptions"
              dense
              outlined
              clearable
              emit-value
              map-options
              @update:model-value="loadRoles"
            />
          </div>
        </div>

        <q-card flat bordered>
          <q-table
            :rows="store.roles"
            :columns="roleColumns"
            row-key="roleId"
            :loading="store.loading"
            flat
            :pagination="{ rowsPerPage: 25 }"
          >
            <template #body-cell-name="props">
              <q-td :props="props">
                <div class="row items-center q-gutter-sm">
                  <q-icon
                    :name="props.row.builtIn ? 'sym_o_lock' : 'sym_o_tune'"
                    :color="props.row.builtIn ? 'grey' : 'primary'"
                    size="sm"
                  />
                  <div>
                    <div class="text-weight-medium">{{ props.row.name }}</div>
                    <div class="text-caption text-grey">
                      {{ props.row.description }}
                    </div>
                  </div>
                </div>
              </q-td>
            </template>

            <template #body-cell-scope="props">
              <q-td :props="props">
                <q-badge
                  :color="adminRoleScopeColor(props.row.scope)"
                  :label="adminRoleScopeLabel(props.row.scope)"
                />
              </q-td>
            </template>

            <template #body-cell-type="props">
              <q-td :props="props">
                <q-chip
                  dense
                  size="sm"
                  :icon="props.row.builtIn ? 'sym_o_lock' : 'sym_o_tune'"
                  :label="props.row.builtIn ? 'Built-in' : 'Custom'"
                  :color="props.row.builtIn ? 'grey-4' : 'blue-2'"
                  :text-color="props.row.builtIn ? 'grey-8' : 'primary'"
                />
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props">
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="sym_o_visibility"
                  @click="viewRolePermissions(props.row)"
                >
                  <q-tooltip>View Permissions</q-tooltip>
                </q-btn>
              </q-td>
            </template>

            <template #no-data>
              <div class="full-width text-center q-pa-xl">
                <q-icon name="sym_o_shield" size="64px" color="grey-4" />
                <div class="text-h6 text-grey-6 q-mt-md">No admin roles</div>
              </div>
            </template>
          </q-table>
        </q-card>

        <!-- Permissions Dialog -->
        <q-dialog v-model="showPermissionsDialog">
          <q-card style="min-width: 500px; max-width: 700px">
            <q-card-section class="row items-center">
              <div>
                <div class="text-h6">{{ selectedRole?.name }}</div>
                <div class="text-caption text-grey">
                  {{ selectedRole?.description }}
                </div>
              </div>
              <q-space />
              <q-badge
                :color="
                  adminRoleScopeColor(
                    selectedRole?.scope ?? AdminRoleScope.UNSPECIFIED,
                  )
                "
                :label="
                  adminRoleScopeLabel(
                    selectedRole?.scope ?? AdminRoleScope.UNSPECIFIED,
                  )
                "
              />
            </q-card-section>
            <q-separator />
            <q-card-section class="scroll" style="max-height: 60vh">
              <div class="text-subtitle2 q-mb-sm">
                Permissions ({{ selectedRole?.permissions.length ?? 0 }})
              </div>
              <q-list dense separator>
                <q-item
                  v-for="perm in selectedRole?.permissions"
                  :key="perm"
                  dense
                >
                  <q-item-section avatar>
                    <q-icon name="sym_o_check" color="positive" size="xs" />
                  </q-item-section>
                  <q-item-section>
                    <code class="text-body2">{{ perm }}</code>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
            <q-card-actions align="right">
              <q-btn flat label="Close" v-close-popup />
            </q-card-actions>
          </q-card>
        </q-dialog>
      </q-tab-panel>

      <!-- ═══ Tab 2: Assignments ═══ -->
      <q-tab-panel name="assignments" class="q-pa-none">
        <!-- Filters + Assign -->
        <div class="row q-col-gutter-sm q-mb-md items-end">
          <div class="col-12 col-sm-3">
            <q-select
              v-model="assignmentRoleFilter"
              label="Role"
              :options="roleOptions"
              dense
              outlined
              clearable
              emit-value
              map-options
              @update:model-value="loadAssignments"
            />
          </div>
          <div class="col-12 col-sm-2">
            <q-select
              v-model="assignmentPrincipalTypeFilter"
              label="Principal Type"
              :options="principalTypeOptions"
              dense
              outlined
              clearable
              emit-value
              map-options
              @update:model-value="loadAssignments"
            />
          </div>
          <div class="col-12 col-sm-3">
            <q-input
              v-model="assignmentSearch"
              label="Search"
              dense
              outlined
              clearable
              debounce="300"
              @update:model-value="loadAssignments"
            >
              <template #prepend>
                <q-icon name="sym_o_search" />
              </template>
            </q-input>
          </div>
          <q-space />
          <div class="col-auto">
            <q-btn
              color="primary"
              icon="sym_o_person_add"
              label="Assign Role"
              @click="showAssignDialog = true"
            />
          </div>
        </div>

        <q-card flat bordered>
          <q-table
            :rows="store.assignments"
            :columns="assignmentColumns"
            row-key="assignmentId"
            :loading="store.loading"
            flat
            :pagination="{ rowsPerPage: 25 }"
          >
            <template #body-cell-principal="props">
              <q-td :props="props">
                <div class="row items-center q-gutter-sm">
                  <q-icon
                    :name="adminPrincipalTypeIcon(props.row.principalType)"
                    size="sm"
                  />
                  <div>
                    <div class="text-weight-medium">
                      {{ props.row.principalName }}
                    </div>
                    <div class="text-caption text-grey">
                      {{ adminPrincipalTypeLabel(props.row.principalType) }}
                    </div>
                  </div>
                </div>
              </q-td>
            </template>

            <template #body-cell-role="props">
              <q-td :props="props">
                {{ props.row.roleName }}
                <q-badge
                  :color="adminRoleScopeColor(props.row.roleScope)"
                  :label="adminRoleScopeLabel(props.row.roleScope)"
                  class="q-ml-xs"
                />
              </q-td>
            </template>

            <template #body-cell-scope="props">
              <q-td :props="props">
                {{ props.row.scopeTargetName || "All" }}
              </q-td>
            </template>

            <template #body-cell-assignmentType="props">
              <q-td :props="props">
                <q-chip
                  dense
                  size="sm"
                  :label="assignmentTypeLabel(props.row.assignmentType)"
                  :color="
                    props.row.assignmentType === AssignmentType.TIME_LIMITED
                      ? 'orange-2'
                      : 'grey-3'
                  "
                  :text-color="
                    props.row.assignmentType === AssignmentType.TIME_LIMITED
                      ? 'orange-9'
                      : 'grey-8'
                  "
                />
                <div
                  v-if="props.row.expiresAt"
                  class="text-caption text-orange"
                >
                  Expires {{ formatTimestamp(props.row.expiresAt) }}
                </div>
              </q-td>
            </template>

            <template #body-cell-assignedAt="props">
              <q-td :props="props">
                <div>{{ formatTimestamp(props.row.assignedAt) }}</div>
                <div class="text-caption text-grey">
                  by {{ props.row.assignedBy }}
                </div>
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props">
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="sym_o_delete"
                  color="negative"
                  @click="
                    handleRevoke(
                      props.row.assignmentId,
                      props.row.principalName,
                    )
                  "
                >
                  <q-tooltip>Revoke</q-tooltip>
                </q-btn>
              </q-td>
            </template>

            <template #no-data>
              <div class="full-width text-center q-pa-xl">
                <q-icon
                  name="sym_o_assignment_ind"
                  size="64px"
                  color="grey-4"
                />
                <div class="text-h6 text-grey-6 q-mt-md">No assignments</div>
              </div>
            </template>
          </q-table>
        </q-card>

        <!-- Effective Permissions -->
        <q-card flat bordered class="q-mt-md">
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Effective Permissions</div>
            <div class="row q-col-gutter-sm items-end">
              <div class="col-12 col-sm-4">
                <q-input
                  v-model="effectivePermsPrincipalId"
                  label="Principal ID"
                  dense
                  outlined
                  placeholder="Enter user/group/machine user ID"
                />
              </div>
              <div class="col-auto">
                <q-btn
                  color="primary"
                  label="Load"
                  flat
                  :disable="!effectivePermsPrincipalId"
                  @click="loadEffectivePermissions"
                />
              </div>
            </div>
          </q-card-section>
          <q-table
            v-if="store.effectivePermissions.length > 0"
            :rows="store.effectivePermissions"
            :columns="effectivePermColumns"
            row-key="permission"
            flat
            dense
            :pagination="{ rowsPerPage: 0 }"
            hide-bottom
          />
        </q-card>

        <!-- Assign Dialog -->
        <q-dialog v-model="showAssignDialog" persistent>
          <q-card style="min-width: 450px">
            <q-card-section>
              <div class="text-h6">Assign Admin Role</div>
            </q-card-section>
            <q-card-section>
              <q-input
                v-model="assignForm.principalId"
                label="Principal ID"
                outlined
                dense
                class="q-mb-sm"
                :rules="[(v) => !!v || 'Required']"
              />
              <q-select
                v-model="assignForm.principalType"
                label="Principal Type"
                :options="principalTypeOptions"
                outlined
                dense
                emit-value
                map-options
                class="q-mb-sm"
              />
              <q-select
                v-model="assignForm.roleId"
                label="Role"
                :options="roleOptions"
                outlined
                dense
                emit-value
                map-options
                class="q-mb-sm"
                :rules="[(v) => !!v || 'Required']"
              />
              <q-input
                v-model="assignForm.scopeTargetId"
                label="Scope Target ID (optional)"
                outlined
                dense
                hint="Site or Org ID. Leave empty for instance-wide."
                class="q-mb-sm"
              />
              <q-select
                v-model="assignForm.assignmentType"
                label="Duration"
                :options="assignmentTypeOptions"
                outlined
                dense
                emit-value
                map-options
                class="q-mb-sm"
              />
              <q-input
                v-if="assignForm.assignmentType === AssignmentType.TIME_LIMITED"
                v-model="assignForm.expiresAt"
                label="Expires At"
                type="date"
                outlined
                dense
              />
            </q-card-section>
            <q-card-actions align="right">
              <q-btn flat label="Cancel" v-close-popup />
              <q-btn
                color="primary"
                label="Assign"
                :loading="store.saving"
                @click="handleAssign"
              />
            </q-card-actions>
          </q-card>
        </q-dialog>
      </q-tab-panel>

      <!-- ═══ Tab 3: Session Security ═══ -->
      <q-tab-panel name="security" class="q-pa-none">
        <div class="row q-col-gutter-md">
          <!-- Session Policy -->
          <div class="col-12 col-md-6">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-subtitle1 q-mb-md">Admin Session Policy</div>

                <q-input
                  v-model.number="policyForm.sessionMaxMinutes"
                  label="Session Max (minutes)"
                  outlined
                  dense
                  type="number"
                  class="q-mb-sm"
                  hint="Default: 480 (8 hours)"
                />
                <q-input
                  v-model.number="policyForm.idleTimeoutMinutes"
                  label="Idle Timeout (minutes)"
                  outlined
                  dense
                  type="number"
                  class="q-mb-sm"
                  hint="Default: 30"
                />
                <q-input
                  v-model.number="policyForm.elevationTtlMinutes"
                  label="Elevation TTL (minutes)"
                  outlined
                  dense
                  type="number"
                  class="q-mb-sm"
                  hint="Default: 15"
                />
                <q-select
                  v-model="policyForm.requiredMfaMethod"
                  label="Required MFA Method"
                  :options="mfaMethodOptions"
                  outlined
                  dense
                  emit-value
                  map-options
                  class="q-mb-sm"
                />
                <q-toggle
                  v-model="policyForm.ipBinding"
                  label="Bind admin session to IP address"
                />
              </q-card-section>
              <q-card-actions>
                <q-btn
                  color="primary"
                  label="Save Policy"
                  :loading="store.saving"
                  @click="handleSavePolicy"
                />
              </q-card-actions>
            </q-card>

            <!-- Assurance Levels Reference -->
            <q-card flat bordered class="q-mt-md">
              <q-card-section>
                <div class="text-subtitle2 q-mb-sm">Assurance Levels</div>
                <q-list dense separator>
                  <q-item
                    v-for="level in assuranceLevels"
                    :key="level.level"
                    dense
                  >
                    <q-item-section avatar>
                      <q-badge
                        :color="assuranceLevelColor(level.level)"
                        :label="assuranceLevelLabel(level.level)"
                      />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label caption>{{
                        level.achievedBy
                      }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <span class="text-caption text-grey">{{
                        level.requiredFor
                      }}</span>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>
          </div>

          <!-- Active Admin Sessions -->
          <div class="col-12 col-md-6">
            <q-card flat bordered>
              <q-card-section class="row items-center">
                <div class="text-subtitle1">Active Admin Sessions</div>
                <q-space />
                <q-btn
                  flat
                  dense
                  color="negative"
                  icon="sym_o_logout"
                  label="Revoke All"
                  @click="handleRevokeAllSessions"
                />
              </q-card-section>
              <q-separator />
              <q-list separator>
                <q-item
                  v-for="session in store.activeSessions"
                  :key="session.sessionId"
                >
                  <q-item-section avatar>
                    <q-badge
                      :color="assuranceLevelColor(session.assurance)"
                      :label="assuranceLevelLabel(session.assurance)"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ session.adminName }}</q-item-label>
                    <q-item-label caption>
                      {{ session.roleName }} &middot; {{ session.ipAddress }}
                    </q-item-label>
                    <q-item-label caption>
                      Started {{ formatTimestamp(session.startedAt) }}
                      <span v-if="session.elevatedUntil">
                        &middot; Elevated until
                        {{ formatTimestamp(session.elevatedUntil) }}
                      </span>
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn
                      flat
                      dense
                      round
                      size="sm"
                      icon="sym_o_logout"
                      color="negative"
                      @click="handleRevokeSession(session.sessionId)"
                    >
                      <q-tooltip>Revoke</q-tooltip>
                    </q-btn>
                  </q-item-section>
                </q-item>

                <q-item v-if="store.activeSessions.length === 0">
                  <q-item-section class="text-center text-grey q-pa-md">
                    No active admin sessions
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useAdminRolesStore } from "#admin/stores/adminRoles";
import {
  AdminRoleScope,
  AdminPrincipalType,
  AssignmentType,
  AssuranceLevel,
  RequiredMfaMethod,
} from "@structured-id/proto/sid/v1/admin/admin_roles";
import type { AdminRole } from "@structured-id/proto/sid/v1/admin/admin_roles";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import {
  adminRoleScopeLabel,
  adminRoleScopeColor,
  assignmentTypeLabel,
  adminPrincipalTypeLabel,
  adminPrincipalTypeIcon,
  assuranceLevelLabel,
  assuranceLevelColor,
  requiredMfaMethodLabel,
} from "#admin/composables/useEnumLabels";
import { useQuasar } from "quasar";

const $q = useQuasar();
const store = useAdminRolesStore();

const tab = ref("roles");

// ── Role state ──
const roleScopeFilter = ref<AdminRoleScope | null>(null);
const showPermissionsDialog = ref(false);
const selectedRole = ref<AdminRole | null>(null);

const roleScopeOptions = [
  { label: "Instance", value: AdminRoleScope.INSTANCE },
  { label: "Site", value: AdminRoleScope.SITE },
  { label: "Organization", value: AdminRoleScope.ORGANIZATION },
  { label: "Profile", value: AdminRoleScope.PROFILE },
];

// ── Assignment state ──
const assignmentRoleFilter = ref<string | null>(null);
const assignmentPrincipalTypeFilter = ref<AdminPrincipalType | null>(null);
const assignmentSearch = ref("");
const showAssignDialog = ref(false);
const effectivePermsPrincipalId = ref("");

const principalTypeOptions = [
  { label: "User", value: AdminPrincipalType.USER },
  { label: "Group", value: AdminPrincipalType.GROUP },
  { label: "Service Account", value: AdminPrincipalType.MACHINE_USER },
];

const assignmentTypeOptions = [
  { label: "Permanent", value: AssignmentType.PERMANENT },
  { label: "Time Limited", value: AssignmentType.TIME_LIMITED },
];

const assignForm = reactive({
  principalId: "",
  principalType: AdminPrincipalType.USER,
  roleId: "",
  scopeTargetId: "",
  assignmentType: AssignmentType.PERMANENT,
  expiresAt: "",
});

const roleOptions = computed(() =>
  store.roles.map((r) => ({ label: r.name, value: r.roleId })),
);

// ── Session Security state ──
const policyForm = reactive({
  sessionMaxMinutes: 480,
  idleTimeoutMinutes: 30,
  elevationTtlMinutes: 15,
  requiredMfaMethod: RequiredMfaMethod.WEBAUTHN,
  ipBinding: true,
});

const mfaMethodOptions = [
  RequiredMfaMethod.ANY_MFA,
  RequiredMfaMethod.WEBAUTHN,
  RequiredMfaMethod.HARDWARE_KEY_ONLY,
].map((value) => ({ label: requiredMfaMethodLabel(value), value }));

const assuranceLevels = [
  {
    level: AssuranceLevel.BASIC,
    achievedBy: "Single factor (password)",
    requiredFor: "Read-only dashboard",
  },
  {
    level: AssuranceLevel.STANDARD,
    achievedBy: "MFA (password + TOTP/WebAuthn)",
    requiredFor: "Normal operations",
  },
  {
    level: AssuranceLevel.ELEVATED,
    achievedBy: "Phishing-resistant MFA",
    requiredFor: "Admin write operations",
  },
  {
    level: AssuranceLevel.CRITICAL,
    achievedBy: "Re-auth + hardware key",
    requiredFor: "Key destruction, role assignment",
  },
];

// ── Table columns ──

const roleColumns = [
  {
    name: "name",
    label: "Role",
    field: "name",
    align: "left" as const,
    sortable: true,
  },
  { name: "scope", label: "Scope", field: "scope", align: "center" as const },
  { name: "type", label: "Type", field: "builtIn", align: "center" as const },
  {
    name: "assignedCount",
    label: "Assigned",
    field: "assignedCount",
    align: "center" as const,
    sortable: true,
  },
  { name: "actions", label: "", field: "actions", align: "right" as const },
];

const assignmentColumns = [
  {
    name: "principal",
    label: "Principal",
    field: "principalName",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "role",
    label: "Role",
    field: "roleName",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "scope",
    label: "Scope",
    field: "scopeTargetName",
    align: "left" as const,
  },
  {
    name: "assignmentType",
    label: "Duration",
    field: "assignmentType",
    align: "center" as const,
  },
  {
    name: "assignedAt",
    label: "Assigned",
    field: "assignedAt",
    align: "left" as const,
    sortable: true,
  },
  { name: "actions", label: "", field: "actions", align: "right" as const },
];

const effectivePermColumns = [
  {
    name: "permission",
    label: "Permission",
    field: "permission",
    align: "left" as const,
    sortable: true,
  },
  { name: "source", label: "Source", field: "source", align: "left" as const },
  {
    name: "roleName",
    label: "Via Role",
    field: "roleName",
    align: "left" as const,
  },
  {
    name: "scopeName",
    label: "Scope",
    field: "scopeName",
    align: "left" as const,
  },
];

// ── Helpers ──

function formatTimestamp(ts?: Timestamp): string {
  if (!ts) return "—";
  return new Date(Number(ts.seconds) * 1000).toLocaleString();
}

function dateToTimestamp(dateStr: string): Timestamp | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  return { seconds: BigInt(Math.floor(d.getTime() / 1000)), nanos: 0 };
}

// ── Actions ──

function loadRoles() {
  store.fetchRoles(roleScopeFilter.value ?? undefined);
}

function loadAssignments() {
  store.fetchAssignments({
    roleId: assignmentRoleFilter.value ?? undefined,
    principalType: assignmentPrincipalTypeFilter.value ?? undefined,
    search: assignmentSearch.value || undefined,
  });
}

function viewRolePermissions(role: AdminRole) {
  selectedRole.value = role;
  showPermissionsDialog.value = true;
}

function handleRevoke(assignmentId: string, principalName: string) {
  $q.dialog({
    title: "Revoke Assignment",
    message: `Revoke admin role from "${principalName}"?`,
    cancel: true,
  }).onOk(async () => {
    try {
      await store.revokeAssignment(assignmentId);
      $q.notify({ type: "positive", message: "Assignment revoked" });
    } catch {
      $q.notify({ type: "negative", message: store.error ?? "Failed" });
    }
  });
}

async function handleAssign() {
  if (!assignForm.principalId || !assignForm.roleId) return;
  try {
    await store.assignRole({
      principalId: assignForm.principalId,
      principalType: assignForm.principalType,
      roleId: assignForm.roleId,
      scopeTargetId: assignForm.scopeTargetId || undefined,
      assignmentType: assignForm.assignmentType,
      expiresAt: dateToTimestamp(assignForm.expiresAt),
    });
    showAssignDialog.value = false;
    $q.notify({ type: "positive", message: "Role assigned" });
    Object.assign(assignForm, {
      principalId: "",
      principalType: AdminPrincipalType.USER,
      roleId: "",
      scopeTargetId: "",
      assignmentType: AssignmentType.PERMANENT,
      expiresAt: "",
    });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed" });
  }
}

function loadEffectivePermissions() {
  if (effectivePermsPrincipalId.value) {
    store.fetchEffectivePermissions(effectivePermsPrincipalId.value);
  }
}

async function handleSavePolicy() {
  try {
    await store.updateSessionPolicy({
      sessionMaxMinutes: policyForm.sessionMaxMinutes,
      idleTimeoutMinutes: policyForm.idleTimeoutMinutes,
      elevationTtlMinutes: policyForm.elevationTtlMinutes,
      requiredMfaMethod: policyForm.requiredMfaMethod,
      ipBinding: policyForm.ipBinding,
    });
    $q.notify({ type: "positive", message: "Session policy saved" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed" });
  }
}

async function handleRevokeSession(sessionId: string) {
  try {
    await store.revokeAdminSession(sessionId);
    $q.notify({ type: "positive", message: "Admin session revoked" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed" });
  }
}

function handleRevokeAllSessions() {
  $q.dialog({
    title: "Revoke All Admin Sessions",
    message: "This will terminate all active admin sessions. Continue?",
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      const count = await store.revokeAllAdminSessions();
      $q.notify({
        type: "positive",
        message: `Revoked ${count} admin sessions`,
      });
    } catch {
      $q.notify({ type: "negative", message: store.error ?? "Failed" });
    }
  });
}

// ── Populate policy form from store ──

watch(
  () => store.sessionPolicy,
  (p) => {
    if (p) {
      policyForm.sessionMaxMinutes = p.sessionMaxMinutes;
      policyForm.idleTimeoutMinutes = p.idleTimeoutMinutes;
      policyForm.elevationTtlMinutes = p.elevationTtlMinutes;
      policyForm.requiredMfaMethod = p.requiredMfaMethod;
      policyForm.ipBinding = p.ipBinding;
    }
  },
);

// ── Init ──

onMounted(() => {
  loadRoles();
  loadAssignments();
  store.fetchSessionPolicy();
  store.fetchActiveSessions();
});
</script>
