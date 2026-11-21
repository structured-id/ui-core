import { defineStore } from "pinia";
import { ref } from "vue";
import { BrandingServiceClient } from "@structured-id/proto/sid/v1/admin/branding.client";
import { BrandingStatus } from "@structured-id/proto/sid/v1/admin/branding";
import type {
  BrandingConfig,
  ContrastCheck,
  ColorPair,
  DesignTokens,
  BrandingAssets,
  DarkModeConfig,
  BrandingText,
} from "@structured-id/proto/sid/v1/admin/branding";
import { getAccountTransport } from "@structured-id/ui-core";
import type { BrandingConfigId, ProjectId } from "@structured-id/ids";
import { names } from "#admin/ids";

function getClient() {
  return new BrandingServiceClient(getAccountTransport());
}

export const useBrandingStore = defineStore("branding", () => {
  const config = ref<BrandingConfig | null>(null);
  const configs = ref<BrandingConfig[]>([]);
  const contrastResults = ref<ContrastCheck[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  async function fetchConfigs(projectId: ProjectId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listBrandingConfigs({
        projectId: projectId.toWire(),
      });
      configs.value = response.configs;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load branding configs";
    } finally {
      loading.value = false;
    }
  }

  /**
   * The configuration the editor works on: the most recently changed draft,
   * else the published one, else none (saving then creates the first draft).
   */
  async function loadEditable(projectId: ProjectId) {
    await fetchConfigs(projectId);
    if (error.value) return;
    const changed = (c: BrandingConfig) => c.updatedAt?.seconds ?? 0n;
    const drafts = configs.value
      .filter((c) => c.status === BrandingStatus.DRAFT)
      .sort((a, b) =>
        changed(b) > changed(a) ? 1 : changed(b) < changed(a) ? -1 : 0,
      );
    config.value =
      drafts[0] ??
      configs.value.find((c) => c.status === BrandingStatus.PUBLISHED) ??
      null;
  }

  async function createConfig(
    projectId: ProjectId,
    tokens?: DesignTokens,
    assets?: BrandingAssets,
    darkMode?: DarkModeConfig,
    text?: BrandingText,
  ) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await getClient().createBrandingConfig({
        projectId: projectId.toWire(),
        tokens,
        assets,
        darkMode,
        text,
      });
      config.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to create branding config";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function updateConfig(
    projectId: ProjectId,
    configId: BrandingConfigId,
    tokens?: DesignTokens,
    assets?: BrandingAssets,
    darkMode?: DarkModeConfig,
    text?: BrandingText,
  ) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateBrandingConfig({
        projectId: projectId.toWire(),
        configId: configId.toWire(),
        tokens,
        assets,
        darkMode,
        text,
      });
      config.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update branding config";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function publishConfig(
    projectId: ProjectId,
    configId: BrandingConfigId,
  ) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await getClient().publishBrandingConfig({
        projectId: projectId.toWire(),
        configId: configId.toWire(),
      });
      config.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to publish branding config";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function deleteConfig(
    projectId: ProjectId,
    configId: BrandingConfigId,
  ) {
    saving.value = true;
    error.value = null;
    try {
      await getClient().deleteBrandingConfig({
        projectId: projectId.toWire(),
        configId: configId.toWire(),
      });
      configs.value = configs.value.filter((c) => !names(c.id, configId));
      if (names(config.value?.id, configId)) config.value = null;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete branding config";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function validateContrast(pairs: ColorPair[]) {
    error.value = null;
    try {
      const { response } = await getClient().validateContrast({ pairs });
      contrastResults.value = response.results;
      return response.results;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to validate contrast";
      throw err;
    }
  }

  return {
    config,
    configs,
    contrastResults,
    loading,
    saving,
    error,
    fetchConfigs,
    loadEditable,
    createConfig,
    updateConfig,
    publishConfig,
    deleteConfig,
    validateContrast,
  };
});
