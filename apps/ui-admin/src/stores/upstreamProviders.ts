import { defineStore } from "pinia";
import { ref } from "vue";
import { UpstreamServiceClient } from "@structured-id/proto/sid/v1/federation/upstream.client";
import type { UpstreamProvider } from "@structured-id/proto/sid/v1/federation/upstream";
import { getTransport } from "@structured-id/ui-core";

function getClient() {
  return new UpstreamServiceClient(getTransport());
}

export const useUpstreamProvidersStore = defineStore(
  "upstreamProviders",
  () => {
    const providers = ref<UpstreamProvider[]>([]);
    const currentProvider = ref<UpstreamProvider | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function fetchProviders() {
      loading.value = true;
      error.value = null;
      try {
        const { response } = await getClient().listUpstreamProviders({});
        providers.value = response.providers;
      } catch (err) {
        error.value =
          err instanceof Error ? err.message : "Failed to load providers";
      } finally {
        loading.value = false;
      }
    }

    async function getProvider(id: string) {
      loading.value = true;
      error.value = null;
      try {
        const { response } = await getClient().getUpstreamProvider({
          providerId: id,
        });
        currentProvider.value = response.provider ?? null;
        return response.provider;
      } catch (err) {
        error.value =
          err instanceof Error ? err.message : "Failed to load provider";
        throw err;
      } finally {
        loading.value = false;
      }
    }

    async function createProvider(req: {
      name: string;
      protocol: number;
      trustCategory: number;
      clientId: string;
      clientSecret: string;
      discoveryUrl: string;
      authorizationEndpoint: string;
      tokenEndpoint: string;
      userinfoEndpoint: string;
      scopes: string[];
      showOnLogin: boolean;
      displayOrder: number;
      logoUrl: string;
    }) {
      loading.value = true;
      error.value = null;
      try {
        const { response } = await getClient().createUpstreamProvider({
          name: req.name,
          protocol: req.protocol,
          trustCategory: req.trustCategory,
          clientId: req.clientId,
          clientSecret: req.clientSecret,
          discoveryUrl: req.discoveryUrl,
          authorizationEndpoint: req.authorizationEndpoint,
          tokenEndpoint: req.tokenEndpoint,
          userinfoEndpoint: req.userinfoEndpoint,
          scopes: req.scopes,
          showOnLogin: req.showOnLogin,
          displayOrder: req.displayOrder,
          logoUrl: req.logoUrl,
        });
        if (response.provider) {
          providers.value.push(response.provider);
        }
        return response;
      } catch (err) {
        error.value =
          err instanceof Error ? err.message : "Failed to create provider";
        throw err;
      } finally {
        loading.value = false;
      }
    }

    async function updateProvider(
      id: string,
      update: {
        name?: string;
        protocol?: number;
        trustCategory?: number;
        enabled?: boolean;
        clientId?: string;
        clientSecret?: string;
        discoveryUrl?: string;
        authorizationEndpoint?: string;
        tokenEndpoint?: string;
        userinfoEndpoint?: string;
        scopes: string[];
        showOnLogin?: boolean;
        displayOrder?: number;
        logoUrl?: string;
      },
    ) {
      loading.value = true;
      error.value = null;
      try {
        const { response } = await getClient().updateUpstreamProvider({
          providerId: id,
          name: update.name,
          protocol: update.protocol,
          trustCategory: update.trustCategory,
          enabled: update.enabled,
          clientId: update.clientId,
          clientSecret: update.clientSecret,
          discoveryUrl: update.discoveryUrl,
          authorizationEndpoint: update.authorizationEndpoint,
          tokenEndpoint: update.tokenEndpoint,
          userinfoEndpoint: update.userinfoEndpoint,
          scopes: update.scopes,
          showOnLogin: update.showOnLogin,
          displayOrder: update.displayOrder,
          logoUrl: update.logoUrl,
        });
        currentProvider.value = response.provider ?? null;
        const idx = providers.value.findIndex((p) => p.id === id);
        if (idx !== -1 && response.provider) {
          providers.value[idx] = response.provider;
        }
        return response;
      } catch (err) {
        error.value =
          err instanceof Error ? err.message : "Failed to update provider";
        throw err;
      } finally {
        loading.value = false;
      }
    }

    async function deleteProvider(id: string) {
      loading.value = true;
      error.value = null;
      try {
        await getClient().deleteUpstreamProvider({ providerId: id });
        providers.value = providers.value.filter((p) => p.id !== id);
        if (currentProvider.value?.id === id) {
          currentProvider.value = null;
        }
      } catch (err) {
        error.value =
          err instanceof Error ? err.message : "Failed to delete provider";
        throw err;
      } finally {
        loading.value = false;
      }
    }

    return {
      providers,
      currentProvider,
      loading,
      error,
      fetchProviders,
      getProvider,
      createProvider,
      updateProvider,
      deleteProvider,
    };
  },
);
