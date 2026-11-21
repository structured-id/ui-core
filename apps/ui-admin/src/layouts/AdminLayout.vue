<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-dark text-white">
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="sym_o_menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
          class="lt-md"
        />
        <q-toolbar-title class="text-weight-bold">
          StructuredID
          <span class="text-weight-light text-body2 q-ml-sm">Admin</span>
        </q-toolbar-title>

        <q-space />

        <!-- User menu -->
        <q-btn flat round icon="sym_o_person">
          <q-menu>
            <q-list style="min-width: 200px">
              <q-item-label header class="text-weight-medium">
                {{ displayName || "Administrator" }}
              </q-item-label>
              <q-item v-if="email" dense>
                <q-item-section class="text-caption text-grey">
                  {{ email }}
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item clickable :href="ACCOUNT_PAGES" target="_blank">
                <q-item-section avatar>
                  <q-icon name="sym_o_open_in_new" size="sm" />
                </q-item-section>
                <q-item-section>My Account</q-item-section>
              </q-item>
              <q-separator />
              <q-item clickable @click="handleLogout">
                <q-item-section avatar>
                  <q-icon name="sym_o_logout" size="sm" />
                </q-item-section>
                <q-item-section>Logout</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered class="bg-grey-1">
      <q-list>
        <q-item-label header class="text-weight-medium text-grey-8">
          Administration
        </q-item-label>

        <q-item
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          :exact="link.to === '/'"
          clickable
          v-ripple
          active-class="text-primary bg-blue-1"
        >
          <q-item-section avatar>
            <q-icon :name="link.icon" />
          </q-item-section>
          <q-item-section>{{ link.label }}</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useQuasar } from "quasar";
import { useRoute } from "vue-router";
import { consoleNav, type AdminNavLink } from "#admin/navigation";
import { consoleBase } from "#admin/base";
import { bffLogout } from "@structured-id/ui-core";
import { useAuthStore } from "#admin/stores/auth";

const $q = useQuasar();
const auth = useAuthStore();
const leftDrawerOpen = ref(false);

// The installation's own account pages, served on the same origin.
const ACCOUNT_PAGES = "/account/";

const displayName = computed(() => auth.displayName);
const email = computed(() => auth.email);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

// Ends the session at the console's browser adapter; the console's own
// state is cleared only once the adapter confirms, then sign-in starts again.
async function handleLogout() {
  const result = await bffLogout();
  if (!result.ended) {
    $q.notify({
      type: "negative",
      message: "Sign-out failed; the session may still be active",
    });
    return;
  }
  auth.logout();
  window.location.assign(consoleBase());
}

// The menu the console's route carries: the CE entries, plus those a
// composing application added through `adminRoutes`.
const route = useRoute();
const navLinks = computed<AdminNavLink[]>(
  () =>
    (route.matched.find((r) => r.meta.nav)?.meta.nav as
      AdminNavLink[] | undefined) ?? consoleNav,
);
</script>
