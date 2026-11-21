<template>
  <q-page padding>
    <div class="text-h5 q-mb-md">Instance Operations</div>

    <q-tabs
      v-model="activeTab"
      dense
      align="left"
      class="text-grey"
      active-color="primary"
      indicator-color="primary"
    >
      <q-tab name="flags" label="Feature Flags" icon="sym_o_flag" />
      <q-tab name="health" label="System Health" icon="sym_o_monitor_heart" />
      <q-tab name="license" label="License" icon="sym_o_license" />
      <q-tab name="channels" label="Notification Channels" icon="sym_o_send" />
    </q-tabs>

    <q-separator />

    <q-tab-panels v-model="activeTab" animated class="q-mt-md">
      <!-- ═══════════════════════════ FEATURE FLAGS ═══════════════════════════ -->
      <q-tab-panel name="flags">
        <!-- Propagation indicator -->
        <div v-if="store.propagation" class="q-mb-md">
          <q-badge
            :color="
              store.propagation.syncedNodes === store.propagation.totalNodes
                ? 'positive'
                : 'warning'
            "
            class="q-pa-sm"
          >
            <q-icon
              :name="
                store.propagation.syncedNodes === store.propagation.totalNodes
                  ? 'sym_o_check_circle'
                  : 'sym_o_pending'
              "
              class="q-mr-xs"
              size="xs"
            />
            Propagation: {{ store.propagation.syncedNodes }}/{{
              store.propagation.totalNodes
            }}
            nodes synced
          </q-badge>
        </div>

        <q-table
          :rows="store.flags"
          :columns="flagColumns"
          row-key="flagName"
          flat
          bordered
          :loading="store.loading"
          :pagination="{ rowsPerPage: 20 }"
        >
          <template #body-cell-status="props">
            <q-td :props="props">
              <q-icon
                :name="
                  props.row.enabled ? 'sym_o_toggle_on' : 'sym_o_toggle_off'
                "
                :color="props.row.enabled ? 'positive' : 'negative'"
                size="sm"
              />
              {{ props.row.enabled ? "ON" : "OFF" }}
            </q-td>
          </template>

          <template #body-cell-override="props">
            <q-td :props="props">
              <q-badge
                v-if="props.row.hasOverride"
                :color="props.row.overrideValue ? 'positive' : 'negative'"
              >
                {{ props.row.overrideValue ? "ON" : "OFF" }}
              </q-badge>
              <span v-else class="text-grey">—</span>
            </q-td>
          </template>

          <template #body-cell-default="props">
            <q-td :props="props">
              <q-badge
                :color="props.row.defaultValue ? 'positive' : 'grey'"
                outline
              >
                {{ props.row.defaultValue ? "ON" : "OFF" }}
              </q-badge>
            </q-td>
          </template>

          <template #body-cell-actions="props">
            <q-td :props="props">
              <q-btn
                flat
                dense
                round
                :icon="
                  props.row.enabled ? 'sym_o_toggle_off' : 'sym_o_toggle_on'
                "
                :color="props.row.enabled ? 'negative' : 'positive'"
                size="sm"
                @click="confirmToggleFlag(props.row)"
              >
                <q-tooltip>{{
                  props.row.enabled ? "Disable" : "Enable"
                }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="props.row.hasOverride"
                flat
                dense
                round
                icon="sym_o_restart_alt"
                color="grey"
                size="sm"
                @click="confirmResetFlag(props.row)"
              >
                <q-tooltip>Reset to default</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                icon="sym_o_history"
                color="grey"
                size="sm"
                @click="showFlagHistory(props.row)"
              >
                <q-tooltip>History</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- ═══════════════════════════ SYSTEM HEALTH ═══════════════════════════ -->
      <q-tab-panel name="health">
        <!-- Health probes -->
        <div v-if="store.healthStatus" class="q-mb-lg">
          <div class="text-subtitle1 q-mb-sm">Health Probes</div>
          <div class="row q-gutter-md">
            <div
              v-for="probe in store.healthStatus.probes"
              :key="probe.name"
              class="col-auto"
            >
              <q-chip
                :color="probeStatusColor(probe.status)"
                text-color="white"
                :icon="
                  probe.status === ProbeStatus.OK
                    ? 'sym_o_check_circle'
                    : 'sym_o_error'
                "
              >
                {{ probe.name }}: {{ probeStatusLabel(probe.status) }}
                <q-tooltip v-if="probe.errorMessage">{{
                  probe.errorMessage
                }}</q-tooltip>
              </q-chip>
            </div>
          </div>
        </div>

        <!-- Dependency matrix -->
        <div v-if="store.healthStatus" class="q-mb-lg">
          <div class="text-subtitle1 q-mb-sm">Dependencies</div>
          <div class="row q-gutter-md">
            <q-card
              v-for="dep in store.healthStatus.dependencies"
              :key="dep.name"
              flat
              bordered
              class="col-12 col-sm-6 col-md-4 col-lg-3"
            >
              <q-card-section>
                <div class="row items-center q-mb-sm">
                  <q-icon
                    name="sym_o_circle"
                    :color="dependencyStatusColor(dep.status)"
                    size="xs"
                    class="q-mr-sm"
                  />
                  <span class="text-weight-medium">{{ dep.name }}</span>
                </div>
                <div class="text-caption text-grey">
                  Latency: {{ dep.latencyMs }}ms
                </div>
                <div v-if="dep.version" class="text-caption text-grey">
                  Version: {{ dep.version }}
                </div>
                <div v-if="dep.detail" class="text-caption text-grey">
                  {{ dep.detail }}
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <!-- Instance info -->
        <div v-if="store.instanceInfo">
          <div class="text-subtitle1 q-mb-sm">Instance Information</div>
          <q-card flat bordered>
            <q-card-section>
              <q-list dense separator>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>Version</q-item-label>
                    <q-item-label>{{
                      store.instanceInfo.version
                    }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>Build</q-item-label>
                    <q-item-label
                      >{{ store.instanceInfo.buildCommit }} ({{
                        store.instanceInfo.buildDate
                      }})</q-item-label
                    >
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>Edition</q-item-label>
                    <q-item-label>
                      <q-badge color="grey-7">
                        {{ store.instanceInfo.edition }}
                      </q-badge>
                    </q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>Instance ID</q-item-label>
                    <q-item-label class="text-mono">{{
                      store.instanceInfo.instanceId
                    }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>Uptime</q-item-label>
                    <q-item-label>{{ store.instanceInfo.uptime }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>Rust Version</q-item-label>
                    <q-item-label>{{
                      store.instanceInfo.rustVersion
                    }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>Compiled Features</q-item-label>
                    <q-item-label>
                      <q-badge
                        v-for="feat in store.instanceInfo.compiledFeatures"
                        :key="feat"
                        outline
                        color="primary"
                        class="q-mr-xs q-mb-xs"
                      >
                        {{ feat }}
                      </q-badge>
                    </q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>OS</q-item-label>
                    <q-item-label>{{ store.instanceInfo.os }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>Nodes</q-item-label>
                    <q-item-label
                      >{{ store.instanceInfo.healthyNodes }} /
                      {{ store.instanceInfo.nodeCount }} healthy</q-item-label
                    >
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>
      </q-tab-panel>

      <!-- ═══════════════════════════ LICENSE ═══════════════════════════ -->
      <q-tab-panel name="license">
        <!-- CE upgrade prompt -->
        <q-card flat bordered class="q-pa-md" style="max-width: 500px">
          <q-card-section>
            <div class="text-h6">StructuredID Community Edition</div>
            <div
              v-if="store.instanceInfo"
              class="text-caption text-grey q-mb-md"
            >
              Version {{ store.instanceInfo.version }}
            </div>

            <div class="text-subtitle2 q-mb-sm">Upgrade to Enterprise for:</div>
            <q-list dense>
              <q-item v-for="feat in eeFeatures" :key="feat">
                <q-item-section avatar>
                  <q-icon name="sym_o_check" color="positive" size="xs" />
                </q-item-section>
                <q-item-section>{{ feat }}</q-item-section>
              </q-item>
            </q-list>
          </q-card-section>

          <q-card-actions>
            <q-btn
              flat
              color="primary"
              label="Learn More"
              href="https://structured.id/enterprise"
              target="_blank"
            />
            <q-btn
              flat
              color="secondary"
              label="Contact Sales"
              href="https://structured.id/contact"
              target="_blank"
            />
          </q-card-actions>
        </q-card>
      </q-tab-panel>

      <!-- ═══════════════════════════ NOTIFICATION CHANNELS ═══════════════════════════ -->
      <q-tab-panel name="channels">
        <!-- Channel overview cards -->
        <div class="row q-gutter-md q-mb-lg">
          <q-card
            v-for="ch in store.channels"
            :key="ch.channel"
            flat
            bordered
            class="col-12 col-sm-6 col-md-3"
          >
            <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon
                  :name="channelTypeIcon(ch.channel)"
                  size="sm"
                  class="q-mr-sm"
                />
                <span class="text-weight-medium">{{
                  channelTypeLabel(ch.channel)
                }}</span>
              </div>
              <q-badge :color="channelHealthColor(ch.health)" class="q-mb-sm">
                {{ channelHealthLabel(ch.health) }}
              </q-badge>
              <div
                v-if="ch.health !== ChannelHealth.NOT_CONFIGURED"
                class="text-caption text-grey"
              >
                <div>Sent today: {{ ch.sentToday }}</div>
                <div>
                  Failed: {{ ch.failedToday }} ({{
                    ch.sentToday > 0
                      ? ((ch.failedToday / ch.sentToday) * 100).toFixed(1)
                      : 0
                  }}%)
                </div>
                <div>Avg latency: {{ ch.avgLatencyMs }}ms</div>
              </div>
            </q-card-section>

            <q-card-actions>
              <q-btn
                flat
                dense
                size="sm"
                label="Configure"
                @click="openChannelConfig(ch.channel)"
              />
              <q-btn
                v-if="ch.health !== ChannelHealth.NOT_CONFIGURED"
                flat
                dense
                size="sm"
                label="Test"
                @click="openTestChannel(ch.channel)"
              />
            </q-card-actions>
          </q-card>
        </div>

        <!-- Delivery health -->
        <div class="q-mb-lg">
          <div class="row items-center q-mb-sm">
            <div class="text-subtitle1">Delivery Health</div>
            <q-space />
            <q-btn-toggle
              v-model="deliveryPeriod"
              no-caps
              dense
              flat
              toggle-color="primary"
              :options="[
                { label: '24h', value: '24h' },
                { label: '7d', value: '7d' },
                { label: '30d', value: '30d' },
              ]"
              @update:model-value="loadDeliveryHealth"
            />
          </div>

          <div v-if="store.deliveryHealth" class="row q-gutter-md">
            <q-card flat bordered class="col-12 col-sm-6 col-md-2">
              <q-card-section class="text-center">
                <div class="text-h6">{{ store.deliveryHealth.totalSent }}</div>
                <div class="text-caption text-grey">Sent</div>
              </q-card-section>
            </q-card>
            <q-card flat bordered class="col-12 col-sm-6 col-md-2">
              <q-card-section class="text-center">
                <div class="text-h6 text-positive">
                  {{ store.deliveryHealth.totalDelivered }}
                </div>
                <div class="text-caption text-grey">Delivered</div>
              </q-card-section>
            </q-card>
            <q-card flat bordered class="col-12 col-sm-6 col-md-2">
              <q-card-section class="text-center">
                <div class="text-h6 text-negative">
                  {{ store.deliveryHealth.totalFailed }}
                </div>
                <div class="text-caption text-grey">Failed</div>
              </q-card-section>
            </q-card>
            <q-card flat bordered class="col-12 col-sm-6 col-md-2">
              <q-card-section class="text-center">
                <div class="text-h6">
                  {{ (store.deliveryHealth.bounceRate * 100).toFixed(1) }}%
                </div>
                <div class="text-caption text-grey">Bounce Rate</div>
              </q-card-section>
            </q-card>
            <q-card flat bordered class="col-12 col-sm-6 col-md-2">
              <q-card-section class="text-center">
                <div class="text-h6">
                  {{ store.deliveryHealth.avgLatencyMs }}ms
                </div>
                <div class="text-caption text-grey">Avg Latency</div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <!-- Default preferences -->
        <div>
          <div class="text-subtitle1 q-mb-sm">Default Delivery Preferences</div>
          <q-table
            v-if="store.defaultPreferences"
            :rows="store.defaultPreferences.preferences"
            :columns="prefColumns"
            row-key="eventCategory"
            flat
            bordered
            :pagination="{ rowsPerPage: 20 }"
          >
            <template #body-cell-email="props">
              <q-td :props="props">
                <q-toggle
                  v-model="props.row.email"
                  :disable="props.row.mandatory"
                  dense
                  @update:model-value="savePrefDebounced"
                />
              </q-td>
            </template>
            <template #body-cell-sms="props">
              <q-td :props="props">
                <q-toggle
                  v-model="props.row.sms"
                  dense
                  @update:model-value="savePrefDebounced"
                />
              </q-td>
            </template>
            <template #body-cell-push="props">
              <q-td :props="props">
                <q-toggle
                  v-model="props.row.push"
                  dense
                  @update:model-value="savePrefDebounced"
                />
              </q-td>
            </template>
            <template #body-cell-webhook="props">
              <q-td :props="props">
                <q-toggle
                  v-model="props.row.webhook"
                  dense
                  @update:model-value="savePrefDebounced"
                />
              </q-td>
            </template>
            <template #body-cell-mandatory="props">
              <q-td :props="props">
                <q-badge v-if="props.row.mandatory" color="negative" outline
                  >Mandatory</q-badge
                >
                <span v-else class="text-caption text-grey"
                  >User can disable</span
                >
              </q-td>
            </template>
          </q-table>
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <!-- ═══════════════════════════ DIALOGS ═══════════════════════════ -->

    <!-- Toggle flag confirmation -->
    <q-dialog v-model="toggleDialog.visible">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">
            {{ toggleDialog.enabling ? "Enable" : "Disable" }} Flag
          </div>
        </q-card-section>
        <q-card-section>
          <p>
            <code>{{ toggleDialog.flagName }}</code>:
            {{ toggleDialog.enabling ? "OFF → ON" : "ON → OFF" }}
          </p>
          <p
            v-if="
              toggleDialog.flagName === 'maintenance_mode' &&
              toggleDialog.enabling
            "
            class="text-negative text-weight-medium"
          >
            All user-facing endpoints will return 503. Only operator access
            remains.
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            :color="toggleDialog.enabling ? 'positive' : 'negative'"
            :label="toggleDialog.enabling ? 'Enable' : 'Disable'"
            :loading="store.saving"
            @click="doToggleFlag"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Flag history -->
    <q-dialog v-model="historyDialog.visible" position="right" full-height>
      <q-card style="width: 450px">
        <q-card-section class="row items-center">
          <div class="text-h6">
            History: <code>{{ historyDialog.flagName }}</code>
          </div>
          <q-space />
          <q-btn flat round dense icon="sym_o_close" v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section class="scroll" style="max-height: calc(100vh - 120px)">
          <q-timeline color="primary">
            <q-timeline-entry
              v-for="(entry, i) in store.flagHistory"
              :key="i"
              :subtitle="formatTimestamp(entry.timestamp)"
            >
              <div>
                <strong>{{ entry.adminName }}</strong> {{ entry.action }}
              </div>
              <div class="text-caption text-grey">
                Previous: {{ entry.previousValue ? "ON" : "OFF" }}
              </div>
            </q-timeline-entry>
          </q-timeline>
          <div
            v-if="store.flagHistory.length === 0"
            class="text-grey text-center q-pa-lg"
          >
            No history entries
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Channel configuration -->
    <q-dialog v-model="configDialog.visible" persistent>
      <q-card style="min-width: 550px">
        <q-card-section>
          <div class="text-h6">Configure {{ configDialog.channelLabel }}</div>
        </q-card-section>

        <q-card-section v-if="store.channelConfig">
          <q-toggle
            v-model="store.channelConfig.enabled"
            label="Enabled"
            class="q-mb-md"
          />

          <!-- Email config -->
          <template v-if="store.channelConfig.config.oneofKind === 'email'">
            <q-input
              v-model="store.channelConfig.config.email.smtpHost"
              label="SMTP Host"
              outlined
              dense
              class="q-mb-sm"
            />
            <q-input
              v-model.number="store.channelConfig.config.email.smtpPort"
              label="SMTP Port"
              type="number"
              outlined
              dense
              class="q-mb-sm"
            />
            <q-select
              v-model="store.channelConfig.config.email.encryption"
              :options="smtpEncryptionOptions"
              label="Encryption"
              outlined
              dense
              emit-value
              map-options
              class="q-mb-sm"
            />
            <q-input
              v-model="store.channelConfig.config.email.username"
              label="Username"
              outlined
              dense
              class="q-mb-sm"
            />
            <q-input
              v-model="store.channelConfig.config.email.password"
              label="Password"
              type="password"
              outlined
              dense
              class="q-mb-sm"
              hint="Leave empty to keep current"
            />
            <q-input
              v-model="store.channelConfig.config.email.fromAddress"
              label="From Address"
              outlined
              dense
              class="q-mb-sm"
            />
            <q-input
              v-model="store.channelConfig.config.email.fromName"
              label="From Name"
              outlined
              dense
              class="q-mb-sm"
            />
            <q-input
              v-model="store.channelConfig.config.email.replyTo"
              label="Reply-To"
              outlined
              dense
              class="q-mb-sm"
            />
            <q-input
              v-model.number="
                store.channelConfig.config.email.rateLimitPerMinute
              "
              label="Rate Limit (per minute)"
              type="number"
              outlined
              dense
              class="q-mb-sm"
            />
            <q-input
              v-model.number="
                store.channelConfig.config.email.connectionTimeoutSeconds
              "
              label="Connection Timeout (seconds)"
              type="number"
              outlined
              dense
            />
          </template>

          <!-- SMS config -->
          <template v-if="store.channelConfig.config.oneofKind === 'sms'">
            <q-input
              v-model="store.channelConfig.config.sms.gatewayUrl"
              label="Gateway URL"
              outlined
              dense
              class="q-mb-sm"
            />
            <q-select
              v-model="store.channelConfig.config.sms.httpMethod"
              :options="smsMethodOptions"
              label="HTTP Method"
              outlined
              dense
              emit-value
              map-options
              class="q-mb-sm"
            />
            <q-input
              v-model="store.channelConfig.config.sms.authHeader"
              label="Auth Header"
              outlined
              dense
              class="q-mb-sm"
              hint="e.g. Authorization: Bearer <token>"
            />
            <q-input
              v-model="store.channelConfig.config.sms.bodyTemplate"
              label="Body Template"
              type="textarea"
              outlined
              dense
              class="q-mb-sm"
              hint="JSON with {{phone}} and {{text}} placeholders"
            />
            <q-input
              v-model.number="store.channelConfig.config.sms.rateLimitPerMinute"
              label="Rate Limit (per minute)"
              type="number"
              outlined
              dense
            />
          </template>

          <!-- Web Push config -->
          <template v-if="store.channelConfig.config.oneofKind === 'webPush'">
            <q-input
              v-model="store.channelConfig.config.webPush.vapidSubject"
              label="VAPID Subject"
              outlined
              dense
              class="q-mb-sm"
              hint="mailto: or URL"
            />
            <q-input
              v-model="store.channelConfig.config.webPush.vapidPublicKey"
              label="VAPID Public Key"
              outlined
              dense
              readonly
              class="q-mb-sm"
            />
          </template>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Save"
            :loading="store.saving"
            :disable="!store.channelConfig"
            @click="saveChannelConfig"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Test channel -->
    <q-dialog v-model="testDialog.visible">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Test {{ testDialog.channelLabel }}</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="testDialog.recipient"
            :label="
              testDialog.channel === ChannelType.EMAIL
                ? 'Email address'
                : testDialog.channel === ChannelType.SMS
                  ? 'Phone number'
                  : 'Device token'
            "
            outlined
            dense
          />
        </q-card-section>
        <q-card-section v-if="testDialog.result">
          <q-banner
            :class="testDialog.result.success ? 'bg-positive' : 'bg-negative'"
            class="text-white"
          >
            {{ testDialog.result.message }}
            <span v-if="testDialog.result.success">
              ({{ testDialog.result.deliveryTimeMs }}ms)</span
            >
          </q-banner>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" v-close-popup />
          <q-btn
            color="primary"
            label="Send Test"
            :loading="store.saving"
            @click="doTestChannel"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useOperationsStore } from "#admin/stores/operations";
import type {
  FeatureFlag,
  TestChannelResponse,
} from "@structured-id/proto/sid/v1/admin/operations";
import {
  ChannelType,
  ChannelHealth,
  SmtpEncryption,
  SmsHttpMethod,
  ProbeStatus,
} from "@structured-id/proto/sid/v1/admin/operations";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import {
  dependencyStatusColor,
  probeStatusLabel,
  probeStatusColor,
  channelTypeLabel,
  channelTypeIcon,
  channelHealthLabel,
  channelHealthColor,
  smtpEncryptionLabel,
} from "#admin/composables/useEnumLabels";
import type { QTableColumn } from "quasar";

const store = useOperationsStore();
const activeTab = ref("flags");
const deliveryPeriod = ref("24h");

// ── EE feature list (static) ──
const eeFeatures = [
  "LDAP/AD synchronization",
  "SAML 2.0 Identity Provider",
  "Advanced audit & SIEM export",
  "Conditional access policies",
  "Custom admin roles",
  "Priority support",
];

// ── Flag columns ──
const flagColumns: QTableColumn[] = [
  {
    name: "status",
    label: "Status",
    field: "enabled",
    align: "left",
    style: "width: 80px",
  },
  {
    name: "flagName",
    label: "Flag",
    field: "flagName",
    align: "left",
    sortable: true,
  },
  {
    name: "description",
    label: "Description",
    field: "description",
    align: "left",
  },
  {
    name: "default",
    label: "Default",
    field: "defaultValue",
    align: "center",
    style: "width: 80px",
  },
  {
    name: "override",
    label: "Override",
    field: "hasOverride",
    align: "center",
    style: "width: 80px",
  },
  { name: "changedBy", label: "Changed by", field: "changedBy", align: "left" },
  {
    name: "actions",
    label: "Actions",
    field: "flagName",
    align: "right",
    style: "width: 140px",
  },
];

// ── Preference columns ──
const prefColumns: QTableColumn[] = [
  {
    name: "eventCategory",
    label: "Event Category",
    field: "eventCategory",
    align: "left",
  },
  { name: "email", label: "Email", field: "email", align: "center" },
  { name: "sms", label: "SMS", field: "sms", align: "center" },
  { name: "push", label: "Push", field: "push", align: "center" },
  { name: "webhook", label: "Webhook", field: "webhook", align: "center" },
  { name: "mandatory", label: "Override", field: "mandatory", align: "center" },
];

// ── SMTP encryption options ──
const smtpEncryptionOptions = [
  {
    label: smtpEncryptionLabel(SmtpEncryption.NONE),
    value: SmtpEncryption.NONE,
  },
  {
    label: smtpEncryptionLabel(SmtpEncryption.STARTTLS),
    value: SmtpEncryption.STARTTLS,
  },
  {
    label: smtpEncryptionLabel(SmtpEncryption.IMPLICIT_TLS),
    value: SmtpEncryption.IMPLICIT_TLS,
  },
];

const smsMethodOptions = [
  { label: "POST", value: SmsHttpMethod.POST },
  { label: "GET", value: SmsHttpMethod.GET },
];

// ── Toggle flag ──
const toggleDialog = ref({ visible: false, flagName: "", enabling: false });

function confirmToggleFlag(flag: FeatureFlag) {
  toggleDialog.value = {
    visible: true,
    flagName: flag.flagName,
    enabling: !flag.enabled,
  };
}

async function doToggleFlag() {
  await store.setFlag(toggleDialog.value.flagName, toggleDialog.value.enabling);
  toggleDialog.value.visible = false;
}

// ── Reset flag ──
function confirmResetFlag(flag: FeatureFlag) {
  toggleDialog.value = { visible: false, flagName: "", enabling: false };
  store.resetFlag(flag.flagName);
}

// ── Flag history ──
const historyDialog = ref({ visible: false, flagName: "" });

function showFlagHistory(flag: FeatureFlag) {
  historyDialog.value = { visible: true, flagName: flag.flagName };
  store.fetchFlagHistory(flag.flagName);
}

// ── Channel config ──
const configDialog = ref({ visible: false, channelLabel: "" });

function openChannelConfig(channel: ChannelType) {
  configDialog.value = {
    visible: true,
    channelLabel: channelTypeLabel(channel),
  };
  store.fetchChannelConfig(channel);
}

async function saveChannelConfig() {
  if (store.channelConfig) {
    await store.updateChannelConfig(store.channelConfig);
    configDialog.value.visible = false;
    store.fetchChannels();
  }
}

// ── Test channel ──
const testDialog = ref<{
  visible: boolean;
  channel: ChannelType;
  channelLabel: string;
  recipient: string;
  result: TestChannelResponse | null;
}>({
  visible: false,
  channel: ChannelType.UNSPECIFIED,
  channelLabel: "",
  recipient: "",
  result: null,
});

function openTestChannel(channel: ChannelType) {
  testDialog.value = {
    visible: true,
    channel,
    channelLabel: channelTypeLabel(channel),
    recipient: "",
    result: null,
  };
}

async function doTestChannel() {
  const result = await store.testChannel(
    testDialog.value.channel,
    testDialog.value.recipient,
  );
  testDialog.value.result = result;
}

// ── Delivery health ──
function loadDeliveryHealth() {
  store.fetchDeliveryHealth(deliveryPeriod.value);
}

// ── Preferences save ──
let prefTimer: ReturnType<typeof setTimeout> | null = null;
function savePrefDebounced() {
  // The toggle already changed the shown state: an earlier save's answer
  // must not undo it.
  store.preferencesEdited();
  if (prefTimer) clearTimeout(prefTimer);
  prefTimer = setTimeout(() => void store.updateDefaultPreferences(), 500);
}

// ── Timestamp formatting ──
function formatTimestamp(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  const d = new Date(
    Number(ts.seconds) * 1000 + Math.floor(Number(ts.nanos) / 1_000_000),
  );
  return d.toLocaleString();
}

// ── Load data ──
onMounted(() => {
  store.fetchFlags();
  store.fetchPropagation();
  store.fetchHealthStatus();
  store.fetchInstanceInfo();
  store.fetchChannels();
  store.fetchDeliveryHealth(deliveryPeriod.value);
  store.fetchDefaultPreferences();
});
</script>
