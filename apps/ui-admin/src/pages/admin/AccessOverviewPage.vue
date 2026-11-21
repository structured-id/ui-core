<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h4">Access Overview</div>
        <div class="text-body2 text-grey-7">
          Who has what — role assignments across all users
        </div>
      </div>
      <q-btn
        flat
        icon="sym_o_download"
        label="Export CSV"
        no-caps
        @click="exportCsv"
      />
    </div>

    <!-- Pending Requests Banner -->
    <q-banner
      v-if="store.pendingRequests.length > 0"
      class="bg-orange-1 q-mb-md"
      rounded
    >
      <template #avatar>
        <q-icon name="sym_o_pending_actions" color="orange" />
      </template>
      <span class="text-weight-medium">
        {{ store.pendingRequests.length }} pending access request{{
          store.pendingRequests.length > 1 ? "s" : ""
        }}
      </span>
      <template #action>
        <q-btn
          flat
          color="orange-9"
          label="Review requests"
          no-caps
          @click="showPendingDialog = true"
        />
      </template>
    </q-banner>

    <!-- Permanent Admin Warning -->
    <q-banner v-if="permanentAdminCount > 2" class="bg-amber-1 q-mb-md" rounded>
      <template #avatar>
        <q-icon name="sym_o_warning" color="amber-9" />
      </template>
      {{ permanentAdminCount }} permanent admin roles — consider converting to
      temporary with periodic review.
    </q-banner>

    <!-- Filters -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-12 col-sm-3">
        <q-input
          v-model="filterUser"
          outlined
          dense
          placeholder="Filter by user..."
          clearable
        >
          <template #prepend>
            <q-icon name="sym_o_search" />
          </template>
        </q-input>
      </div>
      <div class="col-12 col-sm-3">
        <q-select
          v-model="filterRole"
          :options="roleOptions"
          outlined
          dense
          clearable
          label="All roles"
          emit-value
          map-options
        />
      </div>
      <div class="col-auto self-center">
        <q-toggle v-model="activeOnly" label="Active only" />
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

    <!-- Role Assignments Table -->
    <q-table
      :rows="filteredAssignments"
      :columns="columns"
      :row-key="assignmentKey"
      flat
      bordered
      :pagination="{ rowsPerPage: 25 }"
      :loading="store.loading"
    >
      <template #body-cell-user="props">
        <q-td :props="props">
          <div class="text-weight-medium">
            {{ resolveUserDisplay(props.row) }}
          </div>
          <div
            v-if="resolveUserEmail(props.row)"
            class="text-caption text-grey"
          >
            {{ resolveUserEmail(props.row) }}
          </div>
        </q-td>
      </template>

      <template #body-cell-role="props">
        <q-td :props="props">
          {{ resolveRoleName(props.row.roleId) }}
        </q-td>
      </template>

      <template #body-cell-since="props">
        <q-td :props="props">
          {{ formatDate(props.row.createdAt) }}
        </q-td>
      </template>

      <template #body-cell-expires="props">
        <q-td :props="props">
          <template v-if="props.row.expiresAt">
            <q-badge
              :color="isExpiringSoon(props.row.expiresAt) ? 'warning' : 'info'"
              :label="formatDate(props.row.expiresAt)"
            />
          </template>
          <span v-else class="text-grey">permanent</span>
        </q-td>
      </template>

      <template #no-data>
        <div class="full-width text-center q-pa-xl">
          <q-icon name="sym_o_assignment_ind" size="64px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-md">No role assignments</div>
          <div class="text-body2 text-grey q-mb-lg">
            Assign roles to users from the Roles page.
          </div>
        </div>
      </template>
    </q-table>

    <!-- Pending Requests Dialog -->
    <q-dialog v-model="showPendingDialog" maximized>
      <q-card>
        <q-card-section class="row items-center">
          <div class="text-h6">Pending Access Requests</div>
          <q-space />
          <q-btn flat round dense icon="sym_o_close" v-close-popup />
        </q-card-section>

        <q-card-section>
          <q-table
            :rows="store.pendingRequests"
            :columns="pendingColumns"
            :row-key="requestKey"
            flat
            bordered
          >
            <template #body-cell-requester="props">
              <q-td :props="props">
                <div class="text-weight-medium">
                  {{
                    props.row.requesterDisplayName ||
                    shown(props.row.requesterProfileId)
                  }}
                </div>
              </q-td>
            </template>

            <template #body-cell-requestedAt="props">
              <q-td :props="props">
                {{ formatDate(props.row.createdAt) }}
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props" auto-width>
                <q-btn
                  flat
                  dense
                  color="positive"
                  icon="sym_o_check"
                  @click="handleDecide(props.row, true)"
                >
                  <q-tooltip>Approve</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  color="negative"
                  icon="sym_o_close"
                  @click="confirmDeny(props.row)"
                >
                  <q-tooltip>Deny</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Deny Reason Dialog -->
    <q-dialog v-model="showDenyDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Deny Access Request</div>
        </q-card-section>
        <q-card-section>
          <p>
            Deny request from
            <strong>{{ requestToDeny?.requesterDisplayName }}</strong>
            for role
            <strong>{{ requestToDeny?.requestedRole }}</strong>?
          </p>
          <q-input
            v-model="denyReason"
            outlined
            dense
            label="Reason (required)"
            type="textarea"
            autogrow
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            flat
            color="negative"
            label="Deny"
            :disable="!denyReason"
            @click="executeDeny"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useQuasar } from "quasar";
