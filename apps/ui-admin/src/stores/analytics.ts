import { defineStore } from "pinia";
import { ref } from "vue";
import { AnalyticsServiceClient } from "@structured-id/proto/sid/v1/admin/analytics.client";
import type {
  MetricCard,
  TimeSeries,
  ApplicationMetric,
  DistributionSlice,
} from "@structured-id/proto/sid/v1/admin/analytics";
import { AnalyticsPeriod } from "@structured-id/proto/sid/v1/admin/analytics";
import { getTransport } from "@structured-id/ui-core";

function client() {
  return new AnalyticsServiceClient(getTransport());
}

export const useAnalyticsStore = defineStore("analytics", () => {
  const cards = ref<MetricCard[]>([]);
  const authActivity = ref<TimeSeries[]>([]);
  const authLatency = ref<TimeSeries[]>([]);
  const topApplications = ref<ApplicationMetric[]>([]);
  const authMethodSlices = ref<DistributionSlice[]>([]);
  const authMethodTotal = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchOverview(period: AnalyticsPeriod) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await client().getOverviewMetrics({ period });
      cards.value = response.cards;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchAuthActivity(
    period: AnalyticsPeriod,
    start?: { seconds: bigint; nanos: number },
    end?: { seconds: bigint; nanos: number },
  ) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await client().getAuthActivity({
        period,
        start: start ?? { seconds: 0n, nanos: 0 },
        end: end ?? { seconds: 0n, nanos: 0 },
      });
      authActivity.value = response.series;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchAuthLatency(
    period: AnalyticsPeriod,
    start?: { seconds: bigint; nanos: number },
    end?: { seconds: bigint; nanos: number },
  ) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await client().getAuthLatency({
        period,
        start: start ?? { seconds: 0n, nanos: 0 },
        end: end ?? { seconds: 0n, nanos: 0 },
      });
      authLatency.value = response.series;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchTopApplications(period: AnalyticsPeriod, limit = 10) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await client().getTopApplications({
        period,
        limit,
      });
      topApplications.value = response.applications;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchAuthMethodDistribution(
    period: AnalyticsPeriod,
    start?: { seconds: bigint; nanos: number },
    end?: { seconds: bigint; nanos: number },
  ) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await client().getAuthMethodDistribution({
        period,
        start: start ?? { seconds: 0n, nanos: 0 },
        end: end ?? { seconds: 0n, nanos: 0 },
      });
      authMethodSlices.value = response.slices;
      authMethodTotal.value = response.total;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchAll(period: AnalyticsPeriod) {
    loading.value = true;
    error.value = null;
    try {
      await Promise.all([
        fetchOverview(period),
        fetchAuthActivity(period),
        fetchAuthLatency(period),
        fetchTopApplications(period),
        fetchAuthMethodDistribution(period),
      ]);
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  return {
    cards,
    authActivity,
    authLatency,
    topApplications,
    authMethodSlices,
    authMethodTotal,
    loading,
    error,
    fetchOverview,
    fetchAuthActivity,
    fetchAuthLatency,
    fetchTopApplications,
    fetchAuthMethodDistribution,
    fetchAll,
  };
});
