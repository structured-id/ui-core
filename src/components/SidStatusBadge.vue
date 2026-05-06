<script setup lang="ts">
/**
 * Status badge component with semantic colors.
 *
 * Framework-agnostic (pure Vue 3, no Quasar dependency).
 * Consuming apps can override styles via CSS custom properties.
 */

export type BadgeVariant =
  | "active"
  | "inactive"
  | "pending"
  | "error"
  | "warning";

const props = withDefaults(
  defineProps<{
    label: string;
    variant?: BadgeVariant;
  }>(),
  {
    variant: "active",
  },
);

const variantClasses: Record<BadgeVariant, string> = {
  active: "sid-badge--active",
  inactive: "sid-badge--inactive",
  pending: "sid-badge--pending",
  error: "sid-badge--error",
  warning: "sid-badge--warning",
};
</script>

<template>
  <span class="sid-badge" :class="variantClasses[props.variant]">
    {{ props.label }}
  </span>
</template>

<style scoped>
.sid-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.5;
}
.sid-badge--active {
  background: var(--sid-badge-active-bg, #e8f5e9);
  color: var(--sid-badge-active-color, #2e7d32);
}
.sid-badge--inactive {
  background: var(--sid-badge-inactive-bg, #f5f5f5);
  color: var(--sid-badge-inactive-color, #757575);
}
.sid-badge--pending {
  background: var(--sid-badge-pending-bg, #fff3e0);
  color: var(--sid-badge-pending-color, #e65100);
}
.sid-badge--error {
  background: var(--sid-badge-error-bg, #ffebee);
  color: var(--sid-badge-error-color, #c62828);
}
.sid-badge--warning {
  background: var(--sid-badge-warning-bg, #fff8e1);
  color: var(--sid-badge-warning-color, #f57f17);
}
</style>
