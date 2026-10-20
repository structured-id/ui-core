<template>
  <q-card flat bordered>
    <q-card-section>
      <slot name="header">
        <div class="text-h6">{{ title }}</div>
        <div class="text-caption text-grey">{{ shownSubtitle }}</div>
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
          :types="principalTypes"
          :texts="principalTexts"
          data-test="principal"
          @update:principal-type="principalType = $event"
        />

        <q-input
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          :label="passwordLabel"
          outlined
          :disable="loading"
          lazy-rules
          :rules="[(v: string) => !!v || passwordRequiredText]"
          data-test="password"
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
          data-test="submit"
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
import { computed, ref } from "vue";
import {
  ALL_PRINCIPAL_TYPES,
  DEFAULT_PRINCIPAL_INPUT_TEXTS,
  SidPrincipalInput,
} from "../../quasar";
import type {
  AcceptedPrincipalType,
  PrincipalInputTexts,
  PrincipalType,
} from "../../quasar";
import { normalizePrincipal, refusalMessage } from "../../index";
import { REQUIRED_FIELD_TEXT } from "../../utils/validators";

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
    /** The principal types this instance signs in with. Default: every type. */
    principalTypes?: AcceptedPrincipalType[];
    /** Replacements for the identifier field's texts. */
    principalTexts?: Partial<PrincipalInputTexts>;
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
    // Without one the subtitle names the accepted types.
    subtitle: undefined,
    submitLabel: "Sign in",
    // Without one the field names the accepted types.
    identifierLabel: undefined,
    principalTypes: () => ["email", "phone", "username"],
    principalTexts: () => ({}),
    passwordLabel: "Password",
    passwordRequiredText: REQUIRED_FIELD_TEXT,
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

const shownSubtitle = computed(
  () =>
    props.subtitle ??
    { ...DEFAULT_PRINCIPAL_INPUT_TEXTS, ...props.principalTexts }.loginSubtitle(
      ALL_PRINCIPAL_TYPES.filter((t) => props.principalTypes.includes(t)),
    ),
);

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
    error.value = refusalMessage(e, "Login failed");
    emit("error", err);
  } finally {
    loading.value = false;
    opaqueStep.value = 0;
  }
}
</script>
