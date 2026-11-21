<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h4">Events & Audit</div>
        <div class="text-body2 text-grey-7 q-mt-xs">
          Monitor authentication events, admin operations, and tamper-evident
          audit trail
        </div>
      </div>
    </div>

    <q-tabs
      v-model="tab"
      dense
      align="left"
      active-color="primary"
      indicator-color="primary"
      class="q-mb-md"
      no-caps
    >
      <q-tab name="live-stream" label="Live Stream" />
      <q-tab name="user-events" label="User Events" />
      <q-tab name="admin-events" label="Admin Events" />
      <q-tab name="audit" label="Audit Trail" />
      <q-tab name="config" label="Configuration" />
    </q-tabs>

    <!-- Loading -->
    <q-linear-progress
      v-if="store.loading"
      indeterminate
      color="primary"
      class="q-mb-md"
    />

    <!-- Error -->
    <q-banner v-if="store.error" dense class="bg-negative text-white q-mb-md">
      {{ store.error }}
    </q-banner>

    <q-tab-panels v-model="tab" animated>
      <!-- Live Stream Tab -->
      <q-tab-panel name="live-stream" class="q-pa-none">
        <!-- Stream controls -->
        <div class="row items-center q-mb-md q-gutter-sm">
          <q-btn
            :icon="streamPaused ? 'sym_o_play_arrow' : 'sym_o_pause'"
            :label="streamPaused ? 'Resume' : 'Pause'"
            :color="streamPaused ? 'positive' : 'warning'"
            no-caps
            @click="streamPaused = !streamPaused"
          />
          <q-btn
            icon="sym_o_delete_sweep"
            label="Clear"
            flat
            no-caps
            @click="streamEvents = []"
          />
          <q-space />
          <div class="row items-center q-gutter-sm">
            <q-badge
              :color="streamPaused ? 'grey' : 'positive'"
              :label="streamPaused ? 'PAUSED' : 'LIVE'"
              class="q-pa-xs"
            />
            <span class="text-caption text-grey">
              {{ streamEvents.length }} events
            </span>
          </div>
        </div>

        <!-- Stream filter -->
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12 col-sm-4">
            <q-select
              v-model="streamFilter.type"
              outlined
              dense
              :options="eventTypeOptions"
              emit-value
              map-options
              label="Filter by type"
              clearable
            />
          </div>
          <div class="col-12 col-sm-4">
            <q-select
              v-model="streamFilter.severity"
              outlined
              dense
              :options="severityOptions"
              emit-value
              map-options
              label="Min. severity"
              clearable
            />
          </div>
        </div>

        <!-- Stream stats -->
        <div class="row q-col-gutter-md q-mb-md">
          <div class="col-6 col-sm-3">
            <q-card flat bordered>
              <q-card-section class="q-pa-sm text-center">
                <div class="text-caption text-grey">Events/min</div>
                <div class="text-h5">{{ streamRate }}</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-6 col-sm-3">
            <q-card flat bordered>
              <q-card-section class="q-pa-sm text-center">
                <div class="text-caption text-grey">Total today</div>
                <div class="text-h5">{{ store.eventsTotalCount }}</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-6 col-sm-3">
            <q-card flat bordered>
              <q-card-section class="q-pa-sm text-center">
                <div class="text-caption text-grey">Errors</div>
                <div class="text-h5 text-negative">{{ streamErrorCount }}</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-6 col-sm-3">
            <q-card flat bordered>
              <q-card-section class="q-pa-sm text-center">
                <div class="text-caption text-grey">NATS status</div>
                <q-badge color="positive" label="Connected" />
              </q-card-section>
            </q-card>
          </div>
        </div>

        <!-- Live event list -->
        <q-list bordered separator class="rounded-borders">
          <q-item
            v-for="ev in filteredStreamEvents"
            :key="ev.id"
            clickable
            v-ripple
            @click="showEventDetails(ev)"
          >
            <q-item-section avatar>
              <q-icon
                :name="streamSeverityIcon(ev)"
                :color="streamSeverityColor(ev)"
                size="20px"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>
                <q-badge
                  :color="eventTypeColor(ev.type)"
                  :label="eventTypeLabel(ev.type)"
                  class="q-mr-sm"
                />
                <span class="text-caption text-grey">
                  {{ ev.profileId?.slice(0, 8) || "system" }}
                </span>
              </q-item-label>
              <q-item-label caption>
                {{ ev.clientId || "—" }}
                <template v-if="ev.ipAddress"> · {{ ev.ipAddress }} </template>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label caption>
                {{ formatTimestamp(ev.timestamp) }}
              </q-item-label>
            </q-item-section>
          </q-item>

          <q-item v-if="filteredStreamEvents.length === 0">
            <q-item-section class="text-center text-grey q-pa-lg">
              <q-icon name="sym_o_stream" size="48px" color="grey-4" />
              <div class="q-mt-sm">
                {{
                  streamPaused
                    ? "Stream paused — click Resume to continue"
                    : "Waiting for events..."
                }}
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <!-- Event Catalog -->
        <q-expansion-item
          label="Event Catalog"
          icon="sym_o_category"
          header-class="text-subtitle2"
          class="q-mt-md"
        >
          <q-card flat>
            <q-card-section>
              <q-list dense separator>
                <template v-for="group in eventCatalog" :key="group.domain">
                  <q-item-label header>{{ group.domain }}</q-item-label>
                  <q-item v-for="evt in group.types" :key="evt.type">
                    <q-item-section avatar>
                      <q-icon :name="evt.icon" size="18px" :color="evt.color" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ evt.label }}</q-item-label>
                      <q-item-label caption>{{ evt.description }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-list>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-tab-panel>

      <!-- User Events Tab -->
      <q-tab-panel name="user-events" class="q-pa-none">
        <!-- Filters -->
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12 col-sm-3">
            <q-select
              v-model="eventFilters.type"
              outlined
              dense
              :options="eventTypeOptions"
              emit-value
              map-options
              label="Event Type"
              clearable
            />
          </div>
          <div class="col-12 col-sm-3">
            <q-input
              v-model="eventFilters.profileId"
              outlined
              dense
              label="Profile ID"
              clearable
            />
          </div>
          <div class="col-12 col-sm-2">
            <q-input
              v-model="eventFilters.clientId"
              outlined
              dense
              label="Application"
              clearable
            />
          </div>
          <div class="col-12 col-sm-2">
            <q-input
              v-model="eventFilters.ipAddress"
              outlined
              dense
              label="IP Address"
              clearable
            />
          </div>
          <div class="col-12 col-sm-2">
            <q-select
              v-model="eventFilters.outcome"
              outlined
              dense
              :options="outcomeOptions"
              emit-value
              map-options
              label="Outcome"
              clearable
            />
          </div>
        </div>
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12 col-sm-3">
            <q-input
              v-model="eventFilters.dateFrom"
              outlined
              dense
              label="From"
              type="date"
              clearable
            />
          </div>
          <div class="col-12 col-sm-3">
            <q-input
              v-model="eventFilters.dateTo"
              outlined
              dense
              label="To"
              type="date"
              clearable
            />
          </div>
          <div class="col-auto">
            <q-btn
              color="primary"
              icon="sym_o_search"
              label="Search"
              no-caps
              @click="loadUserEvents"
            />
          </div>
        </div>

        <!-- Events table -->
        <q-table
          :rows="store.events"
          :columns="eventColumns"
          row-key="id"
          flat
          bordered
          :pagination="{ rowsPerPage: 25 }"
        >
          <template #body-cell-type="props">
            <q-td :props="props">
              <q-badge
                :color="eventTypeColor(props.row.type)"
                :label="eventTypeLabel(props.row.type)"
              />
            </q-td>
          </template>
          <template #body-cell-timestamp="props">
            <q-td :props="props">
              {{ formatTimestamp(props.row.timestamp) }}
            </q-td>
          </template>
          <template #body-cell-outcome="props">
            <q-td :props="props">
              <q-icon
                v-if="!props.row.error"
                name="sym_o_check_circle"
                color="positive"
                size="sm"
              />
              <q-icon v-else name="sym_o_error" color="negative" size="sm">
                <q-tooltip>{{ props.row.error }}</q-tooltip>
              </q-icon>
            </q-td>
          </template>
          <template #body-cell-details="props">
            <q-td :props="props" auto-width>
              <q-btn
                v-if="props.row.details"
                flat
                round
                dense
                icon="sym_o_visibility"
                size="sm"
                @click="showEventDetails(props.row)"
              />
            </q-td>
          </template>
        </q-table>
        <div v-if="store.eventsNextToken" class="text-center q-mt-sm">
          <q-btn flat no-caps label="Load more" @click="moreUserEvents" />
        </div>
      </q-tab-panel>

      <!-- Admin Events Tab -->
      <q-tab-panel name="admin-events" class="q-pa-none">
        <!-- Filters -->
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12 col-sm-3">
            <q-select
              v-model="adminFilters.type"
              outlined
              dense
              :options="adminEventTypeOptions"
              emit-value
              map-options
              label="Operation"
              clearable
            />
          </div>
          <div class="col-12 col-sm-3">
            <q-input
              v-model="adminFilters.adminId"
              outlined
              dense
              label="Admin User ID"
              clearable
            />
          </div>
          <div class="col-12 col-sm-3">
            <q-input
              v-model="adminFilters.resourceType"
              outlined
              dense
              label="Resource Type"
              clearable
            />
          </div>
        </div>
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12 col-sm-3">
            <q-input
              v-model="adminFilters.dateFrom"
              outlined
              dense
              label="From"
              type="date"
              clearable
            />
          </div>
          <div class="col-12 col-sm-3">
            <q-input
              v-model="adminFilters.dateTo"
              outlined
              dense
              label="To"
              type="date"
              clearable
            />
          </div>
          <div class="col-auto">
            <q-btn
              color="primary"
              icon="sym_o_search"
              label="Search"
              no-caps
              @click="loadAdminEvents"
            />
          </div>
        </div>

        <!-- Admin events table -->
        <q-table
          :rows="store.adminEvents"
          :columns="adminEventColumns"
          row-key="id"
          flat
          bordered
          :pagination="{ rowsPerPage: 25 }"
        >
          <template #body-cell-type="props">
            <q-td :props="props">
              <q-badge
                :color="adminEventTypeColor(props.row.type)"
                :label="adminEventTypeLabel(props.row.type)"
              />
            </q-td>
          </template>
          <template #body-cell-timestamp="props">
            <q-td :props="props">
              {{ formatTimestamp(props.row.timestamp) }}
            </q-td>
          </template>
          <template #body-cell-details="props">
            <q-td :props="props" auto-width>
              <q-btn
                v-if="props.row.representation"
                flat
                round
                dense
                icon="sym_o_visibility"
                size="sm"
                @click="showAdminEventDetails(props.row)"
              />
            </q-td>
          </template>
        </q-table>
        <div v-if="store.adminEventsNextToken" class="text-center q-mt-sm">
          <q-btn flat no-caps label="Load more" @click="moreAdminEvents" />
        </div>
      </q-tab-panel>

      <!-- Audit Trail Tab -->
      <q-tab-panel name="audit" class="q-pa-none">
        <!-- Actions bar -->
        <div class="row items-center q-mb-md q-col-gutter-sm">
          <div class="col-12 col-sm-3">
            <q-input
              v-model="auditFilters.actorId"
              outlined
              dense
              label="Actor ID"
              clearable
            />
          </div>
          <div class="col-12 col-sm-3">
            <q-input
              v-model="auditFilters.resourceType"
              outlined
              dense
              label="Resource Type"
              clearable
            />
          </div>
          <div class="col-auto">
            <q-btn
              color="primary"
              icon="sym_o_search"
              label="Search"
              no-caps
              @click="loadAuditTrail"
            />
          </div>
          <q-space />
          <div class="col-auto q-gutter-sm">
            <q-btn
              outline
              color="primary"
              icon="sym_o_verified"
              label="Verify Chain"
              no-caps
              :loading="store.loading"
              @click="handleVerifyChain"
            />
            <q-btn-dropdown
              outline
              color="primary"
              icon="sym_o_download"
              label="Export"
              no-caps
            >
              <q-list dense>
                <q-item clickable v-close-popup @click="handleExport('json')">
                  <q-item-section>JSON</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="handleExport('csv')">
                  <q-item-section>CSV</q-item-section>
                </q-item>
              </q-list>
            </q-btn-dropdown>
          </div>
        </div>

        <!-- Verify result banner -->
        <q-banner
          v-if="store.verifyResult"
          dense
          :class="
            store.verifyResult.valid
              ? 'bg-positive text-white'
              : 'bg-negative text-white'
          "
          class="q-mb-md"
        >
          <template #avatar>
            <q-icon
              :name="
                store.verifyResult.valid ? 'sym_o_verified' : 'sym_o_gpp_bad'
              "
            />
          </template>
          <template v-if="store.verifyResult.valid">
            Chain integrity verified — {{ store.verifyResult.entriesChecked }}
            entries checked
          </template>
          <template v-else>
            Chain integrity BROKEN at entry
            {{ store.verifyResult.firstInvalidEntryId }}
            ({{ store.verifyResult.entriesChecked }} entries checked)
            <span v-if="store.verifyResult.error">
              — {{ store.verifyResult.error }}
            </span>
          </template>
        </q-banner>

        <!-- Audit table -->
        <q-table
          :rows="store.auditEntries"
          :columns="auditColumns"
          row-key="id"
          flat
          bordered
          :pagination="{ rowsPerPage: 25 }"
        >
          <template #body-cell-timestamp="props">
            <q-td :props="props">
              {{ formatTimestamp(props.row.timestamp) }}
            </q-td>
          </template>
          <template #body-cell-chain="props">
            <q-td :props="props" auto-width>
              <q-icon
                name="sym_o_link"
                size="xs"
                color="grey-6"
                class="cursor-pointer"
              >
                <q-tooltip>
                  Hash: {{ props.row.hash?.slice(0, 16) }}...
                  <br />
                  Prev:
                  {{ props.row.previousHash?.slice(0, 16) || "genesis" }}...
                </q-tooltip>
              </q-icon>
            </q-td>
          </template>
          <template #body-cell-details="props">
            <q-td :props="props" auto-width>
              <q-btn
                v-if="props.row.data"
                flat
                round
                dense
                icon="sym_o_visibility"
                size="sm"
                @click="showAuditDetails(props.row)"
              />
            </q-td>
          </template>
        </q-table>
        <div v-if="store.auditNextToken" class="text-center q-mt-sm">
          <q-btn flat no-caps label="Load more" @click="moreAuditTrail" />
        </div>
      </q-tab-panel>

      <!-- Config Tab -->
      <q-tab-panel name="config" class="q-pa-none">
        <template v-if="configForm">
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="text-subtitle1 text-weight-medium q-mb-md">
                User Events
              </div>
              <div class="q-mb-md">
                <div class="text-body2 text-weight-medium q-mb-sm">
                  Enabled Event Types
                </div>
                <div class="row q-col-gutter-sm">
                  <div
                    v-for="opt in allEventTypeOptions"
                    :key="opt.value"
                    class="col-6 col-sm-4 col-md-3"
                  >
                    <q-checkbox
                      :model-value="
                        configForm.enabledEventTypes.includes(opt.value)
                      "
                      :label="opt.label"
                      dense
                      @update:model-value="
                        toggleEventType(opt.value, $event as boolean)
                      "
                    />
                  </div>
                </div>
              </div>
              <q-input
                v-model.number="configForm.retentionDays"
                outlined
                dense
                label="Retention (days)"
                type="number"
                style="max-width: 200px"
              />
            </q-card-section>
          </q-card>

          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="text-subtitle1 text-weight-medium q-mb-md">
                Admin Events
              </div>
              <q-toggle
                v-model="configForm.adminEventsEnabled"
                label="Enable admin event logging"
                class="q-mb-md"
              />
              <q-toggle
                v-model="configForm.saveRepresentations"
                label="Save before/after state in admin events"
                :disable="!configForm.adminEventsEnabled"
              />
            </q-card-section>
          </q-card>

          <q-btn
            color="primary"
            label="Save Configuration"
            no-caps
            :loading="store.loading"
            @click="saveConfig"
          />
        </template>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Event Details Dialog -->
    <q-dialog v-model="showDetailsDialog">
      <q-card style="min-width: 500px; max-width: 700px">
        <q-card-section>
          <div class="text-h6">Event Details</div>
        </q-card-section>
        <q-card-section>
          <pre
            class="bg-grey-2 q-pa-md rounded-borders text-body2"
            style="overflow-x: auto; max-height: 400px"
            >{{ detailsJson }}</pre>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useEventsStore } from "src/stores/events";
