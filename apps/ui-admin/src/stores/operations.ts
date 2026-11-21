import { defineStore } from "pinia";
import { ref, toRaw } from "vue";
import {
  FeatureFlagServiceClient,
  SystemHealthServiceClient,
  NotificationChannelServiceClient,
} from "@structured-id/proto/sid/v1/admin/operations.client";
import type {
  FeatureFlag,
  FlagHistoryEntry,
  PropagationStatusResponse,
  HealthStatusResponse,
  InstanceInfo,
  ChannelSummary,
  ChannelConfig,
  DeliveryHealthResponse,
  DefaultNotificationPreferences,
} from "@structured-id/proto/sid/v1/admin/operations";
import { ChannelType } from "@structured-id/proto/sid/v1/admin/operations";
import { getAccountTransport } from "@structured-id/ui-core";

function flagClient() {
  return new FeatureFlagServiceClient(getAccountTransport());
}
function healthClient() {
  return new SystemHealthServiceClient(getAccountTransport());
}
function channelClient() {
  return new NotificationChannelServiceClient(getAccountTransport());
}

export const useOperationsStore = defineStore("operations", () => {
  const flags = ref<FeatureFlag[]>([]);
  const flagHistory = ref<FlagHistoryEntry[]>([]);
  const propagation = ref<PropagationStatusResponse | null>(null);
  const healthStatus = ref<HealthStatusResponse | null>(null);
  const instanceInfo = ref<InstanceInfo | null>(null);
  const channels = ref<ChannelSummary[]>([]);
  const channelConfig = ref<ChannelConfig | null>(null);
  const deliveryHealth = ref<DeliveryHealthResponse | null>(null);
  const defaultPreferences = ref<DefaultNotificationPreferences | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  // ── Feature Flags ──

  async function fetchFlags() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await flagClient().listFlags({});
      flags.value = response.flags;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load flags";
    } finally {
      loading.value = false;
    }
  }

  async function setFlag(flagName: string, enabled: boolean) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await flagClient().setFlag({ flagName, enabled });
      const idx = flags.value.findIndex((f) => f.flagName === flagName);
      if (idx >= 0) flags.value[idx] = response;
      return response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to set flag";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function resetFlag(flagName: string) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await flagClient().resetFlag({ flagName });
      const idx = flags.value.findIndex((f) => f.flagName === flagName);
      if (idx >= 0) flags.value[idx] = response;
      return response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to reset flag";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function fetchFlagHistory(flagName: string) {
    error.value = null;
    try {
      const { response } = await flagClient().listFlagHistory({ flagName });
      flagHistory.value = response.entries;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load flag history";
    }
  }

  async function fetchPropagation() {
    error.value = null;
    try {
      const { response } = await flagClient().getPropagationStatus({});
      propagation.value = response;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to load propagation status";
    }
  }

  // ── System Health ──

  async function fetchHealthStatus() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await healthClient().getHealthStatus({});
      healthStatus.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load health status";
    } finally {
      loading.value = false;
    }
  }

  async function fetchInstanceInfo() {
    error.value = null;
    try {
      const { response } = await healthClient().getInstanceInfo({});
      instanceInfo.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load instance info";
    }
  }

  // ── Notification Channels ──

  async function fetchChannels() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await channelClient().listChannels({});
      channels.value = response.channels;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load channels";
    } finally {
      loading.value = false;
    }
  }

  async function fetchChannelConfig(channel: ChannelType) {
    error.value = null;
    try {
      const { response } = await channelClient().getChannelConfig({ channel });
      channelConfig.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load channel config";
    }
  }

  async function updateChannelConfig(config: ChannelConfig) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await channelClient().updateChannelConfig({
        channel: config.channel,
        config,
      });
      channelConfig.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update channel config";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function testChannel(channel: ChannelType, recipient: string) {
    error.value = null;
    try {
      const { response } = await channelClient().testChannel({
        channel,
        recipient,
      });
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to test channel";
      throw err;
    }
  }

  async function fetchDeliveryHealth(period: string) {
    error.value = null;
    try {
      const { response } = await channelClient().getDeliveryHealth({ period });
      deliveryHealth.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load delivery health";
    }
  }

  async function fetchDefaultPreferences() {
    error.value = null;
    try {
      const { response } = await channelClient().getDefaultPreferences({});
      defaultPreferences.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load preferences";
    }
  }

  /** Edits made to the shown preferences; an answer older than the last is not applied. */
  let preferenceEdits = 0;

  /** The page changed the shown preferences. */
  function preferencesEdited() {
    preferenceEdits += 1;
  }

  /**
   * Save the shown preferences as they are now. The answer replaces them
   * only when no edit was made after this save started: the toggles edit the
   * shown state directly, and an earlier answer must not undo a newer edit.
   */
  async function updateDefaultPreferences() {
    if (!defaultPreferences.value) return;
    const sentAfter = preferenceEdits;
    saving.value = true;
    error.value = null;
    try {
      const { response } = await channelClient().updateDefaultPreferences(
        structuredClone(toRaw(defaultPreferences.value)),
      );
      if (preferenceEdits === sentAfter) defaultPreferences.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update preferences";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  return {
    flags,
    flagHistory,
    propagation,
    healthStatus,
    instanceInfo,
    channels,
    channelConfig,
    deliveryHealth,
    defaultPreferences,
    loading,
    saving,
    error,
    fetchFlags,
    setFlag,
    resetFlag,
    fetchFlagHistory,
    fetchPropagation,
    fetchHealthStatus,
    fetchInstanceInfo,
    fetchChannels,
    fetchChannelConfig,
    updateChannelConfig,
    testChannel,
    fetchDeliveryHealth,
    fetchDefaultPreferences,
    updateDefaultPreferences,
    preferencesEdited,
  };
});
