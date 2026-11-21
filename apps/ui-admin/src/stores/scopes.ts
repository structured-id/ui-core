import { defineStore } from "pinia";
import { ref } from "vue";
import { ScopeServiceClient } from "@structured-id/proto/sid/v1/admin/scopes.client";
import type {
  Scope,
  ClaimMapping,
  RealmScopeDefaults,
} from "@structured-id/proto/sid/v1/admin/scopes";
import { ClaimSource } from "@structured-id/proto/sid/v1/admin/scopes";
import { getAccountTransport } from "@structured-id/ui-core";
import { Empty } from "@structured-id/proto/google/protobuf/empty";

function getClient() {
  return new ScopeServiceClient(getAccountTransport());
}

export const useScopesStore = defineStore("scopes", () => {
  // ── State ──
  const scopes = ref<Scope[]>([]);
  const currentScope = ref<Scope | null>(null);
  const claimMappings = ref<ClaimMapping[]>([]);
  const realmDefaults = ref<RealmScopeDefaults | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ── Scopes ──

  async function fetchScopes() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listScopes(Empty.create());
      scopes.value = response.scopes;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load scopes";
    } finally {
      loading.value = false;
    }
  }

  /**
   * The scope whose detail (scope, claim mappings) is shown; another
   * scope's starts empty and a late answer for one no longer shown is dropped.
   */
  let scopeShown = "";

  function showScope(scopeId: string): void {
    if (scopeShown !== scopeId) {
      scopeShown = scopeId;
      currentScope.value = null;
      claimMappings.value = [];
    }
  }

  async function fetchScope(scopeId: string) {
    showScope(scopeId);
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getScope({ scopeId });
      if (scopeShown === scopeId) currentScope.value = response;
      return response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load scope";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createScope(req: {
    name: string;
    displayName: string;
    description: string;
    consentRequired: boolean;
    includeInTokenScope: boolean;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().createScope(req);
      scopes.value.push(response);
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to create scope";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateScope(req: {
    scopeId: string;
    displayName?: string;
    description?: string;
    consentRequired?: boolean;
    includeInTokenScope?: boolean;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateScope(req);
      const idx = scopes.value.findIndex((s) => s.id === req.scopeId);
      if (idx !== -1) scopes.value[idx] = response;
      if (currentScope.value?.id === req.scopeId) currentScope.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update scope";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteScope(scopeId: string) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().deleteScope({ scopeId });
      scopes.value = scopes.value.filter((s) => s.id !== scopeId);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete scope";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Realm Defaults ──

  async function fetchRealmDefaults() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getRealmDefaults(Empty.create());
      realmDefaults.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load realm defaults";
    } finally {
      loading.value = false;
    }
  }

  async function updateRealmDefaults(defaults: RealmScopeDefaults) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateRealmDefaults(defaults);
      realmDefaults.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update realm defaults";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Claim Mappings ──

  async function fetchClaimMappings(scopeId: string) {
    showScope(scopeId);
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listClaimMappings({ scopeId });
      if (scopeShown === scopeId) claimMappings.value = response.mappings;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load claim mappings";
    } finally {
      loading.value = false;
    }
  }

  async function addClaimMapping(req: {
    scopeId: string;
    claimName: string;
    source: ClaimSource;
    sourceKey: string;
    staticValue: string;
    multivalued: boolean;
    addToIdToken: boolean;
    addToAccessToken: boolean;
    addToUserinfo: boolean;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().addClaimMapping(req);
      if (scopeShown === req.scopeId) claimMappings.value.push(response);
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to add claim mapping";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateClaimMapping(req: {
    scopeId: string;
    mappingId: string;
    claimName?: string;
    source?: ClaimSource;
    sourceKey?: string;
    staticValue?: string;
    multivalued?: boolean;
    addToIdToken?: boolean;
    addToAccessToken?: boolean;
    addToUserinfo?: boolean;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateClaimMapping(req);
      if (scopeShown === req.scopeId) {
        const idx = claimMappings.value.findIndex(
          (m) => m.id === req.mappingId,
        );
        if (idx !== -1) claimMappings.value[idx] = response;
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update claim mapping";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteClaimMapping(scopeId: string, mappingId: string) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().deleteClaimMapping({ scopeId, mappingId });
      if (scopeShown === scopeId) {
        claimMappings.value = claimMappings.value.filter(
          (m) => m.id !== mappingId,
        );
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete claim mapping";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    scopes,
    currentScope,
    claimMappings,
    realmDefaults,
    loading,
    error,
    fetchScopes,
    fetchScope,
    createScope,
    updateScope,
    deleteScope,
    fetchRealmDefaults,
    updateRealmDefaults,
    fetchClaimMappings,
    addClaimMapping,
    updateClaimMapping,
    deleteClaimMapping,
  };
});
