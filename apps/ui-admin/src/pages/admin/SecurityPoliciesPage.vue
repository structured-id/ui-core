<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h4">Security Policies</div>
        <div class="text-caption text-grey">
          Rate limits, anomaly detection, CAPTCHA, and breach detection
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
      <q-tab name="overview" label="Overview" icon="sym_o_shield" />
      <q-tab name="rateLimits" label="Rate Limits" icon="sym_o_speed" />
      <q-tab name="anomaly" label="Anomaly Detection" icon="sym_o_warning" />
      <q-tab name="captcha" label="CAPTCHA" icon="sym_o_verified_user" />
      <q-tab name="network" label="Network Policy" icon="sym_o_public" />
      <q-tab name="breach" label="Breach Detection" icon="sym_o_lock_open" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <!-- ═══════ Overview Tab (17.4) ═══════ -->
      <q-tab-panel name="overview">
        <div style="max-width: 800px">
          <div v-if="store.securityPolicy" class="q-gutter-md">
            <!-- Enforcement Mode -->
            <q-card flat bordered>
              <q-card-section>
                <div class="text-subtitle1 q-mb-sm">Enforcement Mode</div>
                <q-badge
                  :color="
                    store.securityPolicy.enforcementMode === 'enforce'
                      ? 'positive'
                      : 'warning'
                  "
                  :label="
                    store.securityPolicy.enforcementMode === 'enforce'
                      ? 'Enforcing'
                      : 'Monitor Only'
                  "
                  class="text-body2 q-pa-sm"
                />
                <div class="text-caption text-grey q-mt-xs">
                  {{
                    store.securityPolicy.enforcementMode === "enforce"
                      ? "Security policies are actively blocking threats."
                      : "Policies are monitoring only — no requests are blocked."
                  }}
                </div>
              </q-card-section>
            </q-card>

            <!-- Feature Status Grid -->
            <q-card flat bordered>
              <q-card-section>
                <div class="text-subtitle1 q-mb-md">Security Features</div>
                <div class="row q-col-gutter-md">
                  <div
                    v-for="feat in policyFeatures"
                    :key="feat.key"
                    class="col-12 col-sm-6"
                  >
                    <q-card flat bordered class="q-pa-sm">
                      <div class="row items-center no-wrap">
                        <q-icon
                          :name="feat.icon"
                          :color="feat.enabled ? 'positive' : 'grey-5'"
                          size="sm"
                          class="q-mr-sm"
                        />
                        <div class="col">
                          <div class="text-subtitle2">{{ feat.label }}</div>
                        </div>
                        <q-badge
                          :color="feat.enabled ? 'positive' : 'grey'"
                          :label="feat.enabled ? 'Active' : 'Off'"
                        />
                      </div>
                    </q-card>
                  </div>
                </div>
              </q-card-section>
            </q-card>

            <!-- Application Overrides -->
            <q-card flat bordered>
              <q-card-section>
                <div class="text-subtitle1 q-mb-md">
                  Application Overrides
                  <q-badge
                    v-if="store.applicationOverrides.length"
                    color="primary"
                    :label="store.applicationOverrides.length"
                    class="q-ml-sm"
                  />
                </div>
                <q-table
                  v-if="store.applicationOverrides.length"
                  :rows="store.applicationOverrides"
                  :columns="overrideColumns"
                  row-key="applicationId"
                  flat
                  bordered
                  dense
                  :pagination="{ rowsPerPage: 10 }"
                >
                  <template #body-cell-rateLimitsEnabled="props">
                    <q-td :props="props">
                      <override-badge :value="props.row.rateLimitsEnabled" />
                    </q-td>
                  </template>
                  <template #body-cell-captchaEnabled="props">
                    <q-td :props="props">
                      <override-badge :value="props.row.captchaEnabled" />
                    </q-td>
                  </template>
                  <template #body-cell-enforcementMode="props">
                    <q-td :props="props">
                      <q-badge
                        v-if="props.row.enforcementMode"
                        :color="
                          props.row.enforcementMode === 'enforce'
                            ? 'positive'
                            : 'warning'
                        "
                        :label="props.row.enforcementMode"
                      />
                      <span v-else class="text-grey text-caption">
                        Inherited
                      </span>
                    </q-td>
                  </template>
                </q-table>
                <div v-else class="text-grey text-caption">
                  No per-application overrides. All applications use global
                  policy.
                </div>
              </q-card-section>
            </q-card>
          </div>
          <div v-else-if="!store.loading" class="text-grey text-center q-pa-xl">
            Unable to load security policy.
          </div>
        </div>
      </q-tab-panel>

      <!-- ═══════ Rate Limits Tab (17.1) ═══════ -->
      <q-tab-panel name="rateLimits">
        <div style="max-width: 900px">
          <!-- Dashboard Cards -->
          <div
            v-if="store.rateLimitDashboard"
            class="row q-col-gutter-md q-mb-lg"
          >
            <div class="col-12 col-sm-6 col-md-3">
              <q-card flat bordered class="text-center q-pa-md">
                <div class="text-h4 text-negative">
                  {{ store.rateLimitDashboard.totalBlockedLastHour }}
                </div>
                <div class="text-caption text-grey">Blocked (last hour)</div>
              </q-card>
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-card flat bordered class="text-center q-pa-md">
                <div class="text-h4 text-warning">
                  {{ store.rateLimitDashboard.totalBlockedLastDay }}
                </div>
                <div class="text-caption text-grey">Blocked (last 24h)</div>
              </q-card>
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-card flat bordered class="q-pa-md">
                <div class="text-subtitle2 q-mb-xs">Top Blocked IPs</div>
                <div
                  v-for="entry in store.rateLimitDashboard.topBlockedIps.slice(
                    0,
                    5,
                  )"
                  :key="entry.key"
                  class="text-caption"
                >
                  <code>{{ entry.key }}</code>
                  <q-badge
                    :label="entry.count"
                    color="negative"
                    dense
                    class="q-ml-xs"
                  />
                </div>
                <div
                  v-if="!store.rateLimitDashboard.topBlockedIps.length"
                  class="text-caption text-grey"
                >
                  None
                </div>
              </q-card>
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-card flat bordered class="q-pa-md">
                <div class="text-subtitle2 q-mb-xs">Top Endpoints</div>
                <div
                  v-for="entry in store.rateLimitDashboard.topBlockedEndpoints.slice(
                    0,
                    5,
                  )"
                  :key="entry.key"
                  class="text-caption"
                >
                  <code>{{ entry.key }}</code>
                  <q-badge
                    :label="entry.count"
                    color="warning"
                    dense
                    class="q-ml-xs"
                  />
                </div>
                <div
                  v-if="!store.rateLimitDashboard.topBlockedEndpoints.length"
                  class="text-caption text-grey"
                >
                  None
                </div>
              </q-card>
            </div>
          </div>

          <!-- Rate Limit Rules -->
          <div class="text-subtitle1 q-mb-sm">Rules</div>
          <q-table
            v-if="store.rateLimitConfig"
            :rows="store.rateLimitConfig.rules"
            :columns="rateLimitRuleColumns"
            row-key="endpoint"
            flat
            bordered
            dense
            :pagination="{ rowsPerPage: 25 }"
          >
            <template #body-cell-windowSeconds="props">
              <q-td :props="props">
                {{ formatDuration(props.row.windowSeconds) }}
              </q-td>
            </template>
          </q-table>

          <!-- Overrides -->
          <div
            v-if="
              store.rateLimitConfig && store.rateLimitConfig.overrides.length
            "
          >
            <div class="text-subtitle1 q-mt-lg q-mb-sm">Overrides</div>
            <q-table
              :rows="store.rateLimitConfig.overrides"
              :columns="rateLimitOverrideColumns"
              row-key="id"
              flat
              bordered
              dense
              :pagination="{ rowsPerPage: 10 }"
            >
              <template #body-cell-windowSeconds="props">
                <q-td :props="props">
                  {{ formatDuration(props.row.windowSeconds) }}
                </q-td>
              </template>
            </q-table>
          </div>

          <!-- IP Allowlist -->
          <div
            v-if="
              store.rateLimitConfig && store.rateLimitConfig.ipAllowlist.length
            "
          >
            <div class="text-subtitle1 q-mt-lg q-mb-sm">IP Allowlist</div>
            <div class="q-gutter-xs">
              <q-chip
                v-for="ip in store.rateLimitConfig.ipAllowlist"
                :key="ip"
                dense
                outline
                icon="sym_o_dns"
              >
                <code>{{ ip }}</code>
              </q-chip>
            </div>
          </div>
        </div>
      </q-tab-panel>

      <!-- ═══════ Anomaly Detection Tab (17.2) ═══════ -->
      <q-tab-panel name="anomaly">
        <div style="max-width: 900px">
          <!-- Rules -->
          <div class="text-subtitle1 q-mb-sm">
            Rules
            <q-badge
              v-if="store.anomalyRules.length"
              color="primary"
              :label="store.anomalyRules.length"
              class="q-ml-sm"
            />
          </div>
          <q-table
            v-if="store.anomalyRules.length"
            :rows="store.anomalyRules"
            :columns="anomalyRuleColumns"
            row-key="id"
            flat
            bordered
            :pagination="{ rowsPerPage: 25 }"
          >
            <template #body-cell-type="props">
              <q-td :props="props">
                <q-icon
                  :name="anomalyRuleTypeIcon(props.row.type)"
                  size="xs"
                  class="q-mr-xs"
                />
                {{ anomalyRuleTypeLabel(props.row.type) }}
              </q-td>
            </template>
            <template #body-cell-enabled="props">
              <q-td :props="props">
                <q-badge
                  :color="props.row.enabled ? 'positive' : 'grey'"
                  :label="props.row.enabled ? 'Active' : 'Off'"
                />
              </q-td>
            </template>
            <template #body-cell-tier="props">
              <q-td :props="props">
                <q-badge
                  :color="props.row.tier === 'ee' ? 'purple' : 'blue'"
                  :label="props.row.tier.toUpperCase()"
                />
              </q-td>
            </template>
          </q-table>
          <div v-else-if="!store.loading" class="text-grey q-pa-md text-center">
            No anomaly rules configured.
          </div>

          <!-- Event Log -->
          <div class="text-subtitle1 q-mt-lg q-mb-sm">
            Recent Events
            <q-badge
              v-if="store.anomalyEvents.length"
              color="warning"
              :label="store.anomalyEvents.length"
              class="q-ml-sm"
            />
          </div>
          <div class="row q-mb-sm">
            <div class="col-12 col-sm-4">
              <q-select
                v-model="anomalyRuleFilter"
                :options="anomalyRuleFilterOptions"
                outlined
                dense
                emit-value
                map-options
                clearable
                label="Filter by rule"
                @update:model-value="onAnomalyRuleFilterChange"
              />
            </div>
          </div>
          <q-table
            v-if="store.anomalyEvents.length"
            :rows="store.anomalyEvents"
            :columns="anomalyEventColumns"
            row-key="id"
            flat
            bordered
            dense
            :pagination="{ rowsPerPage: 25 }"
          >
            <template #body-cell-riskScore="props">
              <q-td :props="props">
                <q-badge
                  :color="riskColor(props.row.riskScore)"
                  :label="props.row.riskScore"
                />
              </q-td>
            </template>
            <template #body-cell-timestamp="props">
              <q-td :props="props">
                <span class="text-caption text-grey">
                  {{ formatTimestamp(props.row.timestamp) }}
                </span>
              </q-td>
            </template>
          </q-table>
          <div v-else-if="!store.loading" class="text-grey q-pa-md text-center">
            No anomaly events recorded.
          </div>
        </div>
      </q-tab-panel>

      <!-- ═══════ CAPTCHA Tab (17.3) ═══════ -->
      <q-tab-panel name="captcha">
        <div
          v-if="store.captchaConfig"
          style="max-width: 600px"
          class="q-gutter-md"
        >
          <q-toggle
            :model-value="captchaForm.enabled"
            label="Enable CAPTCHA"
            @update:model-value="captchaForm.enabled = $event"
          />

          <q-select
            v-model="captchaForm.provider"
            :options="captchaProviderOptions"
            outlined
            dense
            emit-value
            map-options
            label="Provider"
          />

          <q-input
            v-model="captchaForm.siteKey"
            outlined
            dense
            label="Site Key"
          />
          <q-input
            v-model="captchaForm.secretKey"
            outlined
            dense
            label="Secret Key"
            :type="showSecretKey ? 'text' : 'password'"
          >
            <template #append>
              <q-icon
                :name="
                  showSecretKey ? 'sym_o_visibility_off' : 'sym_o_visibility'
                "
                class="cursor-pointer"
                @click="showSecretKey = !showSecretKey"
              />
            </template>
          </q-input>

          <q-input
            v-if="supportsScoreThreshold"
            v-model.number="captchaForm.scoreThreshold"
            outlined
            dense
            label="Score Threshold"
            type="number"
            step="0.1"
            min="0"
            max="1"
            hint="Minimum score (0.0–1.0) to pass verification"
          />

          <div class="text-subtitle2">Triggers</div>
          <div class="q-gutter-sm">
            <q-checkbox
              v-for="trigger in captchaTriggerOptions"
              :key="trigger.value"
              v-model="captchaForm.triggers"
              :val="trigger.value"
              :label="trigger.label"
            />
          </div>

          <div class="row q-gutter-sm">
            <q-btn
              color="primary"
              label="Save"
              no-caps
              :loading="store.loading"
              @click="saveCaptchaConfig"
            />
            <q-btn
              flat
              label="Test Provider"
              no-caps
              icon="sym_o_science"
              :disable="!captchaForm.siteKey || !captchaForm.secretKey"
              :loading="store.loading"
              @click="testCaptcha"
            />
          </div>
        </div>
        <div v-else-if="!store.loading" class="text-grey text-center q-pa-xl">
          Unable to load CAPTCHA configuration.
        </div>
      </q-tab-panel>

      <!-- ═══════ Network Policy Tab (17.6) ═══════ -->
      <q-tab-panel name="network">
        <div style="max-width: 800px" class="q-gutter-md">
          <!-- Mode selector: allow-list vs block-list -->
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle1 q-mb-md">Country Restrictions</div>
              <q-option-group
                v-model="networkMode"
                :options="[
                  { label: 'No country restrictions', value: 'none' },
                  {
                    label: 'Allow-list (only listed countries permitted)',
                    value: 'allow',
                  },
                  {
                    label: 'Block-list (listed countries denied)',
                    value: 'block',
                  },
                ]"
                type="radio"
                class="q-gutter-sm"
              />
            </q-card-section>
          </q-card>

          <!-- Country list (visible when allow or block mode) -->
          <q-card v-if="networkMode !== 'none'" flat bordered>
            <q-card-section>
              <div class="text-subtitle1 q-mb-sm">
                {{
                  networkMode === "allow"
                    ? "Allowed Countries"
                    : "Blocked Countries"
                }}
              </div>
              <div class="text-caption text-grey q-mb-md">
                {{
                  networkMode === "allow"
                    ? "Only users from these countries can log in."
                    : "Users from these countries are denied access."
                }}
              </div>

              <div class="q-gutter-xs q-mb-md">
                <q-chip
                  v-for="(cc, idx) in networkCountries"
                  :key="cc"
                  :label="cc"
                  removable
                  :color="networkMode === 'allow' ? 'positive' : 'negative'"
                  text-color="white"
                  @remove="networkCountries.splice(idx, 1)"
                />
              </div>

              <div class="row items-center q-gutter-sm">
                <q-input
                  v-model="newCountryCode"
                  dense
                  outlined
                  placeholder="US, DE, UA..."
                  class="col"
                  maxlength="2"
                  @keyup.enter="addCountry"
                />
                <q-btn
                  flat
                  icon="sym_o_add"
                  label="Add"
                  color="primary"
                  :disable="!newCountryCode.trim()"
                  @click="addCountry"
                />
              </div>
            </q-card-section>
          </q-card>

          <!-- Tor & Datacenter blocking -->
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle1 q-mb-md">IP Source Filtering</div>
              <q-toggle
                v-model="networkBlockTor"
                label="Block Tor exit nodes"
                color="negative"
              />
              <div class="text-caption text-grey q-ml-xl q-mb-md">
                Deny logins from known Tor exit node IPs. Auto-updated
                blocklist.
              </div>

              <q-toggle
                v-model="networkBlockDatacenter"
                label="Block datacenter / hosting IPs"
                color="warning"
              />
              <div class="text-caption text-grey q-ml-xl">
                Detect AWS, GCP, Azure, DigitalOcean, etc. via MaxMind ASN
                database. CI/CD service accounts may need exemption.
              </div>
            </q-card-section>
          </q-card>

          <!-- Violation reaction -->
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle1 q-mb-md">Violation Reaction</div>
              <q-option-group
                v-model="networkViolationReaction"
                :options="[
                  { label: 'Block — deny login immediately', value: 1 },
                  {
                    label: 'Step-up — require additional authentication',
                    value: 2,
                  },
                  {
                    label: 'Alert — allow but notify admin (audit mode)',
                    value: 3,
                  },
                ]"
                type="radio"
                class="q-gutter-sm"
              />
            </q-card-section>
          </q-card>

          <q-btn
            color="primary"
            label="Save Network Policy"
            no-caps
            :loading="store.loading"
            @click="saveNetworkPolicy"
          />
        </div>
      </q-tab-panel>

      <!-- ═══════ Breach Detection Tab (17.7) ═══════ -->
      <q-tab-panel name="breach">
        <div
          v-if="store.breachDetectionConfig"
          style="max-width: 600px"
          class="q-gutter-md"
        >
          <q-toggle
            :model-value="breachForm.enabled"
            label="Enable Breach Detection"
            @update:model-value="breachForm.enabled = $event"
          />

          <q-input
            :model-value="breachForm.provider"
            outlined
            dense
            label="Provider"
            readonly
            hint="Have I Been Pwned k-anonymity API"
          />

          <q-toggle
            :model-value="breachForm.checkOnLogin"
            label="Check on login"
            @update:model-value="breachForm.checkOnLogin = $event"
          />
          <q-toggle
            :model-value="breachForm.checkOnPasswordChange"
            label="Check on password change"
            @update:model-value="breachForm.checkOnPasswordChange = $event"
          />
          <q-toggle
            :model-value="breachForm.forcePasswordChangeOnBreach"
            label="Force password change on breach"
            @update:model-value="
              breachForm.forcePasswordChangeOnBreach = $event
            "
          />

          <q-btn
            color="primary"
            label="Save"
            no-caps
            :loading="store.loading"
            @click="saveBreachConfig"
          />
        </div>
        <div v-else-if="!store.loading" class="text-grey text-center q-pa-xl">
          Unable to load breach detection configuration.
        </div>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import {
  ref,
  reactive,
  computed,
  onMounted,
  watch,
  defineComponent,
  h,
} from "vue";
import { useQuasar, QBadge } from "quasar";
import { useSecurityPoliciesStore } from "src/stores/securityPolicies";
import {
  CaptchaProvider,
  CaptchaTrigger,
} from "@structured-id/proto/sid/v1/admin/security";
import {
  anomalyRuleTypeLabel,
  anomalyRuleTypeIcon,
  captchaProviderLabel,
  captchaTriggerLabel,
} from "src/composables/useEnumLabels";
import { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";

const store = useSecurityPoliciesStore();
const $q = useQuasar();

const tab = ref("overview");
const showSecretKey = ref(false);
const anomalyRuleFilter = ref<string | null>(null);

// ── Overview computed ──

const policyFeatures = computed(() => {
  const p = store.securityPolicy;
  if (!p) return [];
  return [
    {
      key: "rateLimits",
      label: "Rate Limits",
      icon: "sym_o_speed",
      enabled: p.rateLimitsEnabled,
    },
    {
      key: "anomaly",
      label: "Anomaly Detection",
      icon: "sym_o_warning",
      enabled: p.anomalyDetectionEnabled,
    },
    {
      key: "captcha",
      label: "CAPTCHA",
      icon: "sym_o_verified_user",
      enabled: p.captchaEnabled,
    },
    {
      key: "network",
      label: "Network Policy",
      icon: "sym_o_public",
      enabled: !!(
        p.network?.allowedCountries?.length ||
        p.network?.blockedCountries?.length ||
        p.network?.blockTor ||
        p.network?.blockDatacenterIps
      ),
    },
    {
      key: "breach",
      label: "Breach Detection",
      icon: "sym_o_lock_open",
      enabled: p.breachDetectionEnabled,
    },
  ];
});

// ── Override Badge component ──
const OverrideBadge = defineComponent({
  name: "OverrideBadge",
  props: {
    value: { type: Boolean, default: undefined },
  },
  setup(props) {
    return () => {
      if (props.value === undefined || props.value === null) {
        return h("span", { class: "text-grey text-caption" }, "Inherited");
      }
      return h(QBadge, {
        color: props.value ? "positive" : "grey",
        label: props.value ? "On" : "Off",
      });
    };
  },
});

// ── Application Override columns ──

const overrideColumns = [
  {
    name: "applicationName",
    label: "Application",
    field: "applicationName",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "rateLimitsEnabled",
    label: "Rate Limits",
    field: "rateLimitsEnabled",
    align: "center" as const,
  },
  {
    name: "captchaEnabled",
    label: "CAPTCHA",
    field: "captchaEnabled",
    align: "center" as const,
  },
  {
    name: "enforcementMode",
    label: "Mode",
    field: "enforcementMode",
    align: "center" as const,
  },
];

// ── Rate Limit columns ──

const rateLimitRuleColumns = [
  {
    name: "endpoint",
    label: "Endpoint",
    field: "endpoint",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "maxRequests",
    label: "Max Requests",
    field: "maxRequests",
    align: "right" as const,
    sortable: true,
  },
  {
    name: "windowSeconds",
    label: "Window",
    field: "windowSeconds",
    align: "left" as const,
  },
  {
    name: "scope",
    label: "Scope",
    field: "scope",
    align: "left" as const,
  },
];

const rateLimitOverrideColumns = [
  {
    name: "targetType",
    label: "Type",
    field: "targetType",
    align: "left" as const,
  },
  {
    name: "target",
    label: "Target",
    field: "target",
    align: "left" as const,
  },
  {
    name: "maxRequests",
    label: "Max Requests",
    field: "maxRequests",
    align: "right" as const,
  },
  {
    name: "windowSeconds",
    label: "Window",
    field: "windowSeconds",
    align: "left" as const,
  },
];

// ── Anomaly columns ──

const anomalyRuleColumns = [
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
    sortable: true,
  },
  {
    name: "weight",
    label: "Weight",
    field: "weight",
    align: "right" as const,
    sortable: true,
  },
  {
    name: "enabled",
    label: "Status",
    field: "enabled",
    align: "center" as const,
  },
  {
    name: "tier",
    label: "Tier",
    field: "tier",
    align: "center" as const,
  },
];

