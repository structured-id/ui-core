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

      <slot name="progress" :step="opaqueStep" :label="opaqueStepLabel">
        <div v-if="opaqueStep" class="q-mb-md">
          <q-linear-progress
            :value="opaqueStep / 3"
            color="primary"
            class="q-mb-sm"
          />
          <div class="text-caption text-center text-grey-7">
            <q-icon name="sym_o_lock" size="xs" class="q-mr-xs" />
            {{ opaqueStepLabel }}
          </div>
        </div>
      </slot>

      <q-form @submit.prevent="onSubmit" class="q-gutter-y-md">
        <sid-principal-input
          v-model="identifier"
          :disable="loading"
          :label="identifierLabel"
          @update:principal-type="principalType = $event"
        />

        <q-input
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          :label="passwordLabel"
          outlined
          :disable="loading"
          :rules="[(v: string) => !!v || passwordRequiredText]"
        >
          <template v-slot:prepend>
            <q-icon name="sym_o_lock" />
          </template>
          <template v-slot:append>
            <q-icon
              :name="showPassword ? 'sym_o_visibility_off' : 'sym_o_visibility'"
              class="cursor-pointer"
              @click="showPassword = !showPassword"
            />
          </template>
        </q-input>

        <slot name="extra-fields" />

        <q-btn
          type="submit"
          :label="submitLabel"
          color="primary"
          class="full-width"
          :loading="loading"
          :disable="!identifier || !password"
        />
      </q-form>

      <slot name="below-form">
        <div v-if="showForgotPassword" class="text-right q-mt-xs">
          <router-link
            v-if="forgotPasswordUrl"
            :to="forgotPasswordUrl"
            class="text-caption text-primary"
          >
            {{ forgotPasswordText }}
          </router-link>
          <a
            v-else
            class="text-caption text-primary cursor-pointer"
            @click="$emit('forgot-password')"
          >
            {{ forgotPasswordText }}
          </a>
        </div>
      </slot>

      <div class="text-caption text-grey-6 text-center q-mt-md">
        <q-icon name="sym_o_shield" size="xs" class="q-mr-xs" />
        {{ securityNotice }}
      </div>

      <slot name="links">
        <div v-if="registerUrl" class="text-center q-mt-md text-body2">
          {{ noAccountText }}
          <router-link :to="registerUrl" class="text-primary">
            {{ registerLinkText }}
          </router-link>
        </div>
      </slot>
    </q-card-section>

    <slot name="footer" />
  </q-card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { SidPrincipalInput } from "../../quasar";
import type { PrincipalType } from "../../quasar";
import { normalizePrincipal } from "../../index";

void SidPrincipalInput;

const props = withDefaults(
  defineProps<{
    /** Card title */
    title?: string;
    /** Card subtitle */
    subtitle?: string;
    /** Submit button label */
    submitLabel?: string;
    /** Identifier input label */
    identifierLabel?: string;
    /** Password input label */
    passwordLabel?: string;
    /** Password required validation text */
    passwordRequiredText?: string;
    /** Show "Forgot password?" link */
    showForgotPassword?: boolean;
    /** Forgot password link text */
    forgotPasswordText?: string;
    /** Forgot password route (if set, renders router-link instead of emitting event) */
    forgotPasswordUrl?: string;
    /** Security disclaimer text */
    securityNotice?: string;
    /** "Don't have an account?" text */
    noAccountText?: string;
    /** "Create one" link text */
    registerLinkText?: string;
    /** Route to registration page (if set, shows register link) */
    registerUrl?: string;
    /** OPAQUE step labels (step 1-3) */
    opaqueStepLabels?: Record<number, string>;
    /** External login function — receives (identifier, password, stepCallback) */
    loginFn: (
      identifier: string,
      password: string,
      onStep?: (step: number) => void,
    ) => Promise<{
      accessToken: string;
      expiresIn: number;
      sessionId?: string;
    }>;
  }>(),
  {
    title: "Sign in",
    subtitle: "Enter your email, phone, or username to continue",
    submitLabel: "Sign in",
    identifierLabel: "Email, phone, or username",
    passwordLabel: "Password",
    passwordRequiredText: "Required",
    showForgotPassword: true,
    forgotPasswordText: "Forgot password?",
    forgotPasswordUrl: undefined,
    securityNotice: "Your password never leaves this device",
    noAccountText: "Don\u2019t have an account?",
    registerLinkText: "Create one",
    registerUrl: undefined,
    opaqueStepLabels: () => ({
      1: "Computing credential request\u2026",
      2: "Verifying with server (password stays local)\u2026",
      3: "Establishing secure session\u2026",
    }),
  },
);

const emit = defineEmits<{
  success: [
    result: { accessToken: string; expiresIn: number; sessionId?: string },
  ];
  error: [error: Error];
  "forgot-password": [];
}>();

const identifier = ref("");
const principalType = ref<PrincipalType>("unknown");
const password = ref("");
const showPassword = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const opaqueStep = ref(0);
const opaqueStepLabel = ref("");

function setStep(step: number) {
  opaqueStep.value = step;
  opaqueStepLabel.value = props.opaqueStepLabels?.[step] || "";
}

async function onSubmit() {
  loading.value = true;
  error.value = null;
  opaqueStep.value = 0;

  try {
    const normalized = normalizePrincipal(identifier.value);
    setStep(1);
    const result = await props.loginFn(
      normalized.value,
      password.value,
      setStep,
    );
    emit("success", result);
  } catch (e) {
    const err = e instanceof Error ? e : new Error("Login failed");
    error.value = err.message;
    emit("error", err);
  } finally {
    loading.value = false;
    opaqueStep.value = 0;
  }
}
</script>
