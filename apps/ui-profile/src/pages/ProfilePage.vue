<template>
  <q-page padding class="page">
    <profile-editor
      :profile="profile"
      :loading="loading"
      :saving="saving"
      :error="error"
      @save="save"
    />
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";
import { useQuasar } from "quasar";
import {
  ProfileEditor,
  fetchCurrentProfile,
  updateProfile,
  type Profile,
} from "@structured-id/ui-core/profile";
import { refusalMessage } from "@structured-id/ui-core";

const $q = useQuasar();
// Shallow: the profile's typed identifier is a class instance, not state.
const profile = shallowRef<Profile | null>(null);
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    profile.value = await fetchCurrentProfile();
  } catch (e) {
    error.value = refusalMessage(e, "Your profile cannot be loaded");
  } finally {
    loading.value = false;
  }
}

async function save(data: {
  givenName: string;
  familyName: string;
  middleName: string;
  avatarUrl: string;
}) {
  if (!profile.value) return;
  saving.value = true;
  error.value = null;
  try {
    profile.value = await updateProfile(profile.value.id, data);
    $q.notify({ type: "positive", message: "Profile saved" });
  } catch (e) {
    error.value = refusalMessage(e, "Your profile was not saved");
  } finally {
    saving.value = false;
  }
}

onMounted(() => void load());
</script>

<style scoped>
.page {
  max-width: 720px;
  margin: 0 auto;
}
</style>
