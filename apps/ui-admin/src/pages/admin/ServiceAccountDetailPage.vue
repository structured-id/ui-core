<template>
  <q-page padding>
    <!-- Header -->
    <div class="row items-center q-mb-lg">
      <q-btn
        flat
        round
        icon="sym_o_arrow_back"
        :to="{ name: 'admin-service-accounts' }"
      />
      <div class="col q-ml-sm">
        <div class="text-h5">
          {{ store.currentMachineUser?.displayName || "Machine User" }}
          <q-badge
            v-if="store.currentMachineUser"
            :color="machineUserStatusColor(store.currentMachineUser.status)"
            :label="machineUserStatusLabel(store.currentMachineUser.status)"
            class="q-ml-sm"
          />
        </div>
        <div class="text-caption text-grey">
          {{ machineUserTypeLabel(store.currentMachineUser?.machineType) }}
          <template v-if="store.currentMachineUser?.clientId">
            &middot;
            <code>{{ store.currentMachineUser.clientId }}</code>
          </template>
        </div>
      </div>
      <div class="q-gutter-sm">
        <q-btn
          v-if="store.currentMachineUser?.status === MachineUserStatus.ACTIVE"
          outline
          color="warning"
          label="Suspend"
          no-caps
          icon="sym_o_pause_circle"
          @click="suspendAction"
        />
        <q-btn
          v-if="
            store.currentMachineUser?.status === MachineUserStatus.SUSPENDED ||
            store.currentMachineUser?.status === MachineUserStatus.EXPIRED
          "
          outline
          color="positive"
          label="Reactivate"
          no-caps
          icon="sym_o_play_circle"
          @click="reactivateAction"
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

    <!-- Tabs -->
    <q-tabs v-model="tab" dense align="left" class="q-mb-lg" no-caps>
      <q-tab name="overview" label="Overview" icon="sym_o_info" />
      <q-tab name="credentials" label="Credentials" icon="sym_o_key" />
      <q-tab name="roles" label="Roles" icon="sym_o_shield_person" />
      <q-tab
        name="impersonation"
        label="Impersonation"
        icon="sym_o_supervisor_account"
      />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <!-- Overview Tab -->
      <q-tab-panel name="overview">
        <div
          v-if="store.currentMachineUser"
          class="q-gutter-md"
          style="max-width: 600px"
        >
          <q-input
            v-model="overviewForm.displayName"
            outlined
            label="Name"
            dense
          />
          <q-input
            :model-value="
              machineUserTypeLabel(store.currentMachineUser.machineType)
            "
            outlined
            label="Type"
            dense
            readonly
            hint="Cannot be changed after creation"
          />
          <q-input
            v-model="overviewForm.description"
            outlined
            label="Description"
            dense
            type="textarea"
            autogrow
          />
          <q-input
            :model-value="shown(store.currentMachineUser.id)"
            outlined
            label="ID"
            dense
            readonly
          />
          <q-input
            :model-value="store.currentMachineUser.clientId"
            outlined
            label="Client ID"
            dense
            readonly
          />

          <q-separator class="q-my-md" />
          <div class="text-subtitle2">Restrictions</div>

          <q-input
            v-model="overviewForm.ipAllowlist"
            outlined
            label="IP Allowlist (comma-separated CIDRs)"
            dense
            hint="Leave empty for unrestricted"
          />
          <q-input
            v-model.number="overviewForm.rateLimitRpm"
            outlined
            label="Rate Limit (req/min)"
            dense
            type="number"
            hint="0 = site default"
          />
          <q-input
            v-model.number="overviewForm.maxTokenLifetime"
            outlined
            label="Max Token Lifetime (seconds)"
            dense
            type="number"
            hint="0 = default"
          />

          <q-btn
            color="primary"
            label="Save Changes"
            no-caps
            :loading="store.loading"
            @click="saveOverview"
          />

          <!-- Danger Zone -->
          <q-separator class="q-my-lg" />
          <div class="text-subtitle1 text-negative">Danger Zone</div>
          <q-card flat bordered class="q-pa-md">
            <div class="row items-center justify-between">
              <div>
                <div class="text-subtitle2">Delete this machine user</div>
                <div class="text-caption text-grey">
                  All credentials and tokens will be permanently invalidated.
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

      <!-- Credentials Tab -->
      <q-tab-panel name="credentials">
        <div style="max-width: 800px">
          <div class="row items-center q-mb-md">
            <div class="col text-subtitle2">
              Credentials ({{ store.credentials.length }})
            </div>
            <q-btn
              flat
              dense
              icon="sym_o_add"
              label="Add Credential"
              no-caps
              @click="addCredDialog = true"
            />
          </div>

          <q-table
            :rows="store.credentials"
            :columns="credColumns"
            row-key="kid"
            flat
            bordered
            :pagination="{ rowsPerPage: 10 }"
          >
            <template #body-cell-credentialType="props">
              <q-td :props="props">
                <q-icon
                  :name="machineCredentialTypeIcon(props.row.credentialType)"
                  class="q-mr-sm"
                />
                {{ machineCredentialTypeLabel(props.row.credentialType) }}
              </q-td>
            </template>

            <template #body-cell-status="props">
              <q-td :props="props">
                <q-badge
                  :color="machineCredentialStatusColor(props.row.status)"
                  :label="machineCredentialStatusLabel(props.row.status)"
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
                  icon="sym_o_autorenew"
                  color="primary"
                  @click="rotateCredAction(props.row.kid)"
                >
                  <q-tooltip>Rotate</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  round
                  dense
                  icon="sym_o_block"
                  color="negative"
                  @click="revokeCredAction(props.row.kid)"
                >
                  <q-tooltip>Revoke</q-tooltip>
                </q-btn>
              </q-td>
            </template>

            <template #no-data>
              <div class="full-width text-center q-pa-lg">
                <q-icon name="sym_o_key_off" size="48px" color="grey-4" />
                <div class="text-body2 text-grey q-mt-sm">
                  No credentials yet. Add one to enable authentication.
                </div>
              </div>
            </template>
          </q-table>
        </div>
      </q-tab-panel>

      <!-- Roles Tab: the machine user's role assignments -->
      <q-tab-panel name="roles">
        <div style="max-width: 800px">
          <div class="row items-center q-mb-md">
            <div class="col text-subtitle2">
              Role Assignments ({{ rolesStore.assignments.length }})
            </div>
            <q-btn
              flat
              dense
              icon="sym_o_add"
              label="Assign Role"
              no-caps
              data-test="assign-role"
              @click="openAssignRole"
            />
          </div>

          <q-banner
            v-if="rolesStore.error"
            dense
            class="bg-negative text-white q-mb-md"
          >
            {{ rolesStore.error }}
          </q-banner>

          <q-list
            v-if="rolesStore.assignments.length"
            bordered
            separator
            data-test="role-assignments"
          >
            <q-item v-for="a in rolesStore.assignments" :key="shown(a.id)">
              <q-item-section>
                <q-item-label>{{ roleName(a.roleId) }}</q-item-label>
                <q-item-label caption>
                  <template v-if="a.scope">Scope: {{ a.scope }} · </template>
                  Expires:
                  {{ a.expiresAt ? formatDate(a.expiresAt) : "Never" }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  round
                  dense
                  icon="sym_o_delete"
                  color="negative"
                  @click="revokeRoleAction(a)"
                >
                  <q-tooltip>Revoke</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="text-grey q-pa-md text-center">
            No roles assigned.
          </div>
        </div>
      </q-tab-panel>

      <!-- Impersonation Tab -->
      <q-tab-panel name="impersonation">
        <div style="max-width: 800px">
          <q-banner class="bg-blue-1 q-mb-md" dense>
            <template #avatar>
              <q-icon name="sym_o_info" color="primary" />
            </template>
            Every impersonation event is logged with actor, target, scopes, and
            duration. Audit logging cannot be disabled for impersonation.
          </q-banner>

          <div class="row items-center q-mb-md">
            <div class="col text-subtitle2">
              Impersonation Grants ({{ store.impersonationGrants.length }})
            </div>
            <q-btn
              flat
              dense
              icon="sym_o_add"
              label="Grant Impersonation"
              no-caps
              @click="grantImpDialog = true"
            />
          </div>

          <q-list bordered separator v-if="store.impersonationGrants.length">
            <q-item v-for="grant in store.impersonationGrants" :key="grant.id">
              <q-item-section avatar>
                <q-icon
                  :name="
                    grant.targetType === ImpersonationTargetType.ROLE
                      ? 'sym_o_shield_person'
                      : 'sym_o_person'
                  "
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  <q-badge
                    :color="
                      grant.targetType === ImpersonationTargetType.ROLE
                        ? 'purple'
                        : 'blue'
                    "
                    :label="
                      grant.targetType === ImpersonationTargetType.ROLE
                        ? 'Role'
                        : 'User'
                    "
                    class="q-mr-sm"
                  />
                  {{ grant.target }}
                </q-item-label>
                <q-item-label caption>
                  Scopes: {{ grant.allowedScopes.join(", ") || "all" }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  round
                  dense
                  icon="sym_o_delete"
                  color="negative"
                  @click="
                    revokeImpersonationAction(
                      grant.targetType === ImpersonationTargetType.ROLE
                        ? 'ROLE'
                        : 'USER',
                      grant.target,
                    )
                  "
                >
                  <q-tooltip>Revoke</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="text-grey q-pa-md text-center">
            No impersonation grants configured.
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Delete confirmation -->
    <q-dialog v-model="deleteDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Delete Machine User</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete
            <strong>{{ store.currentMachineUser?.displayName }}</strong>?
          </p>
          <p class="text-negative text-caption">
            All credentials and active tokens will be permanently invalidated.
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn flat color="negative" label="Delete" @click="executeDelete" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Add Credential Dialog -->
    <q-dialog v-model="addCredDialog">
      <q-card style="min-width: 450px">
        <q-card-section>
          <div class="text-h6">Add Credential</div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="credForm.credentialType"
            outlined
            dense
            label="Authentication Method"
            :options="credTypeOptions"
            emit-value
            map-options
          />
          <q-input
            v-if="
              credForm.credentialType === MachineCredentialType.PRIVATE_KEY_JWT
            "
            v-model="credForm.algorithm"
            outlined
            dense
            label="Algorithm"
            hint="RS256, ES256, or EdDSA"
          />
          <q-input
            v-if="
              credForm.credentialType === MachineCredentialType.PRIVATE_KEY_JWT
            "
            v-model="credForm.publicKeyPem"
            outlined
            dense
            label="Public Key (PEM)"
            type="textarea"
            autogrow
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Add"
            no-caps
            :loading="store.loading"
            @click="executeAddCredential"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Client Secret Display Dialog -->
    <q-dialog v-model="secretDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Credential Created</div>
        </q-card-section>
        <q-card-section>
          <q-banner class="bg-warning text-white q-mb-md" dense>
            This secret won't be shown again. Copy it now.
          </q-banner>
          <q-input
            :model-value="displayedSecret"
            outlined
            dense
            readonly
            class="q-mb-sm"
          >
            <template #append>
              <q-btn
                flat
                round
                dense
                icon="sym_o_content_copy"
                @click="copySecret"
              />
            </template>
          </q-input>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Done" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Assign Role Dialog -->
    <q-dialog v-model="assignRoleDialog">
      <q-card style="min-width: 450px">
        <q-card-section>
          <div class="text-h6">Assign Role</div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="roleForm.roleId"
            outlined
            dense
            label="Role"
            :options="roleOptions"
            emit-value
            map-options
          />
          <q-input
            v-model="roleForm.scope"
            outlined
            dense
            label="Scope (optional)"
            hint="Leave empty for the role's own project"
          />
          <q-input
            v-model="roleForm.expiresAt"
            outlined
            dense
            type="date"
            label="Expires (optional)"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Assign"
            no-caps
            :loading="rolesStore.loading"
            :disable="!roleForm.roleId"
            @click="executeAssignRole"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Grant Impersonation Dialog -->
    <q-dialog v-model="grantImpDialog">
      <q-card style="min-width: 450px">
        <q-card-section>
          <div class="text-h6">Grant Impersonation</div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="impForm.targetType"
            outlined
            dense
            label="Target Type"
            :options="impTargetTypeOptions"
            emit-value
            map-options
          />
          <q-input
            v-model="impForm.target"
            outlined
            dense
            :label="
              impForm.targetType === ImpersonationTargetType.ROLE
                ? 'Role name or ID'
                : 'User profile ID'
            "
          />
          <q-input
            v-model="impForm.scopes"
            outlined
            dense
            label="Allowed Scopes (comma-separated)"
            hint="Leave empty for all available scopes"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Grant"
            no-caps
            :loading="store.loading"
            :disable="!impForm.target"
            @click="executeGrantImpersonation"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuasar } from "quasar";
import { useMachineUsersStore } from "src/stores/machineUsers";
import { useRolesStore } from "src/stores/roles";
import {
  MachineUserStatus,
  MachineCredentialType,
  ImpersonationTargetType,
} from "@structured-id/proto/sid/v1/machine/machine_user";
import {
  machineUserTypeLabel,
  machineUserStatusLabel,
  machineUserStatusColor,
  machineCredentialTypeLabel,
  machineCredentialTypeIcon,
  machineCredentialStatusLabel,
  machineCredentialStatusColor,
} from "src/composables/useEnumLabels";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import type { RoleAssignment } from "@structured-id/proto/sid/v1/authz/authz";
import {
  MachineUserId,
  RoleAssignmentId,
  RoleId,
  required,
  type wire,
} from "@structured-id/ids";
import { names, shown } from "src/ids";

const store = useMachineUsersStore();
const rolesStore = useRolesStore();
const route = useRoute();
const router = useRouter();
const $q = useQuasar();

const tab = ref("overview");
const deleteDialog = ref(false);
const addCredDialog = ref(false);
const secretDialog = ref(false);
const grantImpDialog = ref(false);
const assignRoleDialog = ref(false);
const displayedSecret = ref("");

const roleForm = reactive({ roleId: "", scope: "", expiresAt: "" });

// A role is chosen by its id's text, checked as a role when it is assigned.
const roleOptions = computed(() =>
  rolesStore.roles.map((r) => ({ label: r.name, value: shown(r.id) })),
);

/** The role's name, or its id while the role list has not loaded it. */
function roleName(roleId: wire.RoleId | undefined): string {
  let id: RoleId;
  try {
    id = required(RoleId, roleId);
  } catch {
    return shown(roleId);
  }
  return rolesStore.roles.find((r) => names(r.id, id))?.name ?? id.toString();
}
const overviewForm = reactive({
  displayName: "",
  description: "",
  ipAllowlist: "",
  rateLimitRpm: 0,
  maxTokenLifetime: 0,
});

const credForm = ref({
  credentialType: MachineCredentialType.CLIENT_SECRET,
  algorithm: "RS256",
  publicKeyPem: "",
});

const impForm = ref({
  targetType: ImpersonationTargetType.USER,
  target: "",
  scopes: "",
});

const credTypeOptions = [
  {
    label: "Client Secret",
    value: MachineCredentialType.CLIENT_SECRET,
  },
  {
    label: "Private Key JWT",
    value: MachineCredentialType.PRIVATE_KEY_JWT,
  },
];

const impTargetTypeOptions = [
  {
    label: "User",
    value: ImpersonationTargetType.USER,
  },
  {
    label: "Role",
    value: ImpersonationTargetType.ROLE,
  },
];

const credColumns = [
  {
    name: "credentialType",
    label: "Method",
    field: "credentialType",
    align: "left" as const,
  },
  {
    name: "kid",
    label: "Key ID",
    field: "kid",
    align: "left" as const,
  },
  {
    name: "algorithm",
    label: "Algorithm",
    field: "algorithm",
    align: "left" as const,
  },
  {
    name: "status",
    label: "Status",
    field: "status",
    align: "left" as const,
  },
  {
    name: "expiresAt",
    label: "Expires",
    field: "expiresAt",
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
  { name: "actions", label: "", field: "kid" },
];

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  return new Date(Number(ts.seconds) * 1000).toLocaleDateString();
}

function populateForm() {
  const mu = store.currentMachineUser;
  if (!mu) return;
  overviewForm.displayName = mu.displayName;
  overviewForm.description = mu.description;
  overviewForm.ipAllowlist = mu.ipAllowlist.join(", ");
  overviewForm.rateLimitRpm = mu.rateLimitRpm;
  overviewForm.maxTokenLifetime = mu.maxTokenLifetime;
}

watch(() => store.currentMachineUser, populateForm, { immediate: true });

/** The shown machine user's identifier as its answer carried it; malformed throws. */
function currentId(): MachineUserId {
  return required(MachineUserId, store.currentMachineUser?.id);
}

async function saveOverview() {
  if (!store.currentMachineUser) return;
  try {
    await store.updateMachineUser(currentId(), {
      displayName: overviewForm.displayName,
      description: overviewForm.description,
      scopes: store.currentMachineUser.scopes,
      ipAllowlist: overviewForm.ipAllowlist
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      rateLimitRpm: overviewForm.rateLimitRpm,
      maxTokenLifetime: overviewForm.maxTokenLifetime,
    });
    $q.notify({ type: "positive", message: "Machine user updated" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Update failed" });
  }
}

async function suspendAction() {
  if (!store.currentMachineUser) return;
  try {
    await store.suspendMachineUser(currentId());
    $q.notify({ type: "positive", message: "Machine user suspended" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Suspend failed" });
  }
}

async function reactivateAction() {
  if (!store.currentMachineUser) return;
  try {
    await store.reactivateMachineUser(currentId());
    $q.notify({ type: "positive", message: "Machine user reactivated" });
  } catch {
    $q.notify({
      type: "negative",
      message: store.error || "Reactivate failed",
    });
  }
}

function confirmDelete() {
  deleteDialog.value = true;
}

async function executeDelete() {
  if (!store.currentMachineUser) return;
  try {
    await store.deleteMachineUser(currentId());
    deleteDialog.value = false;
    $q.notify({ type: "positive", message: "Machine user deleted" });
    router.push({ name: "admin-service-accounts" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Delete failed" });
  }
}

async function executeAddCredential() {
  if (!store.currentMachineUser) return;
  try {
    const response = await store.addCredential({
      machineUserId: currentId(),
      credentialType: credForm.value.credentialType,
      algorithm: credForm.value.algorithm,
      publicKeyPem: credForm.value.publicKeyPem,
    });
    addCredDialog.value = false;
    // Show secret if client_secret type
    if (
      response.clientSecret &&
      credForm.value.credentialType === MachineCredentialType.CLIENT_SECRET
    ) {
      displayedSecret.value = response.clientSecret;
      secretDialog.value = true;
    } else {
      $q.notify({ type: "positive", message: "Credential added" });
    }
    credForm.value = {
      credentialType: MachineCredentialType.CLIENT_SECRET,
      algorithm: "RS256",
      publicKeyPem: "",
    };
  } catch {
    $q.notify({
      type: "negative",
      message: store.error || "Add credential failed",
    });
  }
}

async function revokeCredAction(kid: string) {
  if (!store.currentMachineUser) return;
  try {
    await store.revokeCredential(currentId(), kid);
    $q.notify({ type: "positive", message: "Credential revoked" });
  } catch {
    $q.notify({
      type: "negative",
      message: store.error || "Revoke failed",
    });
  }
}

async function rotateCredAction(kid: string) {
  if (!store.currentMachineUser) return;
  try {
    const response = await store.rotateCredential({
      machineUserId: currentId(),
      kid,
      algorithm: "",
      publicKeyPem: "",
    });
    if (response.clientSecret) {
      displayedSecret.value = response.clientSecret;
      secretDialog.value = true;
    } else {
      $q.notify({ type: "positive", message: "Credential rotated" });
    }
  } catch {
    $q.notify({
      type: "negative",
      message: store.error || "Rotate failed",
    });
  }
}

function openAssignRole() {
  roleForm.roleId = "";
  roleForm.scope = "";
  roleForm.expiresAt = "";
  assignRoleDialog.value = true;
}

async function executeAssignRole() {
  if (!store.currentMachineUser || !roleForm.roleId) return;
  let expiresAt: Timestamp | undefined;
  if (roleForm.expiresAt) {
    const d = new Date(roleForm.expiresAt);
    expiresAt = { seconds: BigInt(Math.floor(d.getTime() / 1000)), nanos: 0 };
  }
  try {
    await rolesStore.assignRole({
      roleId: RoleId.parse(roleForm.roleId),
      principal: {
        kind: "machineUser",
        id: currentId(),
      },
      scope: roleForm.scope || undefined,
      expiresAt,
    });
    assignRoleDialog.value = false;
    $q.notify({ type: "positive", message: "Role assigned" });
  } catch {
    $q.notify({
      type: "negative",
      message: rolesStore.error || "Assign failed",
    });
  }
}

async function revokeRoleAction(assignment: RoleAssignment) {
  try {
    await rolesStore.revokeAssignment(
      required(RoleAssignmentId, assignment.id),
    );
    $q.notify({ type: "positive", message: "Role revoked" });
  } catch {
    $q.notify({
      type: "negative",
      message: rolesStore.error || "Revoke failed",
    });
  }
}

async function executeGrantImpersonation() {
  if (!store.currentMachineUser) return;
  try {
    await store.grantImpersonation({
      machineUserId: currentId(),
      targetType: impForm.value.targetType,
      target: impForm.value.target,
      allowedScopes: impForm.value.scopes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    grantImpDialog.value = false;
    impForm.value = {
      targetType: ImpersonationTargetType.USER,
      target: "",
      scopes: "",
    };
    $q.notify({ type: "positive", message: "Impersonation granted" });
  } catch {
    $q.notify({
      type: "negative",
      message: store.error || "Grant failed",
    });
  }
}

async function revokeImpersonationAction(targetType: string, target: string) {
  if (!store.currentMachineUser) return;
  try {
    await store.revokeImpersonation(currentId(), targetType, target);
    $q.notify({ type: "positive", message: "Impersonation revoked" });
  } catch {
    $q.notify({
      type: "negative",
      message: store.error || "Revoke failed",
    });
  }
}

function copySecret() {
  navigator.clipboard.writeText(displayedSecret.value);
  $q.notify({ type: "positive", message: "Copied to clipboard" });
}

onMounted(async () => {
  const machineUserId = route.params.machineUserId as string;
  if (machineUserId) {
    let principal: MachineUserId;
    try {
      principal = MachineUserId.parse(machineUserId);
    } catch {
      store.error = "This address names no service account";
      return;
    }
    await store.getMachineUser(principal);
    store.fetchCredentials(principal);
    store.fetchImpersonationGrants(principal);
    rolesStore.fetchRoles();
    rolesStore.fetchMachineUserAssignments(principal);
  }
});
</script>
