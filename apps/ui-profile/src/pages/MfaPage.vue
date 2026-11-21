<template>
  <ceremony-frame>
    <q-banner v-if="!pending" class="bg-grey-3" rounded>
      There is no sign-in waiting for a second factor in this tab.
      <template #action>
        <q-btn flat label="Sign in" to="/account/login" />
      </template>
    </q-banner>

    <q-card v-else-if="enrolling" flat bordered>
      <q-card-section>
        <div class="text-h6">Set up an authenticator</div>
        <div class="text-body2 text-grey-7">
          This account needs a second factor before it signs in. Add it to an
          authenticator app, then enter the code it shows.
        </div>
      </q-card-section>
      <q-card-section v-if="keyUri">
        <div class="text-caption text-grey-7">Key</div>
        <code class="text-body1 key">{{ secret }}</code>
        <div class="q-mt-sm">
          <q-btn flat dense no-caps :href="keyUri" label="Open in app" />
        </div>
      </q-card-section>
      <q-card-section v-if="recoveryCodes.length">
        <div class="text-subtitle2">Recovery codes</div>
        <div class="text-body2 text-grey-7">
          Save these codes now. Each signs you in once if you lose the
          authenticator; they are not shown again.
        </div>
        <div class="row q-col-gutter-sm q-mt-sm">
          <code
            v-for="rc in recoveryCodes"
            :key="rc"
            class="col-6 text-body2"
            >{{ rc }}</code
          >
        </div>
        <q-checkbox
          v-model="recoverySaved"
          class="q-mt-sm"
          label="I have saved these codes"
        />
      </q-card-section>
      <q-card-section>
        <q-form @submit="finishEnrollment">
          <q-input
            v-model="code"
            :label="enrolled ? 'Next code from the app' : 'Code from the app'"
            :hint="
              enrolled ? 'Added. Enter the next code to sign in.' : undefined
            "
            inputmode="numeric"
            autocomplete="one-time-code"
            outlined
            :error="!!error"
            :error-message="error ?? undefined"
          />
          <q-btn
            type="submit"
            color="primary"
            class="full-width q-mt-md"
            label="Continue"
            :loading="busy"
            :disable="!code || (recoveryCodes.length > 0 && !recoverySaved)"
          />
        </q-form>
      </q-card-section>
    </q-card>

    <q-banner v-else-if="methods.length === 0" class="bg-grey-3" rounded>
      This account's second factor cannot be used on this page.
      <template #action>
        <q-btn flat label="Sign in again" to="/account/login" />
      </template>
    </q-banner>

    <sid-mfa-challenge
      v-else
      ref="challenge"
      title="Second factor"
      subtitle="Confirm it is you to finish signing in"
      :methods="methods"
      @submit-totp="verify(verifyTotp, $event)"
      @submit-recovery="verify(verifyRecoveryCode, $event)"
    />
  </ceremony-frame>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { StepUpMethod } from "@structured-id/proto/sid/v1/authn/auth";
import {
  SidMfaChallenge,
  finishTotpEnrollment,
  pendingSignIn,
  startTotpEnrollment,
  useLoginSuccess,
  verifyRecoveryCode,
  verifyTotp,
  type MfaMethod,
  type MfaVerifyResult,
} from "@structured-id/ui-core/profile";
import { base32, refusalMessage, totpKeyUri } from "@structured-id/ui-core";
import CeremonyFrame from "src/components/CeremonyFrame.vue";

const pending = pendingSignIn();
const { onLoginSuccess } = useLoginSuccess("/account", {
  issuerOrigin: window.location.origin,
});

/** The factors this page completes a sign-in with, of those the account has. */
const OFFERED: Partial<Record<StepUpMethod, MfaMethod>> = {
  [StepUpMethod.TOTP]: {
    type: "totp",
    icon: "sym_o_timer",
    label: "Authenticator app",
    description: "Enter the code your app shows",
    color: "primary",
    recommended: true,
  },
  [StepUpMethod.RECOVERY_CODE]: {
    type: "recovery",
    icon: "sym_o_vpn_key",
    label: "Recovery code",
    description: "Use one of your saved codes",
    color: "grey-8",
  },
};

const methods = computed<MfaMethod[]>(() =>
  (pending?.secondFactors ?? []).flatMap((m) => OFFERED[m] ?? []),
);

/** The account has no factor yet and may enroll an authenticator first. */
const enrolling = ref(
  !!pending &&
    pending.secondFactors.length === 0 &&
    pending.enrollableFactors.includes(StepUpMethod.TOTP),
);
const enrolled = ref(false);
/** The recovery codes the enrollment returned; the server keeps no plaintext. */
const recoveryCodes = ref<string[]>([]);
const recoverySaved = ref(false);
const keyUri = ref("");
const secret = ref("");
const code = ref("");
const busy = ref(false);
const error = ref<string | null>(null);

const challenge = ref<InstanceType<typeof SidMfaChallenge> | null>(null);

/** Leave for where the sign-in was going once the session exists. */
async function signedIn(result: MfaVerifyResult) {
  if (result.sessionId) await onLoginSuccess({ sessionId: result.sessionId });
}

async function verify(
  check: (code: string) => Promise<MfaVerifyResult>,
  value: string,
) {
  challenge.value?.setLoading(true);
  challenge.value?.setError(null);
  try {
    const result = await check(value);
    challenge.value?.setSuccess();
    await signedIn(result);
  } catch (e) {
    challenge.value?.setError(refusalMessage(e, "The code was not accepted"));
  } finally {
    challenge.value?.setLoading(false);
  }
}

async function beginEnrollment() {
  try {
    const started = await startTotpEnrollment("sign-in");
    keyUri.value = totpKeyUri(started);
    secret.value = base32(started.sharedSecret);
  } catch (e) {
    error.value = refusalMessage(e, "The authenticator cannot be set up");
  }
}

/**
 * The first code enrolls the authenticator; the sign-in then completes with
 * a fresh one, so the same code is never used twice.
 */
async function finishEnrollment() {
  busy.value = true;
  error.value = null;
  try {
    if (!enrolled.value) {
      const done = await finishTotpEnrollment(code.value, "sign-in");
      // A first factor comes with recovery codes, shown this once.
      recoveryCodes.value = done.recoveryCodes;
      enrolled.value = true;
      code.value = "";
      return;
    }
    await signedIn(await verifyTotp(code.value));
  } catch (e) {
    error.value = refusalMessage(e, "The code was not accepted");
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  if (enrolling.value) void beginEnrollment();
});
</script>

<style scoped>
.key {
  word-break: break-all;
}
</style>
