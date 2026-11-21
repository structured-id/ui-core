<template>
  <ceremony-frame>
    <q-card flat bordered>
      <q-card-section>
        <div class="text-h6">Reset your password</div>
        <div class="text-body2 text-grey-7">
          Enter your sign-in name. If an account uses it, a reset link is sent
          to its address.
        </div>
      </q-card-section>
      <q-card-section v-if="sent">
        <q-banner class="bg-grey-3" rounded>
          Check your mail for the reset link.
        </q-banner>
      </q-card-section>
      <q-card-section v-else>
        <q-form @submit="send">
          <q-input
            v-model="principal"
            label="Email, phone or username"
            autocomplete="username"
            outlined
            :error="!!error"
            :error-message="error ?? undefined"
          />
          <q-btn
            type="submit"
            color="primary"
            class="full-width q-mt-md"
            label="Send reset link"
            :loading="busy"
            :disable="!principal.trim()"
          />
        </q-form>
      </q-card-section>
      <q-card-actions align="center">
        <q-btn flat no-caps label="Back to sign-in" to="/account/login" />
      </q-card-actions>
    </q-card>
  </ceremony-frame>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { requestPasswordReset } from "@structured-id/ui-core/profile";
import { normalizePrincipal, refusalMessage } from "@structured-id/ui-core";
import CeremonyFrame from "src/components/CeremonyFrame.vue";

const principal = ref("");
const busy = ref(false);
const sent = ref(false);
const error = ref<string | null>(null);

/** The answer is the same whether or not an account uses the name. */
async function send() {
  busy.value = true;
  error.value = null;
  try {
    await requestPasswordReset(normalizePrincipal(principal.value).value);
    sent.value = true;
  } catch (e) {
    error.value = refusalMessage(e, "The reset link was not sent");
  } finally {
    busy.value = false;
  }
}
</script>
