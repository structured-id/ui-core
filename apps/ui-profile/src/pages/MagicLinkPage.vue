<template>
  <ceremony-frame>
    <q-card v-if="!failure" flat bordered class="q-pa-lg text-center">
      <q-spinner-dots size="40px" color="primary" />
      <div class="text-body2 q-mt-md">Signing you in…</div>
    </q-card>
    <q-banner v-else class="bg-negative text-white" rounded>
      {{ failure }}
      <template #action>
        <q-btn flat label="Sign in" to="/account/login" />
      </template>
    </q-banner>
  </ceremony-frame>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { MagicLinkId } from "@structured-id/ids";
import {
  useLoginSuccess,
  verifyMagicLink,
} from "@structured-id/ui-core/profile";
import { refusalMessage } from "@structured-id/ui-core";
import CeremonyFrame from "src/components/CeremonyFrame.vue";

const route = useRoute();
const failure = ref<string | null>(null);
const { onLoginSuccess } = useLoginSuccess("/account", {
  issuerOrigin: window.location.origin,
});

/** The mailed link names its sign-in (`session`) and carries its `token`. */
onMounted(async () => {
  const { session, token } = route.query;
  let link: MagicLinkId;
  try {
    if (typeof session !== "string" || typeof token !== "string") throw 0;
    link = MagicLinkId.parse(session);
  } catch {
    failure.value = "This sign-in link is incomplete";
    return;
  }
  try {
    const signedIn = await verifyMagicLink(link, token);
    await onLoginSuccess({ sessionId: signedIn.sessionId });
  } catch (e) {
    failure.value = refusalMessage(e, "This sign-in link cannot be used");
  }
});
</script>
