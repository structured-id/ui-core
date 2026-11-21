<template>
  <q-layout view="hHh lpR fFf">
    <q-header bordered class="bg-white text-grey-9">
      <q-toolbar>
        <q-toolbar-title class="text-weight-medium">Account</q-toolbar-title>
        <div class="text-body2 q-mr-md gt-xs">{{ auth.displayName }}</div>
        <q-btn
          flat
          round
          icon="sym_o_logout"
          aria-label="Sign out"
          :loading="signingOut"
          @click="signOut"
        />
      </q-toolbar>
      <q-tabs align="left" no-caps active-color="primary" class="text-grey-8">
        <q-route-tab to="/account" exact label="Profile" />
        <q-route-tab to="/account/security" label="Security" />
        <q-route-tab to="/account/sessions" label="Sessions" />
        <q-route-tab to="/account/consents" label="Connected apps" />
      </q-tabs>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useQuasar } from "quasar";
import { bffLogout, useAuthStore } from "@structured-id/ui-core";

const $q = useQuasar();
const auth = useAuthStore();
const signingOut = ref(false);

/**
 * Ends the account session at its adapter; local state is cleared only once
 * the adapter confirms, then the sign-in page opens.
 */
async function signOut() {
  signingOut.value = true;
  const result = await bffLogout();
  signingOut.value = false;
  if (!result.ended) {
    $q.notify({
      type: "negative",
      message: "Sign-out failed; the session may still be active",
    });
    return;
  }
  auth.logout();
  window.location.assign("/account/login");
}
</script>
