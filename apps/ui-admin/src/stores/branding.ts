import { defineStore } from "pinia";
import { ref } from "vue";
import { BrandingServiceClient } from "@structured-id/proto/sid/v1/admin/branding.client";
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
import { names } from "src/ids";

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

  async function fetchPublishedBranding(projectId: ProjectId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getPublishedBranding({
        projectId: projectId.toWire(),
      });
      config.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load branding";
    } finally {
      loading.value = false;
    }
  }

  async function fetchBrandingConfig(
    projectId: ProjectId,
    configId: BrandingConfigId,
  ) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getBrandingConfig({
        projectId: projectId.toWire(),
        configId: configId.toWire(),
      });
      config.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load branding config";
    } finally {
      loading.value = false;
    }
  }

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
    fetchPublishedBranding,
    fetchBrandingConfig,
    fetchConfigs,
    createConfig,
    updateConfig,
    publishConfig,
    deleteConfig,
    validateContrast,
  };
});
