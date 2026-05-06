<template>
  <div>
    <q-banner v-if="error" class="bg-negative text-white q-mb-md" rounded dense>
      {{ error }}
    </q-banner>

    <div v-if="loading" class="text-center q-pa-lg">
      <q-spinner-dots size="32px" color="primary" />
    </div>

    <q-form
      v-else
      @submit.prevent="$emit('save', formData)"
      class="q-gutter-md"
    >
      <q-input
        v-model="formData.givenName"
        label="Given name"
        outlined
        :disable="saving"
      >
        <template v-slot:prepend>
          <q-icon name="sym_o_badge" />
        </template>
      </q-input>

      <q-input
        v-model="formData.familyName"
        label="Family name"
        outlined
        :disable="saving"
      >
        <template v-slot:prepend>
          <q-icon name="sym_o_badge" />
        </template>
      </q-input>

      <q-input
        v-model="formData.middleName"
        label="Middle name"
        outlined
        :disable="saving"
      >
        <template v-slot:prepend>
          <q-icon name="sym_o_badge" />
        </template>
      </q-input>

      <q-input
        v-if="showAvatar"
        v-model="formData.avatarUrl"
        label="Avatar URL"
        outlined
        :disable="saving"
      >
        <template v-slot:prepend>
          <q-icon name="sym_o_account_circle" />
        </template>
      </q-input>

      <slot name="extra-fields" :form="formData" />

      <q-input
        v-if="username"
        :model-value="username"
        label="Username"
        outlined
        readonly
        disable
      >
        <template v-slot:prepend>
          <q-icon name="sym_o_alternate_email" />
        </template>
      </q-input>

      <q-btn
        type="submit"
        label="Save changes"
        color="primary"
        :loading="saving"
        :disable="!hasChanges"
      />
    </q-form>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from "vue";
import type { Profile } from "../../index";

const props = withDefaults(
  defineProps<{
    profile: Profile | null;
    loading: boolean;
    saving: boolean;
    error: string | null;
    username?: string;
    showAvatar?: boolean;
  }>(),
  {
    username: "",
    showAvatar: true,
  },
);

defineEmits<{
  save: [
    data: {
      givenName: string;
      familyName: string;
      middleName: string;
      avatarUrl: string;
    },
  ];
}>();

const formData = reactive({
  givenName: "",
  familyName: "",
  middleName: "",
  avatarUrl: "",
});

const hasChanges = computed(() => {
  if (!props.profile) return false;
  return (
    formData.givenName !== (props.profile.givenName || "") ||
    formData.familyName !== (props.profile.familyName || "") ||
    formData.middleName !== (props.profile.middleName || "") ||
    formData.avatarUrl !== (props.profile.avatarUrl || "")
  );
});

watch(
  () => props.profile,
  (p) => {
    if (p) {
      formData.givenName = p.givenName || "";
      formData.familyName = p.familyName || "";
      formData.middleName = p.middleName || "";
      formData.avatarUrl = p.avatarUrl || "";
    }
  },
  { immediate: true },
);
</script>
