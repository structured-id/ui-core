<template>
  <q-input
    ref="inputRef"
    v-model="model"
    :label="label"
    :rules="[requiredRule, typeRule]"
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

export type PrincipalType = "email" | "phone" | "username" | "unknown";

interface Props {
  modelValue: string;
  minUsernameLength?: number;
  required?: boolean;
  label?: string;
  /** Validate on each input change (false) vs only on blur (true). Default false — eager. */
  lazyRules?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  // Per arch/identity/identity-model.md §Principal: username regex is
  // ^[a-z0-9_]{3,32}$ (display form ^[a-zA-Z0-9_]{3,32}$).
  minUsernameLength: 3,
  required: true,
  label: "Email, phone, or username",
  lazyRules: false,
});

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

  // Username per arch/identity/identity-model.md:
  // ^[a-z0-9_]{3,32}$, no leading/trailing _, no __
  // Detection is relaxed: accepts uppercase (will normalize), checks min length
  const re = new RegExp(
    `^[a-zA-Z0-9_]{${props.minUsernameLength},${USERNAME_MAX_LENGTH}}$`,
  );
  if (re.test(trimmed) && !trimmed.startsWith("_") && !trimmed.endsWith("_")) {
    return "username";
  }

  // Still typing — not enough chars to determine
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
  !props.required || !!val || "This field is required";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const typeRule = (val: string): string | true => {
  if (!val) return true; // required rule handles empty
  const type = detectType(val);

  switch (type) {
    case "email":
      return emailRegex.test(val) || "Invalid email address";
    case "phone":
      return isValidPhoneNumber(val) || "Invalid phone number";
    case "username": {
      const lower = val.toLowerCase();
      const re = new RegExp(
        `^[a-z0-9_]{${props.minUsernameLength},${USERNAME_MAX_LENGTH}}$`,
      );
      if (!re.test(lower)) return "Invalid username";
      if (lower.startsWith("_") || lower.endsWith("_"))
        return "Username cannot start or end with underscore";
      if (lower.includes("__"))
        return "Username cannot contain consecutive underscores";
      return true;
    }
    default:
      return "Enter email, phone (+...), or username";
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
