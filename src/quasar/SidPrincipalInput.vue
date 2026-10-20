<template>
  <q-input
    ref="inputRef"
    v-model="model"
    :label="fieldLabel"
    :rules="[requiredRule, typeRule]"
    :error="!!fieldError"
    :error-message="fieldError ?? undefined"
    outlined
    type="text"
    :inputmode="inputMode"
    autocapitalize="none"
    autocomplete="username webauthn"
    spellcheck="false"
    :lazy-rules="lazyRules"
    @update:model-value="onInput"
  >
    <template #prepend>
      <q-icon :name="iconName" :color="iconColor" size="24px" />
    </template>
    <template v-if="model && detectedType !== 'unknown'" #append>
      <q-chip
        dense
        :color="chipColor"
        text-color="white"
        size="sm"
        class="q-px-sm"
      >
        {{ chipLabel }}
      </q-chip>
    </template>
  </q-input>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { isValidPhoneNumber } from "libphonenumber-js";
import { REQUIRED_FIELD_TEXT, isValidEmail } from "../utils/validators";

import {
  ALL_PRINCIPAL_TYPES,
  DEFAULT_PRINCIPAL_INPUT_TEXTS,
  type AcceptedPrincipalType,
  type PrincipalInputTexts,
  type PrincipalType,
} from "./principalInputTexts";

export type { PrincipalType };

interface Props {
  modelValue: string;
  /**
   * The principal types this field accepts; the others are refused before
   * any call, with a text naming the accepted ones. The instance's settings
   * or the scenario decide it (a registration may take email only).
   */
  types?: AcceptedPrincipalType[];
  minUsernameLength?: number;
  required?: boolean;
  /** The label; without one the field names the accepted types. */
  label?: string;
  /** A refusal the server bound to this field, shown on it until edited. */
  fieldError?: string | null;
  /** Replacements for the field's texts. */
  texts?: Partial<PrincipalInputTexts>;
  /** What an empty required field says. */
  requiredText?: string;
  /**
   * Validate once the field is left, then on every change (true), or on
   * every change from the first keystroke (false). Default true: a field
   * being typed into is not yet wrong.
   */
  lazyRules?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  types: () => [...ALL_PRINCIPAL_TYPES],
  // Username rule: ^[a-z0-9_]{3,32}$ (display form ^[a-zA-Z0-9_]{3,32}$).
  minUsernameLength: 3,
  required: true,
  label: undefined,
  fieldError: null,
  texts: () => ({}),
  requiredText: REQUIRED_FIELD_TEXT,
  lazyRules: true,
});

const text = computed<PrincipalInputTexts>(() => ({
  ...DEFAULT_PRINCIPAL_INPUT_TEXTS,
  ...props.texts,
}));

/** The accepted types in their fixed order. */
const accepted = computed(() =>
  ALL_PRINCIPAL_TYPES.filter((t) => props.types.includes(t)),
);

const fieldLabel = computed(
  () => props.label ?? text.value.label(accepted.value),
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:principalType": [type: PrincipalType];
}>();

const inputRef = ref<{ focus: () => void } | null>(null);

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const USERNAME_MAX_LENGTH = 32;

function detectType(value: string): PrincipalType {
  if (!value) return "unknown";
  const trimmed = value.trim();
  if (!trimmed) return "unknown";

  // Phone: starts with +
  if (trimmed.startsWith("+")) return "phone";

  // Email: contains @ (checked after phone to exclude edge cases)
  if (trimmed.includes("@")) return "email";

  // Username by its shape at any length, so that a short one is told the
  // minimum instead of being taken for no type at all. Uppercase is accepted
  // (the server derives the key); length and underscores are the rule's.
  if (/^[a-zA-Z0-9_]+$/.test(trimmed)) return "username";

  return "unknown";
}

const detectedType = computed(() => detectType(model.value));

// Emit type changes
watch(detectedType, (type) => {
  emit("update:principalType", type);
});

function onInput(value: string | number | null) {
  emit("update:principalType", detectType(String(value ?? "")));
}

// --- Validation rules ---

const requiredRule = (val: string) =>
  !props.required || !!val || props.requiredText;

const typeRule = (val: string): string | true => {
  if (!val) return true; // required rule handles empty
  const type = detectType(val);
  if (type === "unknown" || !accepted.value.includes(type)) {
    return text.value.enterAccepted(accepted.value);
  }

  switch (type) {
    case "email":
      return isValidEmail(val.trim()) || text.value.invalidEmail;
    case "phone":
      return isValidPhoneNumber(val) || text.value.invalidPhone;
    case "username": {
      const name = val.trim();
      if (name.length < props.minUsernameLength)
        return text.value.usernameTooShort(props.minUsernameLength);
      if (name.length > USERNAME_MAX_LENGTH)
        return text.value.usernameTooLong(USERNAME_MAX_LENGTH);
      if (name.startsWith("_") || name.endsWith("_"))
        return text.value.usernameUnderscoreEdge;
      if (name.includes("__")) return text.value.usernameDoubleUnderscore;
      return true;
    }
  }
};

// --- Dynamic icon & type ---

const iconName = computed(() => {
  switch (detectedType.value) {
    case "email":
      return "sym_o_mail";
    case "phone":
      return "sym_o_phone";
    case "username":
      return "sym_o_person";
    default:
      return "sym_o_login";
  }
});

const iconColor = computed(() =>
  detectedType.value === "unknown" ? "grey-6" : "primary",
);

// inputmode controls mobile keyboard WITHOUT triggering browser autofill.
// type="text" stays constant — changing type mid-input causes:
// - autofill popup flashing (browser re-evaluates field purpose)
// - cursor/value reset in some browsers
// - mobile keyboard switching mid-keystroke
const inputMode = computed(() => {
  switch (detectedType.value) {
    case "email":
      return "email"; // keyboard with @ key
    case "phone":
      return "tel"; // numeric keyboard
    default:
      return "text";
  }
});

const chipLabel = computed(() => {
  switch (detectedType.value) {
    case "email":
      return "email";
    case "phone":
      return "phone";
    case "username":
      return "username";
    default:
      return "";
  }
});

const chipColor = computed(() => {
  switch (detectedType.value) {
    case "email":
      return "deep-orange";
    case "phone":
      return "green";
    case "username":
      return "blue";
    default:
      return "grey";
  }
});

// --- Public API ---

function focus() {
  inputRef.value?.focus();
}

defineExpose({ focus, detectedType });
</script>