import {
  EventType,
  AdminEventType,
  Event as SidEvent,
  AdminEvent,
  AuditEntry,
} from "@structured-id/proto/sid/v1/admin/events";
import type { EventConfig } from "@structured-id/proto/sid/v1/admin/events";
import { prettyJson } from "src/composables/protoJson";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import {
  eventTypeLabel,
  eventTypeColor,
  adminEventTypeLabel,
  adminEventTypeColor,
} from "src/composables/useEnumLabels";
import type { QTableColumn } from "quasar";

const store = useEventsStore();

const tab = ref("live-stream");
const showDetailsDialog = ref(false);
const detailsJson = ref("");

// ── Live Stream ──
const streamEvents = ref<SidEvent[]>([]);
const streamPaused = ref(false);
const streamFilter = ref({
  type: undefined as EventType | undefined,
  severity: undefined as string | undefined,
});
let streamInterval: ReturnType<typeof setInterval> | null = null;
let lastStreamFetch = "";

const severityOptions = [
  { label: "Info", value: "info" },
  { label: "Warning", value: "warning" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
];

const streamRate = computed(() => {
  if (streamEvents.value.length < 2) return 0;
  const now = Date.now();
  const oneMinAgo = now - 60_000;
  const recent = streamEvents.value.filter((e) => {
    if (!e.timestamp) return false;
    const ts = Number(e.timestamp.seconds) * 1000;
    return ts >= oneMinAgo;
  });
  return recent.length;
});

const streamErrorCount = computed(
  () => streamEvents.value.filter((e) => e.error).length,
);

const filteredStreamEvents = computed(() => {
  let result = streamEvents.value;
  if (streamFilter.value.type != null) {
    result = result.filter((e) => e.type === streamFilter.value.type);
  }
  return result.slice(0, 200); // Limit display
});

const ERROR_TYPES = new Set([EventType.LOGIN_ERROR]);

const SECURITY_TYPES = new Set([
  EventType.IMPERSONATION,
  EventType.DELETE_ACCOUNT,
  EventType.RESET_PASSWORD,
]);

function streamSeverityIcon(ev: SidEvent): string {
  if (ev.error) return "sym_o_error";
  if (SECURITY_TYPES.has(ev.type)) return "sym_o_warning";
  if (ERROR_TYPES.has(ev.type)) return "sym_o_warning";
  return "sym_o_info";
}

function streamSeverityColor(ev: SidEvent): string {
  if (ev.error) return "negative";
  if (SECURITY_TYPES.has(ev.type)) return "orange";
  if (ERROR_TYPES.has(ev.type)) return "amber";
  return "blue";
}

const eventCatalog = [
  {
    domain: "Authentication",
    types: [
      {
        type: "login",
        label: "Login",
        description: "Successful sign-in",
        icon: "sym_o_login",
        color: "blue",
      },
      {
        type: "login_error",
        label: "Login Error",
        description: "Failed sign-in attempt",
        icon: "sym_o_error",
        color: "negative",
      },
      {
        type: "logout",
        label: "Logout",
        description: "User sign-out",
        icon: "sym_o_logout",
        color: "grey",
      },
      {
        type: "register",
        label: "Register",
        description: "New account registration",
        icon: "sym_o_person_add",
        color: "positive",
      },
    ],
  },
  {
    domain: "Credentials",
    types: [
      {
        type: "update_password",
        label: "Password Change",
        description: "Password updated via OPAQUE",
        icon: "sym_o_password",
        color: "primary",
      },
      {
        type: "reset_password",
        label: "Password Reset",
        description: "Password reset flow completed",
        icon: "sym_o_lock_reset",
        color: "orange",
      },
      {
        type: "mfa_enroll",
        label: "MFA Enroll",
        description: "New MFA factor enrolled",
        icon: "sym_o_security",
        color: "positive",
      },
      {
        type: "mfa_verify",
        label: "MFA Verify",
        description: "MFA challenge completed",
        icon: "sym_o_verified_user",
        color: "blue",
      },
      {
        type: "mfa_remove",
        label: "MFA Remove",
        description: "MFA factor removed",
        icon: "sym_o_delete",
        color: "warning",
      },
    ],
  },
  {
    domain: "Tokens & Consent",
    types: [
      {
        type: "token_issued",
        label: "Token Issued",
        description: "OAuth2 token issued",
        icon: "sym_o_token",
        color: "blue",
      },
      {
        type: "token_refreshed",
        label: "Token Refreshed",
        description: "Token refresh grant",
        icon: "sym_o_refresh",
        color: "grey",
      },
      {
        type: "token_revoked",
        label: "Token Revoked",
        description: "Token revoked",
        icon: "sym_o_block",
        color: "warning",
      },
      {
        type: "consent_granted",
        label: "Consent Granted",
        description: "Scope consent given",
        icon: "sym_o_check",
        color: "positive",
      },
      {
        type: "consent_revoked",
        label: "Consent Revoked",
        description: "Scope consent withdrawn",
        icon: "sym_o_cancel",
        color: "negative",
      },
    ],
  },
  {
    domain: "Profile & Admin",
    types: [
      {
        type: "update_profile",
        label: "Profile Update",
        description: "User profile modified",
        icon: "sym_o_edit",
        color: "primary",
      },
      {
        type: "delete_account",
        label: "Account Deletion",
        description: "Account permanently deleted",
        icon: "sym_o_person_remove",
        color: "negative",
      },
      {
        type: "impersonation",
        label: "Impersonation",
        description: "Admin impersonating user",
        icon: "sym_o_supervisor_account",
        color: "orange",
      },
      {
        type: "verify_email",
        label: "Email Verified",
        description: "Email address verified",
        icon: "sym_o_mark_email_read",
        color: "positive",
      },
    ],
  },
];

async function pollStream() {
  if (streamPaused.value) return;
  try {
    // The stream's own page: the User Events search keeps its results.
    const page = await store.pollEvents({
      pageSize: 10,
      pageToken: lastStreamFetch,
      type: streamFilter.value.type,
    });
    if (page.events.length > 0) {
      // Prepend new events (newest first)
      const existingIds = new Set(streamEvents.value.map((e) => e.id));
      const newEvents = page.events.filter((e) => !existingIds.has(e.id));
      if (newEvents.length > 0) {
        streamEvents.value = [...newEvents, ...streamEvents.value].slice(
          0,
          500,
        );
      }
      lastStreamFetch = page.nextPageToken;
    }
  } catch {
    // Silent — polling errors are not critical
  }
}

function startPolling() {
  if (streamInterval) clearInterval(streamInterval);
  streamInterval = setInterval(pollStream, 5000); // Poll every 5 seconds
  pollStream(); // Immediate first poll
}

function stopPolling() {
  if (streamInterval) {
    clearInterval(streamInterval);
    streamInterval = null;
  }
}

const eventFilters = ref({
  type: undefined as EventType | undefined,
  profileId: "",
  clientId: "",
  ipAddress: "",
  outcome: undefined as "success" | "error" | undefined,
  dateFrom: "",
  dateTo: "",
});

const adminFilters = ref({
  type: undefined as AdminEventType | undefined,
  adminId: "",
  resourceType: "",
  dateFrom: "",
  dateTo: "",
});

const outcomeOptions = [
  { label: "Success", value: "success" },
  { label: "Error", value: "error" },
];

const auditFilters = ref({
  actorId: "",
  resourceType: "",
});

const configForm = ref<EventConfig | null>(null);

const eventTypeOptions = [
  { label: "Login", value: EventType.LOGIN },
  { label: "Login Error", value: EventType.LOGIN_ERROR },
  { label: "Logout", value: EventType.LOGOUT },
  { label: "Register", value: EventType.REGISTER },
  { label: "Update Password", value: EventType.UPDATE_PASSWORD },
  { label: "Reset Password", value: EventType.RESET_PASSWORD },
  { label: "Verify Email", value: EventType.VERIFY_EMAIL },
  { label: "MFA Enroll", value: EventType.MFA_ENROLL },
  { label: "MFA Verify", value: EventType.MFA_VERIFY },
  { label: "MFA Remove", value: EventType.MFA_REMOVE },
  { label: "Token Issued", value: EventType.TOKEN_ISSUED },
  { label: "Token Refreshed", value: EventType.TOKEN_REFRESHED },
  { label: "Token Revoked", value: EventType.TOKEN_REVOKED },
  { label: "Consent Granted", value: EventType.CONSENT_GRANTED },
  { label: "Consent Revoked", value: EventType.CONSENT_REVOKED },
  { label: "Update Profile", value: EventType.UPDATE_PROFILE },
  { label: "Delete Account", value: EventType.DELETE_ACCOUNT },
  { label: "Impersonation", value: EventType.IMPERSONATION },
];

const allEventTypeOptions = eventTypeOptions;

const adminEventTypeOptions = [
  { label: "Create", value: AdminEventType.CREATE },
  { label: "Update", value: AdminEventType.UPDATE },
  { label: "Delete", value: AdminEventType.DELETE },
  { label: "Action", value: AdminEventType.ACTION },
];

const eventColumns: QTableColumn[] = [
  {
    name: "timestamp",
    label: "Timestamp",
    field: "timestamp",
    align: "left",
    sortable: true,
  },
  { name: "type", label: "Type", field: "type", align: "left", sortable: true },
  {
    name: "profileId",
    label: "User",
    field: "profileId",
    align: "left",
    format: (v: string) => v?.slice(0, 8) || "—",
  },
  {
    name: "clientId",
    label: "Application",
    field: "clientId",
    align: "left",
    format: (v: string) => v || "—",
  },
  {
    name: "ipAddress",
    label: "IP",
    field: "ipAddress",
    align: "left",
  },
  {
    name: "outcome",
    label: "Outcome",
    field: "error",
    align: "center",
  },
  { name: "details", label: "", field: "id", align: "right" },
];

const adminEventColumns: QTableColumn[] = [
  {
    name: "timestamp",
    label: "Timestamp",
    field: "timestamp",
    align: "left",
    sortable: true,
  },
  {
    name: "type",
    label: "Operation",
    field: "type",
    align: "left",
    sortable: true,
  },
  {
    name: "adminId",
    label: "Admin",
    field: "adminId",
    align: "left",
    format: (v: string) => v?.slice(0, 8) || "—",
  },
  {
    name: "resourceType",
    label: "Resource Type",
    field: "resourceType",
    align: "left",
  },
  {
    name: "resourcePath",
    label: "Resource",
    field: "resourcePath",
    align: "left",
  },
  {
    name: "ipAddress",
    label: "IP",
    field: "ipAddress",
    align: "left",
  },
  { name: "details", label: "", field: "id", align: "right" },
];

const auditColumns: QTableColumn[] = [
  {
    name: "timestamp",
    label: "Timestamp",
    field: "timestamp",
    align: "left",
    sortable: true,
  },
  {
    name: "eventType",
    label: "Action",
    field: "eventType",
    align: "left",
    sortable: true,
  },
  {
    name: "actorType",
    label: "Actor Type",
    field: "actorType",
    align: "left",
  },
  {
    name: "actorId",
    label: "Actor",
    field: "actorId",
    align: "left",
    format: (v: string) => v?.slice(0, 8) || "—",
  },
  {
    name: "resourceType",
    label: "Resource Type",
    field: "resourceType",
    align: "left",
  },
  {
    name: "resourceId",
    label: "Resource",
    field: "resourceId",
    align: "left",
    format: (v: string) => v?.slice(0, 8) || "—",
  },
  { name: "chain", label: "Chain", field: "hash", align: "center" },
  { name: "details", label: "", field: "id", align: "right" },
];

function formatTimestamp(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  const date = new Date(Number(ts.seconds) * 1000 + ts.nanos / 1_000_000);
  return date.toLocaleString();
}

watch(
  () => store.eventConfig,
  (cfg) => {
    if (cfg) {
      configForm.value = {
        ...cfg,
        enabledEventTypes: [...cfg.enabledEventTypes],
      };
    }
  },
);

onMounted(() => {
  startPolling();
  store.fetchEventConfig();
});

onUnmounted(() => {
  stopPolling();
});

function dateToTimestamp(
  dateStr: string,
): { seconds: bigint; nanos: number } | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  return { seconds: BigInt(Math.floor(d.getTime() / 1000)), nanos: 0 };
}

