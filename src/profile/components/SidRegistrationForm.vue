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
        v-if="claimRequired"
        class="bg-info text-white q-mb-md"
        rounded
        dense
        icon="sym_o_admin_panel_settings"
      >
        {{ claimRequiredText }}
      </q-banner>

      <q-banner
        v-if="inviteRequired && !inviteCode && !claimRequired"
        class="bg-warning text-dark q-mb-md"
        rounded
        dense
        icon="sym_o_lock"
      >
        {{ inviteRequiredText }}
      </q-banner>

      <q-banner
        v-if="error && !ceremony"
        class="bg-negative text-white q-mb-md"
        rounded
        dense
      >
        {{ error }}
      </q-banner>

      <q-banner
        v-if="success && !ceremony"
        class="bg-positive text-white q-mb-md"
        rounded
        dense
      >
        {{ successText }}
      </q-banner>

      <!-- While the operation runs the ceremony takes the fields' place;
           an application's own `progress` slot replaces the ceremony. -->
      <template v-if="ceremony">
        <slot name="progress" :progress="progress">
          <sid-password-ceremony
            :progress="progress"
            :outcome="ceremony"
            :fields="showConfirmPassword ? 2 : 1"
            :length="password.length"
            :accepted-text="acceptedText"
            :refused-text="error ?? undefined"
            @settled="onSettled"
          />
        </slot>
      </template>

      <q-form
        v-show="!ceremony && !success"
        @submit.prevent="onSubmit"
        class="q-gutter-y-md"
      >
        <q-input
          v-if="claimRequired"
          v-model="claimToken"
          :type="showClaimToken ? 'text' : 'password'"
          :label="claimTokenLabel"
          :hint="claimTokenHint"
          outlined
          autocomplete="off"
          spellcheck="false"
          :disable="loading"
          :rules="[(v: string) => !!v.trim() || claimTokenRequiredText]"
          data-test="claim-token"
        >
          <template v-slot:prepend>
            <q-icon name="sym_o_key" />
          </template>
          <template v-slot:append>
            <q-icon
              :name="
                showClaimToken ? 'sym_o_visibility_off' : 'sym_o_visibility'
              "
              class="cursor-pointer"
              @click="showClaimToken = !showClaimToken"
            />
          </template>
        </q-input>

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
          :min-username-length="usernameMinLength"
          data-test="principal"
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
          data-test="password"
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
          data-test="confirm-password"
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
            (claimRequired && !claimToken.trim()) ||
            (inviteRequired && !claimRequired && !inviteCode)
          "
          data-test="submit"
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
import { ref, computed, watch, useSlots } from "vue";
import { SidPasswordCeremony, SidPrincipalInput } from "../../quasar";
import type { CeremonyOutcome } from "../../quasar";
import type { PasswordOperationProgress } from "../composables/useAuth";

// Minimal QInput shape — we only use validate(). Avoids importing 'quasar' at
// type level (it's a peer dep, not present during ui-core typecheck).
interface ValidatableInput {
  validate: () => boolean | Promise<boolean>;
}
import type { PrincipalType } from "../../quasar";
import { normalizePrincipal, refusalMessage } from "../../index";

/** What the form collected besides the identifier and password. */
export interface RegistrationExtras {
  /** Invite code, when the enrollment policy asks for one. */
  inviteCode?: string;
  /** Instance claim token from the service log, while the installation has no administrator. */
  claimToken?: string;
}

void SidPrincipalInput;
void SidPasswordCeremony;

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
    /**
     * The installation has no administrator yet (GetInstanceStatus). The form
     * then asks for the claim token and the new account becomes administrator;
     * the invite code is not asked for.
     */
    claimRequired?: boolean;
    /** Claim token input label */
    claimTokenLabel?: string;
    /** Claim token hint text */
    claimTokenHint?: string;
    /** Claim token required validation text */
    claimTokenRequiredText?: string;
    /** Banner shown while the installation waits for its first administrator */
    claimRequiredText?: string;
    /** External register function; `onProgress` drives the progress gauge. */
    registerFn: (
      identifier: string,
      password: string,
      extras: RegistrationExtras,
      onProgress?: (p: PasswordOperationProgress) => void,
    ) => Promise<void>;
    /** What the ceremony says once the account is created. */
    acceptedText?: string;
    /** Min password length (default 12 — NIST SP 800-63B 4th draft baseline). */
    passwordMinLength?: number;
    /** Show confirm-password field with match validation. Default true. */
    showConfirmPassword?: boolean;
    /** Min username length. Registration default 6 (premium feature gating);
     *  login flow can pass 3 since short usernames are valid post-registration. */
    usernameMinLength?: number;
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
    claimRequired: false,
    claimTokenLabel: "Claim token",
    claimTokenHint: "The sidclaim_ token from the service log",
    claimTokenRequiredText: "Claim token required",
    claimRequiredText:
      "This installation has no administrator yet. Enter the claim token from the service log; the account you create becomes its administrator.",
    showConfirmPassword: true,
    usernameMinLength: 6,
    acceptedText: "Account created",
  },
);

const emit = defineEmits<{
  success: [data: { identifier: string; principalType: string }];
  error: [error: Error];
}>();

defineSlots<{
  header?: () => unknown;
  /** Replaces the ceremony while the operation runs; the form closes when it ends. */
  progress?: (props: { progress: PasswordOperationProgress | null }) => unknown;
  "extra-fields"?: () => unknown;
  links?: () => unknown;
  footer?: () => unknown;
}>();
const slots = useSlots();

const identifier = ref("");
const principalType = ref<PrincipalType>("unknown");
const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const success = ref(false);
const progress = ref<PasswordOperationProgress | null>(null);
/** The running or closing ceremony; null while the fields are shown. */
const ceremony = ref<CeremonyOutcome | null>(null);
/** What the form announces once the ceremony has closed. */
let announce: (() => void) | undefined;

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
// While unclaimed the claim token is the only admission, whatever the mode.
const showInviteField = computed(
  () => !props.claimRequired && (props.inviteRequired || !!inviteCode.value),
);

const claimToken = ref("");
const showClaimToken = ref(false);

async function onSubmit() {
  if (props.showConfirmPassword && password.value !== confirmPassword.value) {
    error.value = props.passwordsMismatchText;
    return;
  }

  loading.value = true;
  error.value = null;
  progress.value = null;
  ceremony.value = "running";
  // A phone's keyboard would cover the ceremony.
  (document.activeElement as HTMLElement | null)?.blur?.();

  try {
    const normalized = normalizePrincipal(
      identifier.value,
      props.usernameMinLength,
    );
    const extras: RegistrationExtras = props.claimRequired
      ? { claimToken: claimToken.value.trim() }
      : { inviteCode: inviteCode.value || undefined };
    await props.registerFn(normalized.value, password.value, extras, (p) => {
      progress.value = p;
    });
    announce = () => {
      success.value = true;
      emit("success", {
        identifier: normalized.value,
        principalType: normalized.type,
      });
    };
    ceremony.value = "accepted";
  } catch (e) {
    success.value = false;
    const err = e instanceof Error ? e : new Error("Registration failed");
    error.value = refusalMessage(e, "Registration failed");
    announce = () => emit("error", err);
    ceremony.value = "refused";
  } finally {
    loading.value = false;
  }
  // A `progress` slot has no closing animation to wait for.
  if (slots.progress) onSettled();
}

/**
 * The ceremony closed and gives way: a refusal to the fields with its
 * reason, an acceptance to the success text. Then the result is told.
 */
function onSettled() {
  ceremony.value = null;
  progress.value = null;
  announce?.();
  announce = undefined;
}
</script>
