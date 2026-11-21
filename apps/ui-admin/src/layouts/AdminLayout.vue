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
import { useAuthStore } from "src/stores/auth";

const auth = useAuthStore();
const leftDrawerOpen = ref(false);

// The installation's own account pages, served on the same origin.
const ACCOUNT_PAGES = "/account/";

const displayName = computed(() => auth.displayName);
const email = computed(() => auth.email);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

function handleLogout() {
  auth.logout();
  // TODO: redirect to sid-auth logout endpoint
}

const navLinks = [
  { to: "/admin", icon: "sym_o_dashboard", label: "Dashboard" },
  {
    to: "/admin/applications",
    icon: "sym_o_apps",
    label: "Applications",
  },
  { to: "/admin/users", icon: "sym_o_group", label: "Users" },
  {
    to: "/admin/access-overview",
    icon: "sym_o_assignment_ind",
    label: "Access Overview",
  },
  {
    to: "/admin/roles",
    icon: "sym_o_admin_panel_settings",
    label: "Roles & Permissions",
  },
  {
    to: "/admin/profile-schema",
    icon: "sym_o_schema",
    label: "Profile Schema",
  },
  { to: "/admin/groups", icon: "sym_o_workspaces", label: "Groups" },
  { to: "/admin/sessions", icon: "sym_o_devices", label: "Sessions" },
  { to: "/admin/devices", icon: "sym_o_phone_android", label: "Devices" },
  {
    to: "/admin/identity-providers",
    icon: "sym_o_login",
    label: "Identity Providers",
  },
  {
    to: "/admin/service-accounts",
    icon: "sym_o_smart_toy",
    label: "Service Accounts",
  },
  {
    to: "/admin/flows",
    icon: "sym_o_account_tree",
    label: "Auth Flows",
  },
  {
    to: "/admin/scopes",
    icon: "sym_o_verified_user",
    label: "Scopes & Claims",
  },
  {
    to: "/admin/scim",
    icon: "sym_o_sync",
    label: "SCIM Provisioning",
  },
  {
    to: "/admin/branding",
    icon: "sym_o_palette",
    label: "Branding",
  },
  {
    to: "/admin/headless-api",
    icon: "sym_o_api",
    label: "Headless API",
  },
  {
    to: "/admin/notification-templates",
    icon: "sym_o_mail",
    label: "Notification Templates",
  },
  {
    to: "/admin/webhooks",
    icon: "sym_o_webhook",
    label: "Webhooks & Events",
  },
  {
    to: "/admin/admin-roles",
    icon: "sym_o_shield_person",
    label: "Admin Roles",
  },
  {
    to: "/admin/enrollment",
    icon: "sym_o_how_to_reg",
    label: "Enrollment Policy",
  },
  {
    to: "/admin/security",
    icon: "sym_o_security",
    label: "Security Policies",
  },
  {
    to: "/admin/migration",
    icon: "sym_o_move_down",
    label: "Blueprints & Migration",
  },
  {
    to: "/admin/operations",
    icon: "sym_o_manufacturing",
    label: "Instance Operations",
  },
  {
    to: "/admin/organization",
    icon: "sym_o_domain",
    label: "Organization",
  },
  {
    to: "/admin/analytics",
    icon: "sym_o_analytics",
    label: "Analytics",
  },
  { to: "/admin/events", icon: "sym_o_history", label: "Events & Audit" },
  { to: "/admin/settings", icon: "sym_o_settings", label: "Settings" },
];
</script>
