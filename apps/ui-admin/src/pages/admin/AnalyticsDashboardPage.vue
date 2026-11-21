<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5 q-mr-md">Analytics</div>
      <q-space />

      <!-- Period selector -->
      <q-btn-toggle
        v-model="period"
        no-caps
        rounded
        unelevated
        toggle-color="primary"
        :options="periodOptions"
        class="q-mr-md"
      />

      <!-- Auto-refresh -->
      <q-btn-dropdown
        flat
        dense
        :icon="autoRefresh ? 'sym_o_sync' : 'sym_o_sync_disabled'"
        :label="autoRefreshLabel"
        no-caps
      >
        <q-list dense>
          <q-item
            v-for="opt in refreshOptions"
            :key="opt.value"
            clickable
            v-close-popup
            @click="setAutoRefresh(opt.value)"
          >
            <q-item-section>{{ opt.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
    </div>

    <!-- Overview Sparkline Cards (3×2 grid) -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div
        v-for="card in store.cards"
        :key="card.name"
        class="col-12 col-sm-6 col-md-4"
      >
        <q-card flat bordered>
          <q-card-section>
            <div class="text-caption text-grey-7">{{ card.label }}</div>
            <div class="row items-end q-mt-xs">
              <div class="text-h4 text-weight-bold q-mr-sm">
                {{ formatNumber(card.value) }}
              </div>
              <div class="text-body2 text-grey-6 q-mb-xs">
                {{ card.suffix }}
              </div>
              <q-space />
              <q-chip
                dense
                :color="metricTrendColor(card.trend)"
                text-color="white"
                :icon="metricTrendIcon(card.trend)"
                size="sm"
              >
                {{ formatTrend(card.trendPercent) }}
              </q-chip>
            </div>

            <!-- Sparkline -->
            <div class="sparkline q-mt-sm" v-if="card.sparkline.length">
              <svg
                :viewBox="`0 0 ${card.sparkline.length * 4} 24`"
                preserveAspectRatio="none"
                class="full-width"
                style="height: 32px"
              >
                <polyline
                  :points="sparklinePoints(card.sparkline)"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  class="text-primary"
                />
              </svg>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Skeleton placeholders while loading -->
      <template v-if="store.loading && store.cards.length === 0">
        <div
          v-for="i in 6"
          :key="'skeleton-' + i"
          class="col-12 col-sm-6 col-md-4"
        >
          <q-card flat bordered>
            <q-card-section>
              <q-skeleton type="text" width="40%" />
              <q-skeleton type="text" width="60%" class="text-h4 q-mt-xs" />
              <q-skeleton type="rect" height="32px" class="q-mt-sm" />
            </q-card-section>
          </q-card>
        </div>
      </template>
    </div>

    <!-- Charts Section -->
    <div class="row q-col-gutter-md">
      <!-- Chart 1: Authentication Activity (stacked area) -->
      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle1 text-weight-medium">
              Authentication Activity
            </div>
            <div class="text-caption text-grey-6">
              Stacked: Success / Failure / MFA
            </div>
          </q-card-section>
          <q-card-section class="chart-placeholder">
            <template v-if="store.authActivity.length">
              <div
                v-for="series in store.authActivity"
                :key="series.name"
                class="row items-center q-mb-xs"
              >
                <q-badge
                  :style="{ backgroundColor: series.color || '#1976d2' }"
                  class="q-mr-sm"
                />
                <span class="text-caption">
                  {{ series.label }} — {{ series.points.length }} points ({{
                    series.lineStyle || "solid"
                  }})
                </span>
              </div>
            </template>
            <div v-else class="text-grey-5 text-center q-pa-lg">
              <q-icon name="sym_o_show_chart" size="48px" />
              <div class="q-mt-sm">Chart renders with charting library</div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Chart 2: Auth Latency (line with percentile bands) -->
      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle1 text-weight-medium">Auth Latency</div>
            <div class="text-caption text-grey-6">
              Percentiles: p50 / p95 / p99
            </div>
          </q-card-section>
          <q-card-section class="chart-placeholder">
            <template v-if="store.authLatency.length">
              <div
                v-for="series in store.authLatency"
                :key="series.name"
                class="row items-center q-mb-xs"
              >
                <q-badge
                  :style="{ backgroundColor: series.color || '#1976d2' }"
                  class="q-mr-sm"
                />
                <span class="text-caption">
                  {{ series.label }} — {{ series.points.length }} points ({{
                    series.lineStyle || "solid"
                  }})
                </span>
              </div>
            </template>
            <div v-else class="text-grey-5 text-center q-pa-lg">
              <q-icon name="sym_o_ssid_chart" size="48px" />
              <div class="q-mt-sm">Chart renders with charting library</div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Chart 3: Top Applications (horizontal bar) -->
      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle1 text-weight-medium">
              Top Applications
            </div>
            <div class="text-caption text-grey-6">By login count</div>
          </q-card-section>
          <q-card-section>
            <template v-if="store.topApplications.length">
              <div
                v-for="app in store.topApplications"
                :key="app.clientId"
                class="q-mb-sm"
              >
                <div class="row items-center justify-between q-mb-xs">
                  <span class="text-body2">{{ app.applicationName }}</span>
                  <span class="text-caption text-grey-7">
                    {{ formatNumber(Number(app.loginCount)) }}
                  </span>
                </div>
                <q-linear-progress
                  :value="barFraction(app)"
                  color="primary"
                  rounded
                  size="8px"
                />
              </div>
            </template>
            <div v-else class="text-grey-5 text-center q-pa-lg">
              <q-icon name="sym_o_bar_chart" size="48px" />
              <div class="q-mt-sm">No application data</div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Chart 4: Auth Method Distribution (donut) -->
      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle1 text-weight-medium">
              Auth Method Distribution
            </div>
            <div class="text-caption text-grey-6">
              Total: {{ formatNumber(store.authMethodTotal) }}
            </div>
          </q-card-section>
          <q-card-section>
            <template v-if="store.authMethodSlices.length">
              <div
                v-for="slice in store.authMethodSlices"
                :key="slice.label"
                class="row items-center q-mb-sm"
              >
                <q-badge
                  :style="{ backgroundColor: slice.color || '#1976d2' }"
                  class="q-mr-sm"
                  rounded
                />
                <span class="text-body2 q-mr-auto">{{ slice.label }}</span>
                <span class="text-caption text-grey-7 q-mr-sm">
                  {{ formatNumber(slice.value) }}
                </span>
                <q-badge outline color="grey-7">
                  {{ slice.percentage.toFixed(1) }}%
                </q-badge>
              </div>
            </template>
            <div v-else class="text-grey-5 text-center q-pa-lg">
              <q-icon name="sym_o_donut_small" size="48px" />
              <div class="q-mt-sm">No distribution data</div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Error banner -->
    <q-banner v-if="store.error" class="bg-negative text-white q-mt-md" rounded>
      <template #avatar>
        <q-icon name="sym_o_error" />
      </template>
      {{ store.error }}
    </q-banner>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useAnalyticsStore } from "#admin/stores/analytics";
import { AnalyticsPeriod } from "@structured-id/proto/sid/v1/admin/analytics";
import type { ApplicationMetric } from "@structured-id/proto/sid/v1/admin/analytics";
import {
  metricTrendColor,
  metricTrendIcon,
} from "#admin/composables/useEnumLabels";

const store = useAnalyticsStore();

const period = ref(AnalyticsPeriod.ANALYTICS_PERIOD_24H);
const autoRefreshInterval = ref(60);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const autoRefresh = computed(() => autoRefreshInterval.value > 0);

const periodOptions = [
  { value: AnalyticsPeriod.ANALYTICS_PERIOD_24H, label: "24h" },
  { value: AnalyticsPeriod.ANALYTICS_PERIOD_7D, label: "7d" },
  { value: AnalyticsPeriod.ANALYTICS_PERIOD_30D, label: "30d" },
  { value: AnalyticsPeriod.ANALYTICS_PERIOD_90D, label: "90d" },
];

const refreshOptions = [
  { value: 15, label: "15 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
  { value: 0, label: "Off" },
];

const autoRefreshLabel = computed(() => {
  if (!autoRefresh.value) return "Off";
  if (autoRefreshInterval.value < 60) return `${autoRefreshInterval.value}s`;
  return `${autoRefreshInterval.value / 60}m`;
});

function setAutoRefresh(seconds: number) {
  autoRefreshInterval.value = seconds;
  setupTimer();
}

function setupTimer() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (autoRefreshInterval.value > 0) {
    refreshTimer = setInterval(
      () => store.fetchAll(period.value),
      autoRefreshInterval.value * 1000,
    );
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatTrend(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function sparklinePoints(data: number[]): string {
  if (!data.length) return "";
  const max = Math.max(...data) || 1;
  return data.map((v, i) => `${i * 4},${24 - (v / max) * 22}`).join(" ");
}

function barFraction(app: ApplicationMetric): number {
  const maxCount = store.topApplications.reduce(
    (m, a) => Math.max(m, Number(a.loginCount)),
    1,
  );
  return Number(app.loginCount) / maxCount;
}

watch(period, () => store.fetchAll(period.value));

onMounted(() => {
  store.fetchAll(period.value);
  setupTimer();
});

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>
