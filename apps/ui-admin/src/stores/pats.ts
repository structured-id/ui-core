import { defineStore } from "pinia";
import { ref } from "vue";
import { PatServiceClient } from "@structured-id/proto/sid/v1/machine/pat.client";
import type { Pat } from "@structured-id/proto/sid/v1/machine/pat";
import { getTransport } from "@structured-id/ui-core";

function getClient() {
  return new PatServiceClient(getTransport());
}

export const usePatsStore = defineStore("pats", () => {
  const pats = ref<Pat[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchAllPats() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listAllPats({});
      pats.value = response.pats;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load PATs";
    } finally {
      loading.value = false;
    }
  }

  async function revokePat(patId: string) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().adminRevokePat({ patId });
      const idx = pats.value.findIndex((p) => p.id === patId);
      if (idx !== -1) {
        pats.value[idx] = {
          ...pats.value[idx],
          status: 2, // PAT_STATUS_REVOKED
        };
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to revoke PAT";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    pats,
    loading,
    error,
    fetchAllPats,
    revokePat,
  };
});