// Each search keeps the filters it ran with: "Load more" continues that
// search, not whatever the filter fields hold now.
let userQuery: Omit<Parameters<typeof store.fetchEvents>[0], "pageToken"> = {
  pageSize: 25,
};
let adminQuery: Omit<
  Parameters<typeof store.fetchAdminEvents>[0],
  "pageToken"
> = { pageSize: 25 };
let auditQuery: Omit<Parameters<typeof store.fetchAuditTrail>[0], "pageToken"> =
  { pageSize: 25 };

function loadUserEvents() {
  userQuery = {
    pageSize: 25,
    type: eventFilters.value.type,
    profileId: eventFilters.value.profileId || undefined,
    clientId: eventFilters.value.clientId || undefined,
    ipAddress: eventFilters.value.ipAddress || undefined,
    from: dateToTimestamp(eventFilters.value.dateFrom),
    to: dateToTimestamp(eventFilters.value.dateTo),
  };
  store.fetchEvents({ ...userQuery, pageToken: "" });
}

function moreUserEvents() {
  store.fetchEvents({ ...userQuery, pageToken: store.eventsNextToken });
}

function loadAdminEvents() {
  adminQuery = {
    pageSize: 25,
    type: adminFilters.value.type,
    adminId: adminFilters.value.adminId || undefined,
    resourceType: adminFilters.value.resourceType || undefined,
    from: dateToTimestamp(adminFilters.value.dateFrom),
    to: dateToTimestamp(adminFilters.value.dateTo),
  };
  store.fetchAdminEvents({ ...adminQuery, pageToken: "" });
}

