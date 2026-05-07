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
        v-if="inviteRequired && !inviteCode"
        class="bg-warning text-dark q-mb-md"
        rounded
        dense
        icon="sym_o_lock"
      >
        {{ inviteRequiredText }}
      </q-banner>

      <q-banner
        v-if="error"
        class="bg-negative text-white q-mb-md"
        rounded
        dense
      >
        {{ error }}
      </q-banner>

      <q-banner
        v-if="success"
        class="bg-positive text-white q-mb-md"
        rounded
        dense
      >
        {{ successText }}
      </q-banner>

      <q-form @submit.prevent="onSubmit" class="q-gutter-y-md">
        <q-input
          v-if="showInviteField"
          v-model="inviteCode"
          :label="inviteCodeLabel"
          outlined
          :disable="loading || inviteFromUrl"
          maxlength="8"
          mask="XXXXXXXX"
          :rules="
            inviteRequired ? [(v: string) => !!v || inviteCodeRequiredText] : []
          "
          :hint="inviteCodeHint"
        >
          <template v-slot:prepend>
            <q-icon name="sym_o_vpn_key" />
          </template>
          <template v-slot:append>
            <q-chip
              v-if="inviteFromUrl"
              color="positive"
              text-color="white"
              dense
              size="sm"
              icon="sym_o_link"
              :label="inviteFromUrlLabel"
            />
          </template>
        </q-input>

        <sid-principal-input
          v-model="identifier"
          :disable="loading"
          :label="identifierLabel"
          :lazy-rules="false"
          @update:principal-type="principalType = $event"
        />

        <slot name="extra-fields" />

        <q-input
          ref="passwordRef"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          :label="passwordLabel"
          outlined
          :disable="loading"
          :lazy-rules="false"
          :rules="passwordRules"
          @update:model-value="onPasswordInput"
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

        <q-input
          v-if="showConfirmPassword"
          ref="confirmRef"
          v-model="confirmPassword"
          :type="showPassword ? 'text' : 'password'"
          :label="confirmPasswordLabel"
          outlined
          :disable="loading"
          :lazy-rules="false"
          :rules="[
            (v: string) => !!v || passwordRequiredText,
            (v: string) => v === password || passwordsMismatchText,
          ]"
        >
          <template v-slot:prepend>
            <q-icon name="sym_o_lock" />
          </template>
        </q-input>

        <q-btn
          type="submit"
          :label="submitLabel"
          color="primary"
          class="full-width"
          :loading="loading"
          :disable="
            !identifier ||
            !password ||
            (showConfirmPassword && !confirmPassword) ||
            (inviteRequired && !inviteCode)
          "
        />
      </q-form>

      <slot name="links">
        <div v-if="loginUrl" class="text-center q-mt-md text-body2">
          {{ haveAccountText }}
          <router-link :to="loginUrl" class="text-primary">
            {{ loginLinkText }}
          </router-link>
        </div>
      </slot>
    </q-card-section>

    <slot name="footer" />
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { SidPrincipalInput } from "../../quasar";

