<script setup lang="ts">
/**
 * Confirmation dialog component (pure Vue 3, no Quasar).
 *
 * Renders a modal overlay with confirm/cancel actions.
 * Consuming apps can style via CSS custom properties or
 * replace entirely with their own Quasar q-dialog wrapper.
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  }>(),
  {
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    destructive: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [];
  cancel: [];
}>();

function close() {
  emit("update:modelValue", false);
  emit("cancel");
}

function confirm() {
  emit("update:modelValue", false);
  emit("confirm");
}
</script>

<template>
  <Teleport to="body">
    <div v-if="props.modelValue" class="sid-dialog-overlay" @click.self="close">
      <div class="sid-dialog" role="dialog" aria-modal="true">
        <h3 class="sid-dialog__title">{{ props.title }}</h3>
        <p class="sid-dialog__message">{{ props.message }}</p>
        <div class="sid-dialog__actions">
          <button
            class="sid-dialog__btn sid-dialog__btn--cancel"
            @click="close"
          >
            {{ props.cancelLabel }}
          </button>
          <button
            class="sid-dialog__btn"
            :class="
              props.destructive
                ? 'sid-dialog__btn--destructive'
                : 'sid-dialog__btn--confirm'
            "
            @click="confirm"
          >
            {{ props.confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sid-dialog-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
}
.sid-dialog {
  background: var(--sid-dialog-bg, #fff);
  border-radius: 8px;
  padding: 24px;
  min-width: 320px;
  max-width: 480px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}
.sid-dialog__title {
  margin: 0 0 8px;
  font-size: 1.125rem;
  font-weight: 600;
}
.sid-dialog__message {
  margin: 0 0 24px;
  color: var(--sid-dialog-text, #666);
  line-height: 1.5;
}
.sid-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.sid-dialog__btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}
.sid-dialog__btn--cancel {
  background: var(--sid-btn-cancel-bg, #f5f5f5);
  color: var(--sid-btn-cancel-color, #333);
}
.sid-dialog__btn--confirm {
  background: var(--sid-btn-confirm-bg, #1976d2);
  color: var(--sid-btn-confirm-color, #fff);
}
.sid-dialog__btn--destructive {
  background: var(--sid-btn-destructive-bg, #d32f2f);
  color: var(--sid-btn-destructive-color, #fff);
}
</style>
