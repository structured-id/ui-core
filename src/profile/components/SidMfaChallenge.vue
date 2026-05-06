<template>
  <q-card flat bordered>
    <q-card-section>
      <slot name="header">
        <div class="text-h6">{{ title }}</div>
        <div class="text-caption text-grey">{{ subtitle }}</div>
      </slot>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <q-banner
        v-if="error"
        class="bg-negative text-white q-mb-md"
        rounded
        dense
      >
        {{ error }}
      </q-banner>

      <!-- Method selection -->
      <template v-if="phase === 'select'">
        <div class="text-center q-mb-md">
          <q-icon name="sym_o_security" size="48px" color="warning" />
          <div class="text-body2 text-grey-7 q-mt-sm">
            {{ reason || "You need to verify your identity before continuing" }}
          </div>
        </div>

        <div class="text-subtitle2 q-mb-sm">Verify using:</div>

        <q-list separator>
          <q-item
            v-for="method in methods"
            :key="method.type"
            clickable
            v-ripple
            @click="selectMethod(method.type)"
          >
            <q-item-section avatar>
              <q-icon :name="method.icon" :color="method.color" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ method.label }}</q-item-label>
              <q-item-label caption>{{ method.description }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge
                v-if="method.recommended"
                color="positive"
                label="Recommended"
              />
              <q-icon v-else name="sym_o_chevron_right" />
            </q-item-section>
          </q-item>
        </q-list>
      </template>

      <!-- TOTP code entry -->
      <template v-if="phase === 'totp'">
        <q-form @submit.prevent="submitCode('totp')" class="q-gutter-md">
          <q-input
            v-model="totpCode"
            label="Authentication code"
            outlined
            autofocus
            mask="### ###"
            unmasked-value
            :disable="loading"
            :rules="[
              (v: string) => (!!v && v.length === 6) || 'Enter 6-digit code',
            ]"
            input-class="text-center text-h5 letter-spacing-wide"
            inputmode="numeric"
            autocomplete="one-time-code"
          >
            <template v-slot:prepend>
              <q-icon name="sym_o_timer" color="primary" />
            </template>
          </q-input>

          <q-btn
            type="submit"
            label="Verify"
            color="primary"
            class="full-width"
            :loading="loading"
            :disable="!totpCode || totpCode.length < 6"
          />
        </q-form>

        <div class="text-caption text-grey-6 text-center q-mt-md">
          <q-icon name="sym_o_info" size="xs" class="q-mr-xs" />
          Open your authenticator app to find the code
        </div>
      </template>

      <!-- Recovery code entry -->
      <template v-if="phase === 'recovery'">
        <q-form @submit.prevent="submitCode('recovery')" class="q-gutter-md">
          <q-input
            v-model="recoveryCode"
            label="Recovery code"
            outlined
            autofocus
            :disable="loading"
            :rules="[(v: string) => !!v || 'Enter recovery code']"
            input-class="text-center text-h6 font-monospace"
          >
            <template v-slot:prepend>
              <q-icon name="sym_o_key" color="warning" />
            </template>
          </q-input>

          <q-btn
            type="submit"
            label="Verify"
            color="primary"
            class="full-width"
            :loading="loading"
            :disable="!recoveryCode"
          />
        </q-form>

        <div class="text-caption text-grey-6 text-center q-mt-md">
          <q-icon name="sym_o_warning" size="xs" class="q-mr-xs" />
          Recovery codes are single-use
        </div>
      </template>

      <!-- WebAuthn (passkey) -->
      <template v-if="phase === 'webauthn'">
        <div class="text-center q-pa-lg">
          <q-spinner-dots v-if="loading" size="48px" color="primary" />
          <q-icon v-else name="sym_o_passkey" size="48px" color="primary" />
          <div class="text-body2 text-grey-7 q-mt-md">
            {{
              loading
                ? "Waiting for authenticator\u2026"
                : "Use your passkey or security key to verify"
            }}
          </div>
        </div>
      </template>

      <!-- Success -->
      <template v-if="phase === 'success'">
        <div class="text-center q-pa-lg">
          <q-icon name="sym_o_check_circle" size="48px" color="positive" />
          <div class="text-body1 text-positive q-mt-sm">Verified</div>
        </div>
      </template>

      <slot name="below-challenge" :phase="phase" />
    </q-card-section>

    <slot name="footer" />
  </q-card>
</template>

<script setup lang="ts">
import { ref } from "vue";

export interface MfaMethod {
  type: "totp" | "webauthn" | "recovery";
  icon: string;
  label: string;
  description: string;
  color: string;
  recommended?: boolean;
}

type Phase = "select" | "totp" | "webauthn" | "recovery" | "success";

withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    reason?: string;
    methods: MfaMethod[];
  }>(),
  {
    title: "Additional verification required",
    subtitle: "This action requires a higher authentication level",
    reason: "",
  },
);

const emit = defineEmits<{
  "select-method": [method: string];
  "submit-totp": [code: string];
  "submit-recovery": [code: string];
  "submit-webauthn": [];
  verified: [];
}>();

const phase = ref<Phase>("select");
const loading = ref(false);
const error = ref<string | null>(null);
const totpCode = ref("");
const recoveryCode = ref("");

function selectMethod(method: string) {
  error.value = null;
  phase.value = method as Phase;
  emit("select-method", method);
}

function submitCode(method: "totp" | "recovery") {
  if (method === "totp") {
    emit("submit-totp", totpCode.value);
  } else {
    emit("submit-recovery", recoveryCode.value);
  }
}

/** Called by parent to set loading state */
function setLoading(val: boolean) {
  loading.value = val;
}

/** Called by parent to set error */
function setError(msg: string | null) {
  error.value = msg;
}

/** Called by parent to show success */
function setSuccess() {
  phase.value = "success";
  emit("verified");
}

/** Called by parent to reset to method selection */
function reset() {
  phase.value = "select";
  error.value = null;
  totpCode.value = "";
  recoveryCode.value = "";
}

defineExpose({ setLoading, setError, setSuccess, reset, phase });
</script>
