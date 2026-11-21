import { defineStore } from "pinia";
import { ref } from "vue";
import { UserProfileServiceClient } from "@structured-id/proto/sid/v1/admin/user_profile.client";
import type { ProfileSchema } from "@structured-id/proto/sid/v1/admin/user_profile";
import { getTransport } from "@structured-id/ui-core";

function client() {
  return new UserProfileServiceClient(getTransport());
}

export const useUserProfileStore = defineStore("userProfile", () => {
  const schema = ref<ProfileSchema | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  async function fetchSchema() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await client().getSchema({});
      schema.value = response;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function updateSchema(updated: ProfileSchema) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await client().updateSchema({ schema: updated });
      schema.value = response;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      saving.value = false;
    }
  }

  return {
    schema,
    loading,
    saving,
    error,
    fetchSchema,
    updateSchema,
  };
});