const anomalyEventColumns = [
  {
    name: "ruleId",
    label: "Rule",
    field: "ruleId",
    align: "left" as const,
  },
  {
    name: "profileId",
    label: "Profile",
    field: (row: { profileId: string }) =>
      row.profileId ? row.profileId.substring(0, 12) + "..." : "—",
    align: "left" as const,
  },
  {
    name: "ipAddress",
    label: "IP",
    field: "ipAddress",
    align: "left" as const,
  },
  {
    name: "description",
    label: "Description",
    field: "description",
    align: "left" as const,
  },
  {
    name: "riskScore",
    label: "Risk",
    field: "riskScore",
    align: "center" as const,
    sortable: true,
  },
  {
    name: "timestamp",
    label: "Time",
    field: "timestamp",
    align: "left" as const,
    sortable: true,
  },
];

const anomalyRuleFilterOptions = computed(() =>
  store.anomalyRules.map((r: { name: string; id: string }) => ({
    label: r.name,
    value: r.id,
  })),
);

function onAnomalyRuleFilterChange(ruleId: string | null) {
  store.fetchAnomalyEventLog(ruleId ?? undefined);
}

// ── CAPTCHA form ──

const captchaForm = reactive({
  enabled: false,
  provider: CaptchaProvider.UNSPECIFIED,
  siteKey: "",
  secretKey: "",
  scoreThreshold: 0.5,
  triggers: [] as CaptchaTrigger[],
});

