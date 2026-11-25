<template>
  <q-separator />
  <q-card-section class="q-gutter-y-sm">
    <div class="text-caption text-grey-7 text-center">Or sign in with</div>
    <q-btn
      v-for="connection in connections"
      :key="connection.handle"
      :label="connection.name"
      outline
      no-caps
      color="primary"
      class="full-width"
      :loading="leaving === connection.handle"
      :disable="leaving !== null"
      data-test="sign-in-connection"
      @click="$emit('choose', connection.handle)"
    />
  </q-card-section>
</template>

<script setup lang="ts">
/**
 * The installation's registered sign-in connections, one button each by its
 * name; choosing one gives its handle. The same block under the sign-in
 * form and under the card that waits for the installation's offer.
 */
import type { SignInConnection } from "@structured-id/ui-core/profile";

defineProps<{
  connections: SignInConnection[];
  /** The handle of the connection the browser is leaving through. */
  leaving: string | null;
}>();

defineEmits<{ choose: [handle: string] }>();
</script>
