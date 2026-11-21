<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <q-page class="flex flex-center q-pa-md bg-grey-2">
        <div class="ceremony">
          <slot />
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
// The frame of every public ceremony page: one centered column.
</script>

<style scoped>
.ceremony {
  width: 100%;
  max-width: 440px;
}
</style>
