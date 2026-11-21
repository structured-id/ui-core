<template>
  <ceremony-frame>
    <q-banner v-if="failure" class="bg-negative text-white" rounded>
      {{ failure }}
      <template #action>
        <q-btn flat label="Request a new link" to="/account/reset" />
      </template>
    </q-banner>

    <q-card v-else-if="!verified" flat bordered class="q-pa-lg">
      <q-skeleton type="text" width="60%" />
      <q-skeleton type="QInput" class="q-mt-md" />
    </q-card>

    <q-card v-else flat bordered>
      <q-card-section>
        <div class="text-h6">Choose a new password</div>
      </q-card-section>
      <q-card-section>
        <q-form @submit="replace">
          <q-input
            v-model="password"
            type="password"
            label="New password"
            autocomplete="new-password"
            outlined
            :rules="[(v: string) => !!v || 'Required']"
          />
          <q-input
            v-model="confirm"
            type="password"
            label="Confirm password"
            autocomplete="new-password"
            outlined
            class="q-mt-sm"
            :rules="[(v: string) => v === password || 'Passwords do not match']"
          />
          <q-linear-progress
            v-if="progress !== null"
            :value="progress"
            class="q-mt-md"
          />
          <div v-if="error" class="text-negative q-mt-sm">{{ error }}</div>
          <q-btn
            type="submit"
            color="primary"
            class="full-width q-mt-md"
            label="Set password"
            :loading="busy"
            :disable="!password || password !== confirm"
          />
        </q-form>
      </q-card-section>
    </q-card>
  </ceremony-frame>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ResetSessionId } from "@structured-id/ids";
import {
  useLoginSuccess,
  verifyPasswordReset,
} from "@structured-id/ui-core/profile";
import { refusalMessage } from "@structured-id/ui-core";
import CeremonyFrame from "src/components/CeremonyFrame.vue";
import { useAuth } from "src/composables/useAuth";

type VerifiedReset = Awaited<ReturnType<typeof verifyPasswordReset>>;

const route = useRoute();
const router = useRouter();
const { resetPassword, prewarm } = useAuth();
const { onLoginSuccess } = useLoginSuccess("/account", {
  issuerOrigin: window.location.origin,
});

const verified = shallowRef<VerifiedReset | null>(null);
const failure = ref<string | null>(null);
const password = ref("");
const confirm = ref("");
const busy = ref(false);
const progress = ref<number | null>(null);
const error = ref<string | null>(null);

/** The mailed link names its reset (`session`) and carries its `token`. */
onMounted(async () => {
  void prewarm();
  const { session, token } = route.query;
  let reset: ResetSessionId;
  try {
    if (typeof session !== "string" || typeof token !== "string") throw 0;
    reset = ResetSessionId.parse(session);
  } catch {
    failure.value = "This reset link is incomplete";
    return;
  }
  try {
    verified.value = await verifyPasswordReset(reset, token);
  } catch (e) {
    failure.value = refusalMessage(e, "This reset link cannot be used");
  }
});

/** A reset that signed the user in continues there; otherwise sign in anew. */
async function replace() {
  if (!verified.value) return;
  busy.value = true;
  error.value = null;
  try {
    const done = await resetPassword(
      verified.value.history,
      password.value,
      (p) => (progress.value = p.fraction),
    );
    if (done.sessionId) {
      await onLoginSuccess({ sessionId: done.sessionId });
    } else {
      await router.push("/account/login");
    }
  } catch (e) {
    error.value = refusalMessage(e, "The password was not replaced");
  } finally {
    busy.value = false;
    progress.value = null;
  }
}
</script>