function moreAdminEvents() {
  store.fetchAdminEvents({
    ...adminQuery,
    pageToken: store.adminEventsNextToken,
  });
}

function loadAuditTrail() {
  auditQuery = {
    pageSize: 25,
    actorId: auditFilters.value.actorId || undefined,
    resourceType: auditFilters.value.resourceType || undefined,
  };
  store.fetchAuditTrail({ ...auditQuery, pageToken: "" });
}

function moreAuditTrail() {
  store.fetchAuditTrail({ ...auditQuery, pageToken: store.auditNextToken });
}

function showEventDetails(event: SidEvent) {
  detailsJson.value = prettyJson(SidEvent, event);
  showDetailsDialog.value = true;
}

function showAdminEventDetails(event: AdminEvent) {
  detailsJson.value = prettyJson(AdminEvent, event);
  showDetailsDialog.value = true;
}

function showAuditDetails(entry: AuditEntry) {
  detailsJson.value = prettyJson(AuditEntry, entry);
  showDetailsDialog.value = true;
}

async function handleVerifyChain() {
  await store.verifyChain();
}

async function handleExport(format: string) {
  await store.exportAuditTrail({
    format,
    actorId: auditFilters.value.actorId || undefined,
    resourceType: auditFilters.value.resourceType || undefined,
  });
}

function toggleEventType(type: EventType, enabled: boolean) {
  if (!configForm.value) return;
  if (enabled) {
    configForm.value.enabledEventTypes.push(type);
  } else {
    configForm.value.enabledEventTypes =
      configForm.value.enabledEventTypes.filter((t) => t !== type);
  }
}

async function saveConfig() {
  if (!configForm.value) return;
  await store.updateEventConfig(configForm.value);
}
</script>
