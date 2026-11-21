import { defineStore } from "pinia";
import { ref } from "vue";
import { SecurityServiceClient } from "@structured-id/proto/sid/v1/admin/security.client";
import type {
  RateLimitConfig,
  RateLimitDashboard,
  AnomalyRule,
  AnomalyEvent,
  CaptchaConfig,
  SecurityPolicyResponse,
  ApplicationOverride,
  BreachDetectionConfig,
  TestCaptchaProviderResponse,
  NetworkPolicy,
} from "@structured-id/proto/sid/v1/admin/security";
import { CaptchaProvider } from "@structured-id/proto/sid/v1/admin/security";
import { getAccountTransport } from "@structured-id/ui-core";
import { Empty } from "@structured-id/proto/google/protobuf/empty";

function getClient() {
  return new SecurityServiceClient(getAccountTransport());
}

export const useSecurityPoliciesStore = defineStore("securityPolicies", () => {
  // ── State ──
  const rateLimitConfig = ref<RateLimitConfig | null>(null);
  const rateLimitDashboard = ref<RateLimitDashboard | null>(null);
  const anomalyRules = ref<AnomalyRule[]>([]);
  const anomalyEvents = ref<AnomalyEvent[]>([]);
  const anomalyNextPageToken = ref("");
  const captchaConfig = ref<CaptchaConfig | null>(null);
  const securityPolicy = ref<SecurityPolicyResponse | null>(null);
  const applicationOverrides = ref<ApplicationOverride[]>([]);
  const breachDetectionConfig = ref<BreachDetectionConfig | null>(null);
  const networkPolicy = ref<NetworkPolicy | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ── Rate Limits ──

  async function fetchRateLimitConfig() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getRateLimitConfig(Empty.create());
      rateLimitConfig.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load rate limit config";
    } finally {
      loading.value = false;
    }
  }

  async function fetchRateLimitDashboard() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getRateLimitDashboard(
        Empty.create(),
      );
      rateLimitDashboard.value = response;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to load rate limit dashboard";
    } finally {
      loading.value = false;
    }
  }

  // ── Anomaly Rules ──

  async function fetchAnomalyRules() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listAnomalyRules(Empty.create());
      anomalyRules.value = response.rules;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load anomaly rules";
    } finally {
      loading.value = false;
    }
  }

  async function fetchAnomalyEventLog(ruleId?: string) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getAnomalyEventLog({
        pageSize: 50,
        pageToken: "",
        ruleId,
      });
      anomalyEvents.value = response.events;
      anomalyNextPageToken.value = response.nextPageToken;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load anomaly event log";
    } finally {
      loading.value = false;
    }
  }

  // ── CAPTCHA ──

  async function fetchCaptchaConfig() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getCaptchaConfig(Empty.create());
      captchaConfig.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load CAPTCHA config";
    } finally {
      loading.value = false;
    }
  }

  async function updateCaptchaConfig(config: CaptchaConfig) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateCaptchaConfig(config);
      captchaConfig.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update CAPTCHA config";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function testCaptchaProvider(
    provider: CaptchaProvider,
    siteKey: string,
    secretKey: string,
  ): Promise<TestCaptchaProviderResponse> {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().testCaptchaProvider({
        provider,
        siteKey,
        secretKey,
      });
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to test CAPTCHA provider";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Security Policy ──

  async function fetchSecurityPolicy() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getSecurityPolicy(Empty.create());
      securityPolicy.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load security policy";
    } finally {
      loading.value = false;
    }
  }

  async function fetchApplicationOverrides() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listApplicationOverrides(
        Empty.create(),
      );
      applicationOverrides.value = response.overrides;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to load application overrides";
    } finally {
      loading.value = false;
    }
  }

  // ── Breach Detection ──

  async function fetchBreachDetectionConfig() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getBreachDetectionConfig(
        Empty.create(),
      );
      breachDetectionConfig.value = response;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to load breach detection config";
    } finally {
      loading.value = false;
    }
  }

  async function updateBreachDetectionConfig(config: BreachDetectionConfig) {
    loading.value = true;
    error.value = null;
    try {
      const { response } =
        await getClient().updateBreachDetectionConfig(config);
      breachDetectionConfig.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to update breach detection config";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Network Policy ──

  async function fetchNetworkPolicy() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getNetworkPolicy(Empty.create());
      networkPolicy.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load network policy";
    } finally {
      loading.value = false;
    }
  }

  async function updateNetworkPolicy(config: NetworkPolicy) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateNetworkPolicy(config);
      networkPolicy.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update network policy";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    rateLimitConfig,
    rateLimitDashboard,
    anomalyRules,
    anomalyEvents,
    anomalyNextPageToken,
    captchaConfig,
    securityPolicy,
    applicationOverrides,
    breachDetectionConfig,
    networkPolicy,
    loading,
    error,
    fetchRateLimitConfig,
    fetchRateLimitDashboard,
    fetchAnomalyRules,
    fetchAnomalyEventLog,
    fetchCaptchaConfig,
    updateCaptchaConfig,
    testCaptchaProvider,
    fetchSecurityPolicy,
    fetchApplicationOverrides,
    fetchBreachDetectionConfig,
    updateBreachDetectionConfig,
    fetchNetworkPolicy,
    updateNetworkPolicy,
  };
});