const captchaProviderOptions = [
  {
    label: captchaProviderLabel(CaptchaProvider.RECAPTCHA_V2),
    value: CaptchaProvider.RECAPTCHA_V2,
  },
  {
    label: captchaProviderLabel(CaptchaProvider.RECAPTCHA_V3),
    value: CaptchaProvider.RECAPTCHA_V3,
  },
  {
    label: captchaProviderLabel(CaptchaProvider.HCAPTCHA),
    value: CaptchaProvider.HCAPTCHA,
  },
  {
    label: captchaProviderLabel(CaptchaProvider.TURNSTILE),
    value: CaptchaProvider.TURNSTILE,
  },
];

const captchaTriggerOptions = [
  {
    label: captchaTriggerLabel(CaptchaTrigger.LOGIN),
    value: CaptchaTrigger.LOGIN,
  },
  {
    label: captchaTriggerLabel(CaptchaTrigger.REGISTER),
    value: CaptchaTrigger.REGISTER,
  },
  {
    label: captchaTriggerLabel(CaptchaTrigger.PASSWORD_RESET),
    value: CaptchaTrigger.PASSWORD_RESET,
  },
  {
    label: captchaTriggerLabel(CaptchaTrigger.AFTER_FAILURES),
    value: CaptchaTrigger.AFTER_FAILURES,
  },
];

