<template>
  <q-page padding class="page">
    <session-list
      :sessions="sessions"
      :loading="loading"
      :error="error"
      :revoking="revoking"
      @revoke="revoke"
    />
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";
import type { SessionId } from "@structured-id/ids";
import {
  SessionList,
  fetchSessions,
  revokeSession,
  type Session,
} from "@structured-id/ui-core/profile";
import { refusalMessage } from "@structured-id/ui-core";

const sessions = shallowRef<Session[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const revoking = shallowRef<SessionId | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    sessions.value = await fetchSessions();
  } catch (e) {
    error.value = refusalMessage(e, "Your sessions cannot be loaded");
  } finally {
    loading.value = false;
  }
}

/** The list is read again: what is left is the server's answer. */
async function revoke(id: SessionId) {
  revoking.value = id;
  error.value = null;
  try {
    await revokeSession(id);
    await load();
  } catch (e) {
    error.value = refusalMessage(e, "The session was not ended");
  } finally {
    revoking.value = null;
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