import { useGovernanceStore } from "#admin/stores/governance";
import { useRolesStore } from "#admin/stores/roles";
import { useUsersStore } from "#admin/stores/users";
import type { RoleAssignment } from "@structured-id/proto/sid/v1/authz/authz";
import type { AccessRequestDetail } from "@structured-id/proto/sid/v1/authz/governance";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import {
  AccessRequestId,
  ProfileId,
  RoleId,
  required,
  type wire,
} from "@structured-id/ids";
import { names, shown } from "#admin/ids";

const $q = useQuasar();
const store = useGovernanceStore();
const rolesStore = useRolesStore();
const usersStore = useUsersStore();

const filterUser = ref("");
const filterRole = ref<string | null>(null);
const activeOnly = ref(true);
const showPendingDialog = ref(false);
const showDenyDialog = ref(false);
const requestToDeny = ref<AccessRequestDetail | null>(null);
const denyReason = ref("");

const columns = [
  {
    name: "user",
    label: "User",
    field: "id",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "role",
    label: "Role",
    field: "roleId",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "since",
    label: "Since",
    field: "createdAt",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "expires",
    label: "Expires",
    field: "expiresAt",
    align: "left" as const,
    sortable: true,
  },
];

const pendingColumns = [
  {
    name: "requester",
    label: "Requester",
    field: "requesterDisplayName",
    align: "left" as const,
  },
  {
    name: "requestedRole",
    label: "Requested Role",
    field: "requestedRole",
    align: "left" as const,
  },
  {
    name: "justification",
    label: "Justification",
    field: "justification",
    align: "left" as const,
  },
  {
    name: "requestedAt",
    label: "Requested",
    field: "createdAt",
    align: "left" as const,
  },
  { name: "actions", label: "", field: "requestId" },
];

// A role is filtered by its id's canonical text.
const roleOptions = computed(() => {
  const roles = new Map<string, wire.RoleId | undefined>();
  for (const a of store.assignments) roles.set(shown(a.roleId), a.roleId);
  return Array.from(roles).map(([text, id]) => ({
    label: resolveRoleName(id),
    value: text,
  }));
});

const permanentAdminCount = computed(() => {
  return store.assignments.filter((a) => {
    const roleName = resolveRoleName(a.roleId).toLowerCase();
    return !a.expiresAt && roleName.includes("admin");
  }).length;
});

const filteredAssignments = computed(() => {
  let result = store.assignments;

  if (activeOnly.value) {
    const now = Date.now() / 1000;
    result = result.filter(
      (a) => !a.expiresAt || Number(a.expiresAt.seconds) > now,
    );
  }

  if (filterRole.value) {
    result = result.filter((a) => shown(a.roleId) === filterRole.value);
  }

  if (filterUser.value) {
    const q = filterUser.value.toLowerCase();
    result = result.filter((a) => {
      const display = resolveUserDisplay(a).toLowerCase();
      const email = (resolveUserEmail(a) ?? "").toLowerCase();
      return display.includes(q) || email.includes(q);
    });
  }

  return result;
});

