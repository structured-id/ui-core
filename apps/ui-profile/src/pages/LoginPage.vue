<template>
  <ceremony-frame>
    <sid-login-form
      :login-fn="login"
      local-login
      :register-url="withContinuation('/account/register', route.query)"
      :forgot-password-url="withContinuation('/account/reset', route.query)"
      @success="onLoginSuccess"
    >
      <template v-if="connections.length" #footer>
        <q-separator />
        <q-card-section class="q-gutter-y-sm">
          <div class="text-caption text-grey-7 text-center">
            Or sign in with
          </div>
          <q-btn
            v-for="connection in connections"
            :key="connection.handle"
            :label="connection.name"
            outline
            no-caps
            color="primary"
            class="full-width"
            :loading="leaving === connection.handle"
            :disable="leaving !== null"
            data-test="sign-in-connection"
            @click="signInThrough(connection.handle)"
          />
        </q-card-section>
      </template>
    </sid-login-form>
  </ceremony-frame>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute } from "vue-router";
import { withContinuation } from "src/continuation";
import {
  SidLoginForm,
  useLoginSuccess,
  useSignInConnections,
} from "@structured-id/ui-core/profile";
import CeremonyFrame from "src/components/CeremonyFrame.vue";
import { useAuth } from "src/composables/useAuth";

const route = useRoute();
const { login, prewarm } = useAuth();

// Back to the authorization request the issuer sent the browser here for
// (`rd`, validated against this installation's origin), or into the
// account pages.
const { onLoginSuccess } = useLoginSuccess("/account", {
  issuerOrigin: window.location.origin,
});

// The issuers this installation registered for signing in through, for the
// request the browser was sent here to complete.
const { connections, leaving, load, signInThrough } = useSignInConnections(
  () => route.query.rd,
  window.location.origin,
);

// The password client loads while the user types.
onMounted(() => {
  void prewarm();
  void load();
});
</script>