const supportsScoreThreshold = computed(
  () =>
    captchaForm.provider === CaptchaProvider.RECAPTCHA_V3 ||
    captchaForm.provider === CaptchaProvider.TURNSTILE,
);

function populateCaptchaForm() {
  const c = store.captchaConfig;
  if (!c) return;
  captchaForm.enabled = c.enabled;
  captchaForm.provider = c.provider;
  captchaForm.siteKey = c.siteKey;
  captchaForm.secretKey = c.secretKey;
  captchaForm.scoreThreshold = c.scoreThreshold;
  captchaForm.triggers = [...c.triggers];
}

watch(() => store.captchaConfig, populateCaptchaForm, { immediate: true });

async function saveCaptchaConfig() {
  try {
    await store.updateCaptchaConfig({
      enabled: captchaForm.enabled,
      provider: captchaForm.provider,
      siteKey: captchaForm.siteKey,
      secretKey: captchaForm.secretKey,
      scoreThreshold: captchaForm.scoreThreshold,
      triggers: captchaForm.triggers,
    });
    $q.notify({ type: "positive", message: "CAPTCHA config updated" });
  } catch {
    $q.notify({
      type: "negative",
      message: store.error || "Failed to update CAPTCHA config",
    });
  }
}

async function testCaptcha() {
  try {
    const result = await store.testCaptchaProvider(
      captchaForm.provider,
      captchaForm.siteKey,
      captchaForm.secretKey,
    );
    if (result.success) {
      $q.notify({ type: "positive", message: "CAPTCHA provider test passed" });
    } else {
      $q.notify({
        type: "negative",
        message: `CAPTCHA test failed: ${result.error}`,
      });
    }
  } catch {
    $q.notify({
      type: "negative",
      message: store.error || "CAPTCHA test failed",
    });
  }
}