function assignmentKey(assignment: RoleAssignment): string {
  return shown(assignment.id);
}

function requestKey(request: AccessRequestDetail): string {
  return shown(request.requestId);
}

function getPrincipalProfileId(
  assignment: RoleAssignment,
): wire.ProfileId | undefined {
  const p = assignment.principal;
  if (p.oneofKind === "profileId") return p.profileId;
  return undefined;
}

/**
 * The listed profile the assignment's principal names, if listed. A
 * reference that is not a profile id names no listed profile.
 */
function assignedProfile(pid: wire.ProfileId) {
  let id: ProfileId;
  try {
    id = required(ProfileId, pid);
  } catch {
    return undefined;
  }
  return usersStore.profiles.find((p) => names(p.id, id));
}

function resolveUserDisplay(assignment: RoleAssignment): string {
  const pid = getPrincipalProfileId(assignment);
  if (pid) {
    const profile = assignedProfile(pid);
    if (profile) {
      return (
        profile.formattedName ?? profile.username ?? profile.email ?? shown(pid)
      );
    }
    return shown(pid);
  }
  const p = assignment.principal;
  if (p.oneofKind === "groupId") return `Group: ${shown(p.groupId)}`;
  if (p.oneofKind === "machineUserId") {
    return `Service: ${shown(p.machineUserId)}`;
  }
  return "Unknown";
}

function resolveUserEmail(assignment: RoleAssignment): string | undefined {
  const pid = getPrincipalProfileId(assignment);
  if (pid) {
    return assignedProfile(pid)?.email;
  }
  return undefined;
}

/** The role's name, or its id while the role list has not loaded it. */
function resolveRoleName(roleId: wire.RoleId | undefined): string {
  let id: RoleId;
  try {
    id = required(RoleId, roleId);
  } catch {
    return shown(roleId);
  }
  return rolesStore.roles.find((r) => names(r.id, id))?.name ?? id.toString();
}

function formatDate(ts?: Timestamp): string {
  if (!ts) return "—";
  const d = new Date(Number(ts.seconds) * 1000);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isExpiringSoon(ts: Timestamp): boolean {
  const threeDays = 3 * 24 * 60 * 60;
  const now = Date.now() / 1000;
  return Number(ts.seconds) - now < threeDays;
}

function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `"${value}"`;
}

function exportCsv() {
  const header = "User,Email,Role,Since,Expires\n";
  const rows = filteredAssignments.value
    .map((a) => {
      const user = resolveUserDisplay(a);
      const email = resolveUserEmail(a) ?? "";
      const role = resolveRoleName(a.roleId);
      const since = formatDate(a.createdAt);
      const expires = a.expiresAt ? formatDate(a.expiresAt) : "permanent";
      return [user, email, role, since, expires].map(escapeCsvField).join(",");
    })
    .join("\n");

  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "access-overview.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function handleDecide(request: AccessRequestDetail, approved: boolean) {
  try {
    await store.decideRequest(
      required(AccessRequestId, request.requestId),
      approved,
      "",
    );
    $q.notify({
      type: "positive",
      message: approved ? "Request approved" : "Request denied",
    });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Action failed" });
  }
}

function confirmDeny(request: AccessRequestDetail) {
  requestToDeny.value = request;
  denyReason.value = "";
  showDenyDialog.value = true;
}

async function executeDeny() {
  if (!requestToDeny.value) return;
  try {
    await store.decideRequest(
      required(AccessRequestId, requestToDeny.value.requestId),
      false,
      denyReason.value,
    );
    showDenyDialog.value = false;
    $q.notify({ type: "positive", message: "Request denied" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Deny failed" });
  }
}

onMounted(async () => {
  await Promise.all([
    store.fetchRoleAssignments(),
    store.fetchPendingRequests(),
    rolesStore.fetchRoles(),
    usersStore.fetchProfiles(),
  ]);
});
</script>