// Minimal QInput shape — we only use validate(). Avoids importing 'quasar' at
// type level (it's a peer dep, not present during ui-core typecheck).
interface ValidatableInput {
  validate: () => boolean | Promise<boolean>;
}
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
    /** Confirm password input label */
    confirmPasswordLabel?: string;
    /** Password required validation text */
    passwordRequiredText?: string;
    /** Password min length validation text */
    passwordMinLengthText?: string;
    /** Passwords mismatch validation text */
    passwordsMismatchText?: string;
    /** Invite code input label */
    inviteCodeLabel?: string;
    /** Invite code required validation text */
    inviteCodeRequiredText?: string;
    /** Invite code hint text */
    inviteCodeHint?: string;
    /** Invite "from link" chip label */
    inviteFromUrlLabel?: string;
    /** Invite required banner text */
    inviteRequiredText?: string;
    /** Success banner text */
    successText?: string;
    /** "Already have an account?" text */
    haveAccountText?: string;
    /** "Sign in" link text */
    loginLinkText?: string;
    /** Route to login page (if set, shows login link) */
    loginUrl?: string;
    /** Whether invite code is required */
    inviteRequired?: boolean;
    /** Pre-filled invite code (e.g. from URL) */
    initialInviteCode?: string;
    /** External register function — receives (identifier, password, inviteCode?) */
    registerFn: (
      identifier: string,
      password: string,
      inviteCode?: string,
    ) => Promise<void>;
    /** Min password length (default 12 — NIST SP 800-63B 4th draft baseline). */
    passwordMinLength?: number;
    /** Show confirm-password field with match validation. Default true. */
    showConfirmPassword?: boolean;
  }>(),
  {
    title: "Create account",
    subtitle: "Set up your StructuredID account",
    submitLabel: "Create account",
    identifierLabel: "Email, phone, or username",
    passwordLabel: "Password",
    confirmPasswordLabel: "Confirm password",
    passwordRequiredText: "Required",
    passwordMinLengthText: "At least 12 characters with mixed case + digit",
    passwordMinLength: 12,
    passwordsMismatchText: "Passwords do not match",
    inviteCodeLabel: "Invite code",
    inviteCodeRequiredText: "Invite code required",
    inviteCodeHint: "8-character code from your administrator",
    inviteFromUrlLabel: "From link",
    inviteRequiredText:
      "Registration requires an invite code. Contact your administrator for access.",
    successText: "Account created. Signing you in\u2026",
    haveAccountText: "Already have an account?",
    loginLinkText: "Sign in",
    loginUrl: undefined,
    inviteRequired: false,
    initialInviteCode: "",
    showConfirmPassword: true,
  },
);

const emit = defineEmits<{
  success: [data: { identifier: string; principalType: string }];
  error: [error: Error];
}>();

const identifier = ref("");
const principalType = ref<PrincipalType>("unknown");
const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const success = ref(false);

const passwordRef = ref<ValidatableInput | null>(null);
const confirmRef = ref<ValidatableInput | null>(null);

// Password complexity (matches sid-pake-core ZKPP gadget A defaults).
// Server enforces via OPAQUE-ZKPP zero-knowledge proof; client also checks
// to give immediate UX feedback.
const passwordRules = computed(() => [
  (v: string) => !!v || props.passwordRequiredText,
  (v: string) =>
    v.length >= props.passwordMinLength || props.passwordMinLengthText,
  (v: string) => /[a-z]/.test(v) || props.passwordMinLengthText,
  (v: string) => /[A-Z]/.test(v) || props.passwordMinLengthText,
  (v: string) => /[0-9]/.test(v) || props.passwordMinLengthText,
]);

// Re-validate confirm field whenever password changes (eager match feedback).
watch(password, () => {
  if (confirmPassword.value) confirmRef.value?.validate();
});

function onPasswordInput() {
  // Trigger downstream confirm re-validation immediately (don't wait for blur).
  if (confirmPassword.value) confirmRef.value?.validate();
}

const inviteCode = ref(props.initialInviteCode);
const inviteFromUrl = ref(!!props.initialInviteCode);
const showInviteField = computed(
  () => props.inviteRequired || !!inviteCode.value,
);

async function onSubmit() {
  if (props.showConfirmPassword && password.value !== confirmPassword.value) {
    error.value = props.passwordsMismatchText;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const normalized = normalizePrincipal(identifier.value);
    await props.registerFn(
      normalized.value,
      password.value,
      inviteCode.value || undefined,
    );
    success.value = true;
    emit("success", {
      identifier: normalized.value,
      principalType: normalized.type,
    });
  } catch (e) {
    success.value = false;
    const err = e instanceof Error ? e : new Error("Registration failed");
    error.value = err.message;
    emit("error", err);
  } finally {
    loading.value = false;
  }
}
</script>