// ── Breach Detection form ──

const breachForm = reactive({
  enabled: false,
  checkOnLogin: false,
  checkOnPasswordChange: false,
  forcePasswordChangeOnBreach: false,
  provider: "hibp",
});

function populateBreachForm() {
  const b = store.breachDetectionConfig;
  if (!b) return;
  breachForm.enabled = b.enabled;
  breachForm.checkOnLogin = b.checkOnLogin;
  breachForm.checkOnPasswordChange = b.checkOnPasswordChange;
  breachForm.forcePasswordChangeOnBreach = b.forcePasswordChangeOnBreach;
  breachForm.provider = b.provider;
}

watch(() => store.breachDetectionConfig, populateBreachForm, {
  immediate: true,
});

async function saveBreachConfig() {
  try {
    await store.updateBreachDetectionConfig({
      enabled: breachForm.enabled,
      checkOnLogin: breachForm.checkOnLogin,
      checkOnPasswordChange: breachForm.checkOnPasswordChange,
      forcePasswordChangeOnBreach: breachForm.forcePasswordChangeOnBreach,
      provider: breachForm.provider,
    });
    $q.notify({
      type: "positive",
      message: "Breach detection config updated",
    });
  } catch {
    $q.notify({
      type: "negative",
      message: store.error || "Failed to update breach detection config",
    });
  }
}

