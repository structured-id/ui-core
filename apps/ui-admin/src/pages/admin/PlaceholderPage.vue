<template>
  <q-page padding>
    <div class="text-h4 q-mb-md">{{ pageTitle }}</div>
    <q-banner class="bg-blue-1 text-blue-9" rounded>
      <template v-slot:avatar>
        <q-icon name="sym_o_construction" color="blue" />
      </template>
      This page is under construction. Backend gRPC integration pending.
    </q-banner>
  </q-page>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const pageTitle = computed(() => (route.meta.title as string) || "Admin Page");
</script>
