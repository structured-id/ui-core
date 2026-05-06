<script setup lang="ts">
/**
 * Avatar component with image, initials fallback, and size variants.
 *
 * Pure Vue 3, no Quasar dependency. Consuming apps can override
 * styles via CSS custom properties.
 */
import { computed } from "vue";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const props = withDefaults(
  defineProps<{
    /** Image URL (optional — falls back to initials). */
    src?: string | null;
    /** Display name for initials fallback. */
    name?: string;
    /** Size variant. */
    size?: AvatarSize;
  }>(),
  {
    src: null,
    name: "",
    size: "md",
  },
);

const sizeMap: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const fontSizeMap: Record<AvatarSize, string> = {
  xs: "0.625rem",
  sm: "0.75rem",
  md: "0.875rem",
  lg: "1.25rem",
  xl: "1.75rem",
};

const initials = computed(() => {
  if (!props.name) return "?";
  const parts = props.name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
});

/** Deterministic color from name string. */
const bgColor = computed(() => {
  if (!props.name) return "var(--sid-avatar-bg, #9e9e9e)";
  let hash = 0;
  for (const ch of props.name) {
    hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 55%)`;
});

const dimension = computed(() => `${sizeMap[props.size]}px`);
const fontSize = computed(() => fontSizeMap[props.size]);
</script>

<template>
  <span
    class="sid-avatar"
    :style="{
      width: dimension,
      height: dimension,
      fontSize: fontSize,
      backgroundColor: src ? 'transparent' : bgColor,
    }"
  >
    <img
      v-if="src"
      :src="src"
      :alt="name || 'Avatar'"
      class="sid-avatar__img"
    />
    <span v-else class="sid-avatar__initials">{{ initials }}</span>
  </span>
</template>

<style scoped>
.sid-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  user-select: none;
}
.sid-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sid-avatar__initials {
  color: var(--sid-avatar-text, #fff);
  font-weight: 500;
  line-height: 1;
}
</style>