// ── Network Policy form ──

const networkMode = ref<"none" | "allow" | "block">("none");
const networkCountries = ref<string[]>([]);
const networkBlockTor = ref(false);
const networkBlockDatacenter = ref(false);
const networkViolationReaction = ref(1); // BLOCK
const newCountryCode = ref("");

function addCountry() {
  const cc = newCountryCode.value.trim().toUpperCase();
  if (cc && cc.length === 2 && !networkCountries.value.includes(cc)) {
    networkCountries.value.push(cc);
  }
  newCountryCode.value = "";
}

function populateNetworkForm() {
  const n = store.networkPolicy;
  if (!n) return;
  if (n.allowedCountries.length > 0) {
    networkMode.value = "allow";
    networkCountries.value = [...n.allowedCountries];
  } else if (n.blockedCountries.length > 0) {
    networkMode.value = "block";
    networkCountries.value = [...n.blockedCountries];
  } else {
    networkMode.value = "none";
    networkCountries.value = [];
  }
  networkBlockTor.value = n.blockTor;
  networkBlockDatacenter.value = n.blockDatacenterIps;
  networkViolationReaction.value = n.violationReaction;
}

watch(() => store.networkPolicy, populateNetworkForm, { immediate: true });

async function saveNetworkPolicy() {
  try {
    await store.updateNetworkPolicy({
      allowedCountries:
        networkMode.value === "allow" ? [...networkCountries.value] : [],
      blockedCountries:
        networkMode.value === "block" ? [...networkCountries.value] : [],
      blockTor: networkBlockTor.value,
      blockDatacenterIps: networkBlockDatacenter.value,
      violationReaction: networkViolationReaction.value,
    });
    $q.notify({ type: "positive", message: "Network policy updated" });
  } catch {
    $q.notify({
      type: "negative",
      message: store.error || "Failed to update network policy",
    });
  }
}

// ── Helpers ──

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

function formatTimestamp(ts?: { seconds: bigint; nanos: number }): string {
  if (!ts) return "—";
  return Timestamp.toDate(ts).toLocaleString();
}

function riskColor(score: number): string {
  if (score >= 80) return "negative";
  if (score >= 50) return "warning";
  return "info";
}

// ── Load data based on active tab ──

async function loadTabData(tabName: string) {
  switch (tabName) {
    case "overview":
      await store.fetchSecurityPolicy();
      store.fetchApplicationOverrides();
      break;
    case "rateLimits":
      await store.fetchRateLimitConfig();
      store.fetchRateLimitDashboard();
      break;
    case "anomaly":
      await store.fetchAnomalyRules();
      store.fetchAnomalyEventLog();
      break;
    case "captcha":
      await store.fetchCaptchaConfig();
      break;
    case "network":
      await store.fetchNetworkPolicy();
      break;
    case "breach":
      await store.fetchBreachDetectionConfig();
      break;
  }
}

watch(tab, (newTab) => loadTabData(newTab));

onMounted(() => {
  loadTabData(tab.value);
});
</script>
