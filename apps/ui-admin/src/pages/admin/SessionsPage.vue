<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none">Sessions</h5>
        <p class="text-caption text-grey q-mb-none">
          Active sessions across all users and applications.
        </p>
      </div>
      <div class="col-auto q-gutter-sm">
        <q-btn
          label="Sign Out All"
          color="negative"
          flat
          icon="sym_o_logout"
          @click="showRevokeAllDialog = true"
        />
      </div>
    </div>

    <q-banner v-if="store.error" type="negative" class="q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <!-- ═══ Stats Cards ═══ -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-4">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-caption text-grey">Active Sessions</div>
            <div class="text-h4">{{ store.stats?.totalActive ?? "—" }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-4">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-caption text-grey">Active Users</div>
            <div class="text-h4">{{ store.stats?.activeUsers ?? "—" }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-4">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-caption text-grey">Peak Sessions Today</div>
            <div class="text-h4">{{ store.stats?.peakToday ?? "—" }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- ═══ Sessions by Client ═══ -->
    <q-card v-if="clientStats.length > 0" flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Sessions by Application</div>
        <q-table
          :rows="clientStats"
          :columns="clientColumns"
          row-key="clientId"
          dense
          flat
          :pagination="{ rowsPerPage: 5 }"
          hide-bottom
        >
          <template #body-cell-actions="props">
            <q-td :props="props">
              <q-btn
                flat
                dense
                size="sm"
                color="negative"
                icon="sym_o_logout"
                label="Sign Out All"
                @click="
                  handleRevokeApp(props.row.clientId, props.row.clientName)
                "
              />
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>

    <!-- ═══ Filters ═══ -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="row q-col-gutter-sm items-end">
          <div class="col-12 col-sm-3">
            <q-input
              v-model="filters.search"
              label="Search user"
              dense
              outlined
              clearable
              debounce="300"
              @update:model-value="loadSessions"
            >
              <template #prepend>
                <q-icon name="sym_o_search" />
              </template>
            </q-input>
          </div>
          <div class="col-12 col-sm-2">
            <q-input
              v-model="filters.clientId"
              label="Application ID"
              dense
              outlined
              clearable
              @update:model-value="loadSessions"
            />
          </div>
          <div class="col-12 col-sm-2">
            <q-input
              v-model="filters.ipAddress"
              label="IP Address"
              dense
              outlined
              clearable
              @update:model-value="loadSessions"
            />
          </div>
          <div class="col-12 col-sm-2">
            <q-select
              v-model="filters.authMethod"
              label="Auth Method"
              :options="authMethodOptions"
              dense
              outlined
              clearable
              emit-value
              map-options
              @update:model-value="loadSessions"
            />
          </div>
          <div class="col-12 col-sm-3">
            <q-input
              v-model="filters.startedAfter"
              label="Started After"
              type="date"
              dense
              outlined
              clearable
              @update:model-value="loadSessions"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- ═══ Sessions Table ═══ -->
    <q-card flat bordered>
      <q-table
        :rows="store.sessions"
        :columns="sessionColumns"
        row-key="sessionId"
        :loading="store.loading"
        flat
        :pagination="{ rowsPerPage: 25 }"
      >
        <template #body-cell-user="props">
          <q-td :props="props">
            <router-link
              v-if="props.row.profileId"
              :to="`/admin/users/${props.row.profileId}`"
              class="text-primary"
              style="text-decoration: none"
            >
              {{ props.row.displayName || "—" }}
            </router-link>
            <span v-else>{{ props.row.displayName || "—" }}</span>
            <div class="text-caption text-grey">{{ props.row.email }}</div>
          </q-td>
        </template>

        <template #body-cell-authMethod="props">
          <q-td :props="props">
            <q-chip
              dense
              size="sm"
              :icon="sessionAuthMethodIcon(props.row.authMethod)"
              :label="sessionAuthMethodLabel(props.row.authMethod)"
            />
          </q-td>
        </template>

        <template #body-cell-startedAt="props">
          <q-td :props="props">
            {{ formatTimestamp(props.row.startedAt) }}
          </q-td>
        </template>

        <template #body-cell-lastActivity="props">
          <q-td :props="props">
            {{ formatTimestamp(props.row.lastActivity) }}
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props">
            <q-btn
              flat
              dense
              round
              size="sm"
              color="negative"
              icon="sym_o_logout"
              @click="handleRevokeSession(props.row.sessionId)"
            >
              <q-tooltip>Revoke Session</q-tooltip>
            </q-btn>
          </q-td>
        </template>

        <template #no-data>
          <div class="full-width text-center q-pa-xl">
            <q-icon name="sym_o_devices" size="64px" color="grey-4" />
            <div class="text-h6 text-grey-6 q-mt-md">No active sessions</div>
          </div>
        </template>
      </q-table>
    </q-card>

    <!-- ═══ Revoke All Dialog ═══ -->
    <q-dialog v-model="showRevokeAllDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6 text-negative">Revoke ALL Sessions</div>
        </q-card-section>
        <q-card-section>
          <p>
            This will terminate <strong>all active sessions</strong> in this
            realm. All users will be logged out immediately.
          </p>
          <p class="text-caption text-grey">
            Type <strong>REVOKE ALL SESSIONS</strong> to confirm.
          </p>
          <q-input
            v-model="revokeConfirmation"
            outlined
            dense
            placeholder="REVOKE ALL SESSIONS"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="negative"
            label="Revoke All"
            :disable="revokeConfirmation !== 'REVOKE ALL SESSIONS'"
            @click="handleRevokeAll"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { useSessionsStore } from "src/stores/sessions";
import { SessionAuthMethod } from "@structured-id/proto/sid/v1/admin/sessions";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import {
  sessionAuthMethodLabel,
  sessionAuthMethodIcon,
} from "src/composables/useEnumLabels";
import { useQuasar } from "quasar";

const $q = useQuasar();
import { SessionId, required } from "@structured-id/ids";
import type { WireId } from "src/ids";

const store = useSessionsStore();

const showRevokeAllDialog = ref(false);
const revokeConfirmation = ref("");

const filters = reactive({
  search: "",
  clientId: "",
  ipAddress: "",
  authMethod: null as SessionAuthMethod | null,
  startedAfter: "",
});

const authMethodOptions = [
  { label: "Password", value: SessionAuthMethod.PASSWORD },
  { label: "MFA", value: SessionAuthMethod.MFA },
  { label: "SSO", value: SessionAuthMethod.SSO },
  { label: "Passkey", value: SessionAuthMethod.PASSKEY },
  { label: "Magic Link", value: SessionAuthMethod.MAGIC_LINK },
];

// ── Table columns ──

const clientColumns = [
  {
    name: "clientName",
    label: "Application",
    field: "clientName",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "activeSessions",
    label: "Active Sessions",
    field: "activeSessions",
    align: "center" as const,
    sortable: true,
  },
  {
    name: "uniqueUsers",
    label: "Unique Users",
    field: "uniqueUsers",
    align: "center" as const,
    sortable: true,
  },
  { name: "actions", label: "", field: "actions", align: "right" as const },
];

const sessionColumns = [
  {
    name: "user",
    label: "User",
    field: "displayName",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "clientName",
    label: "Application",
    field: "clientName",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "ipAddress",
    label: "IP",
    field: "ipAddress",
    align: "left" as const,
  },
  {
    name: "userAgent",
    label: "Device / Browser",
    field: "userAgent",
    align: "left" as const,
    style: "max-width: 200px; overflow: hidden; text-overflow: ellipsis",
  },
  {
    name: "authMethod",
    label: "Auth Method",
    field: "authMethod",
    align: "center" as const,
  },
  {
    name: "startedAt",
    label: "Started",
    field: "startedAt",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "lastActivity",
    label: "Last Activity",
    field: "lastActivity",
    align: "left" as const,
    sortable: true,
  },
  { name: "actions", label: "", field: "actions", align: "right" as const },
];

const clientStats = computed(() => store.stats?.byClient ?? []);

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

function loadSessions() {
  store.fetchSessions({
    search: filters.search || undefined,
    clientId: filters.clientId || undefined,
    ipAddress: filters.ipAddress || undefined,
    authMethod: filters.authMethod ?? undefined,
    startedAfter: dateToTimestamp(filters.startedAfter),
  });
}

async function handleRevokeSession(sessionId: WireId | undefined) {
  try {
    await store.revokeSession(required(SessionId, sessionId));
    $q.notify({ type: "positive", message: "Session revoked" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed" });
  }
}

async function handleRevokeApp(clientId: string, clientName: string) {
  $q.dialog({
    title: "Revoke Application Sessions",
    message: `Revoke all sessions for "${clientName}"?`,
    cancel: true,
  }).onOk(async () => {
    try {
      const count = await store.revokeApplicationSessions(clientId);
      $q.notify({
        type: "positive",
        message: `Revoked ${count} sessions for ${clientName}`,
      });
      loadSessions();
      store.fetchStats();
    } catch {
      $q.notify({ type: "negative", message: store.error ?? "Failed" });
    }
  });
}

async function handleRevokeAll() {
  try {
    const count = await store.revokeRealmSessions(revokeConfirmation.value);
    showRevokeAllDialog.value = false;
    revokeConfirmation.value = "";
    $q.notify({
      type: "positive",
      message: `Revoked ${count} sessions`,
    });
    store.fetchStats();
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed" });
  }
}

// ── Init ──

onMounted(() => {
  loadSessions();
  store.fetchStats();
});
</script>
