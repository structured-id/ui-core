<template>
  <q-page padding class="page">
    <consent-manager
      :consents="consents"
      :loading="loading"
      :error="error"
      @disconnect="confirmDisconnect"
    />
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";
import { useQuasar } from "quasar";
import {
  ConsentManager,
  disconnectSite,
  listConsents,
  type ConsentInfo,
} from "@structured-id/ui-core/profile";
import { refusalMessage } from "@structured-id/ui-core";

const $q = useQuasar();
const consents = shallowRef<ConsentInfo[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    consents.value = await listConsents();
  } catch (e) {
    error.value = refusalMessage(e, "Your connected apps cannot be loaded");
  } finally {
    loading.value = false;
  }
}

function confirmDisconnect(siteId: string) {
  $q.dialog({
    title: "Disconnect app",
    message:
      "The app loses the access you granted; it asks again the next time you use it.",
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await disconnectSite(siteId);
      await load();
    } catch (e) {
      error.value = refusalMessage(e, "The app was not disconnected");
    }
  });
}

onMounted(() => void load());
</script>

<style scoped>
.page {
  max-width: 720px;
  margin: 0 auto;
}
</style>
