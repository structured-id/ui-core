<template>
  <q-input
    ref="inputRef"
    v-model="model"
    :label="fieldLabel"
    :rules="[typeRule]"
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
    <template v-if="showChip" #append>
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
import { isValidEmail } from "../utils/validators";

import {
  ALL_PRINCIPAL_TYPES,
  DEFAULT_PRINCIPAL_INPUT_TEXTS,
  principalRecognizable,
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
  /** The label; without one the field names the accepted types. */
  label?: string;
  /** A refusal the server bound to this field, shown on it until edited. */
  fieldError?: string | null;
  /** Replacements for the field's texts. */
  texts?: Partial<PrincipalInputTexts>;
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
  // Code points of the NFC display form; the server's minimum decides.
  minUsernameLength: 3,
  label: undefined,
  fieldError: null,
  texts: () => ({}),
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

/**
 * A field of one type is named by it; a field of several is a login field
 * until its input is recognized as one of the accepted types.
 */
const fieldLabel = computed(() => {
  // An empty label is the form's own choice; only an absent one is derived.
  if (props.label != null) return props.label;
  const [only, ...others] = accepted.value;
  if (only && others.length === 0) return text.value.label([only]);
  const type = detectedType.value;
  return type !== "unknown" && accepted.value.includes(type)
    ? text.value.label([type])
    : text.value.login;
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:principalType": [type: PrincipalType];
  /** Whether the value can be submitted: a recognized, accepted, well-formed principal. */
  "update:valid": [valid: boolean];
}>();

const inputRef = ref<{ focus: () => void } | null>(null);

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const USERNAME_MAX_LENGTH = 32;

/** What a username may hold: letters of any script, marks, digits, `_`. */
const USERNAME_SHAPE = /^[\p{L}\p{M}\p{N}_]+$/u;

function detectType(value: string): PrincipalType {
  // One or two characters are nobody yet: no type is read from them.
  if (!principalRecognizable(value)) return "unknown";
  const trimmed = value.trim();

  // Phone: starts with +
  if (trimmed.startsWith("+")) return "phone";

  // Email: contains @ (checked after phone to exclude edge cases)
  if (trimmed.includes("@")) return "email";

  // Anything else is a username attempt, whatever it holds, so that what is
  // wrong with it (spaces, a dot, a symbol, its length) can be said.
  return "username";
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

/**
 * Until a type is recognized nothing is wrong yet, an empty field included:
 * the form keeps its button disabled instead (see principalRecognizable).
 */
const typeRule = (val: string): string | true => {
  const type = detectType(val);
  if (type === "unknown") return true;
  if (!accepted.value.includes(type)) {
    return text.value.enterAccepted(accepted.value);
  }

  switch (type) {
    case "email":
      return isValidEmail(val.trim()) || text.value.invalidEmail;
    case "phone":
      return isValidPhoneNumber(val) || text.value.invalidPhone;
    case "username": {
      const name = val;
      if (/\s/u.test(name)) return text.value.usernameSpaces;
      if (!USERNAME_SHAPE.test(name)) return text.value.usernameCharacters;
      // Counted in code points of the NFC form, as the server counts the
      // display; the value itself is sent unchanged.
      const length = [...name.normalize("NFC")].length;
      if (length < props.minUsernameLength)
        return text.value.usernameTooShort(props.minUsernameLength);
      if (length > USERNAME_MAX_LENGTH)
        return text.value.usernameTooLong(USERNAME_MAX_LENGTH);
      if (name.startsWith("_") || name.endsWith("_"))
        return text.value.usernameUnderscoreEdge;
      if (name.includes("__")) return text.value.usernameDoubleUnderscore;
      return true;
    }
  }
};

/**
 * A form keeps its submit disabled until this holds, silently: the error a
 * rule names appears only once the field is left, the button never waits for
 * it. A refusal the server bound to the field holds until the value changes.
 */
const valid = computed(
  () =>
    detectedType.value !== "unknown" &&
    typeRule(model.value) === true &&
    !props.fieldError,
);

watch(valid, (v) => emit("update:valid", v), { immediate: true });

// --- Dynamic icon & type ---

/** The recognized type when the field accepts it; refused types look neutral. */
const shownType = computed<PrincipalType>(() => {
  const type = detectedType.value;
  return type !== "unknown" && accepted.value.includes(type) ? type : "unknown";
});

/**
 * The chip names the type only when the label does not: a derived label
 * already says "Email" or "Username".
 */
const showChip = computed(
  () => props.label != null && shownType.value !== "unknown",
);

/** A field of one type shows that type's icon from the start, greyed until recognized. */
const iconType = computed<PrincipalType>(() => {
  const [only, ...others] = accepted.value;
  return shownType.value === "unknown" && only && others.length === 0
    ? only
    : shownType.value;
});

const iconName = computed(() => {
  switch (iconType.value) {
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
  shownType.value === "unknown" ? "grey-6" : "primary",
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

const chipLabel = computed(() =>
  shownType.value === "unknown" ? "" : text.value.typeChip(shownType.value),
);

const chipColor = computed(() => {
  switch (shownType.value) {
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

defineExpose({ focus, detectedType, valid });
</script>
