import { defineStore } from "pinia";
import { ref } from "vue";
import { PatServiceClient } from "@structured-id/proto/sid/v1/machine/pat.client";
import { PatStatus, type Pat } from "@structured-id/proto/sid/v1/machine/pat";
import { getAccountTransport } from "@structured-id/ui-core";
import type { PatId } from "@structured-id/ids";
import { names } from "#admin/ids";

function getClient() {
  return new PatServiceClient(getAccountTransport());
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

  async function revokePat(patId: PatId) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().adminRevokePat({ patId: patId.toWire() });
      const idx = pats.value.findIndex((p) => names(p.id, patId));
      if (idx !== -1) {
        pats.value[idx] = { ...pats.value[idx], status: PatStatus.REVOKED };
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
