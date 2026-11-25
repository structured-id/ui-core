<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">{{ title }}</div>
    </q-card-section>

    <q-separator />

    <q-card-section v-if="failed" data-test="sign-in-offer-failed">
      <q-banner class="bg-grey-2" rounded dense>
        {{ failedText }}
        <template #action>
          <q-btn
            flat
            color="primary"
            :label="retryLabel"
            data-test="sign-in-offer-retry"
            @click="$emit('retry')"
          />
        </template>
      </q-banner>
    </q-card-section>
    <q-card-section
      v-else
      class="q-gutter-y-md"
      data-test="sign-in-offer-loading"
    >
      <q-skeleton type="QInput" />
      <q-skeleton type="QInput" />
      <q-skeleton type="QBtn" class="full-width" />
    </q-card-section>

    <slot name="footer" />
  </q-card>
</template>

<script setup lang="ts">
/**
 * The sign-in card while the page does not know what its issuer offers:
 * placeholders until the issuer answers, and the failure with a retry when
 * it does not. It holds no sign-in form: a method is shown only once the
 * issuer stated it. The `footer` slot carries the ways confirmed on their
 * own, as the sign-in form's does.
 */
withDefaults(
  defineProps<{
    /** The issuer did not answer; otherwise the answer is awaited. */
    failed?: boolean;
    /** Card title, as the sign-in form's. */
    title?: string;
    /** What the card says when the issuer did not answer. */
    failedText?: string;
    /** The retry button's label. */
    retryLabel?: string;
  }>(),
  {
    failed: false,
    title: "Sign in",
    failedText: "The sign-in options could not be loaded.",
    retryLabel: "Try again",
  },
);

defineEmits<{ retry: [] }>();
</script>
