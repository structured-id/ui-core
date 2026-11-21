<template>
  <ceremony-frame>
    <q-card v-if="state === 'loading'" flat bordered class="q-pa-lg">
      <q-skeleton type="text" width="60%" />
      <q-skeleton type="QInput" class="q-mt-md" />
      <q-skeleton type="QInput" class="q-mt-md" />
      <q-skeleton type="QBtn" class="q-mt-md" />
    </q-card>

    <q-banner v-else-if="state === 'closed'" class="bg-grey-3" rounded>
      This installation does not accept registration. An administrator creates
      accounts.
      <template #action>
        <q-btn
          flat
          label="Sign in"
          :to="withContinuation('/account/login', route.query)"
        />
      </template>
    </q-banner>

    <q-banner
      v-else-if="state === 'unavailable'"
      class="bg-negative text-white"
      rounded
    >
      {{ unavailableText }}
      <template #action>
        <q-btn flat label="Retry" @click="load" />
      </template>
    </q-banner>

    <sid-registration-form
      v-else
      :register-fn="registerAndSignIn"
      :claim-required="claimRequired"
      :invite-required="inviteRequired"
      :initial-invite-code="initialInviteCode"
      :login-url="withContinuation('/account/login', route.query)"
      @success="afterRegistration"
    />
  </ceremony-frame>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  AdministratorClaim,
  EnrollmentMode,
  SidRegistrationForm,
  getEnrollmentPolicy,
  getInstanceStatus,
  useLoginSuccess,
  type LoginSuccessResult,
  type PasswordOperationProgress,
  type RegistrationExtras,
} from "@structured-id/ui-core/profile";
import { refusalMessage } from "@structured-id/ui-core";
import CeremonyFrame from "src/components/CeremonyFrame.vue";
import { withContinuation } from "src/continuation";
import { useAuth } from "src/composables/useAuth";

const route = useRoute();
const { register, login, prewarm } = useAuth();
const { onLoginSuccess } = useLoginSuccess("/account", {
  issuerOrigin: window.location.origin,
});

type State = "loading" | "open" | "closed" | "unavailable";
const state = ref<State>("loading");
const unavailableText = ref("");
const claimRequired = ref(false);
const inviteRequired = ref(false);
const initialInviteCode =
  typeof route.query.invite === "string" ? route.query.invite : "";

/** The sign-in the registration ended with, handed on once the form closes. */
let signedIn: LoginSuccessResult | null = null;

/**
 * What the installation admits now: while it waits for its first
 * administrator only the claim token does, whatever the enrollment mode;
 * afterwards the enrollment policy decides.
 */
async function load() {
  state.value = "loading";
  try {
    const status = await getInstanceStatus();
    claimRequired.value = status.claim === AdministratorClaim.OPEN;
    if (claimRequired.value) {
      state.value = "open";
      return;
    }
    const policy = await getEnrollmentPolicy();
    if (policy.mode === EnrollmentMode.ADMIN_ONLY) {
      state.value = "closed";
      return;
    }
    inviteRequired.value = policy.mode === EnrollmentMode.INVITE_ONLY;
    state.value = "open";
  } catch (e) {
    unavailableText.value = refusalMessage(
      e,
      "The installation cannot be reached",
    );
    state.value = "unavailable";
  }
}

/**
 * Create the account, then sign in with the same password: the new account
 * has no session until it signs in, and a sign-in owing a second factor
 * continues on the factor page.
 */
async function registerAndSignIn(
  identifier: string,
  password: string,
  extras: RegistrationExtras,
  onProgress?: (p: PasswordOperationProgress) => void,
) {
  await register(identifier, password, extras, onProgress);
  signedIn = await login(identifier, password);
}

async function afterRegistration() {
  if (signedIn) await onLoginSuccess(signedIn);
}

onMounted(() => {
  void prewarm();
  void load();
});
</script>
