<template>
  <ceremony-frame>
    <sid-sign-in-pending v-if="!offer" :failed="failed" @retry="loadOffer">
      <template v-if="connections.length" #footer>
        <sign-in-connection-list
          :connections="connections"
          :leaving="leaving"
          @choose="signInThrough"
        />
      </template>
    </sid-sign-in-pending>
    <sid-login-form
      v-else
      :login-fn="login"
      local-login
      :password-sign-in="offer.password"
      :register-url="
        offer.registration
          ? withContinuation('/account/register', route.query)
          : undefined
      "
      @success="onLoginSuccess"
    >
      <template #below-form="{ identifier }">
        <div
          v-if="offer.password && offer.passwordReset"
          class="text-right q-mt-xs"
        >
          <router-link
            :to="withContinuation('/account/reset', route.query)"
            class="text-caption text-primary"
            data-test="forgot-password"
          >
            Forgot password?
          </router-link>
        </div>
        <template v-if="offer.passkey">
          <q-btn
            label="Continue with passkey"
            icon="sym_o_passkey"
            outline
            no-caps
            color="primary"
            class="full-width"
            :class="offer.password ? 'q-mt-md' : undefined"
            :loading="passkeyLoading"
            data-test="passkey"
            @click="signInWithPasskey(identifier)"
          />
          <q-banner
            v-if="passkeyError"
            class="bg-negative text-white q-mt-md"
            rounded
            dense
            data-test="passkey-error"
          >
            {{ passkeyError }}
          </q-banner>
        </template>
      </template>
      <template v-if="connections.length" #footer>
        <sign-in-connection-list
          :connections="connections"
          :leaving="leaving"
          @choose="signInThrough"
        />
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
  SidSignInPending,
  useLoginSuccess,
  usePasskeySignIn,
  useSignInConnections,
  useSignInOffer,
} from "@structured-id/ui-core/profile";
import CeremonyFrame from "src/components/CeremonyFrame.vue";
import SignInConnectionList from "src/components/SignInConnectionList.vue";
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
// request the browser was sent here to complete. They are confirmed by
// their own read, so they are shown whatever the offer's state.
const { connections, leaving, load, signInThrough } = useSignInConnections(
  () => route.query.rd,
  window.location.origin,
);

// What this installation offers on its sign-in page. No form is shown before
// it answers: account creation, password recovery, the password form and the
// passkey button appear only when it offers them. Registration by an
// invitation or the installation's claim token keeps its own address.
const { offer, failed, load: loadOffer } = useSignInOffer();

// A passkey for the login typed, or with an empty field one that names its
// account itself; it continues as any other sign-in.
const {
  signInWithPasskey,
  loading: passkeyLoading,
  error: passkeyError,
} = usePasskeySignIn({ onSuccess: onLoginSuccess });

// The password client loads while the user types.
onMounted(() => {
  void prewarm();
  void load();
  void loadOffer();
});
</script>
