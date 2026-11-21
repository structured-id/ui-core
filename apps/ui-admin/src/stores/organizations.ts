import { defineStore } from "pinia";
import { ref } from "vue";
import { SiteServiceClient } from "@structured-id/proto/sid/v1/admin/organizations.client";
import type { SiteInfo } from "@structured-id/proto/sid/v1/admin/organizations";
import { getTransport } from "@structured-id/ui-core";

function client() {
  return new SiteServiceClient(getTransport());
}

export const useOrganizationsStore = defineStore("organizations", () => {
  const siteInfo = ref<SiteInfo | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  async function fetchSiteInfo() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await client().getSiteInfo({});
      siteInfo.value = response;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function updateSiteName(siteName: string) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await client().updateSiteName({ siteName });
      siteInfo.value = response;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      saving.value = false;
    }
  }

  return {
    siteInfo,
    loading,
    saving,
    error,
    fetchSiteInfo,
    updateSiteName,
  };
});
