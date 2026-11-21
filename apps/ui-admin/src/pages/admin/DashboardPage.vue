<template>
  <q-page padding>
    <div class="text-h4 q-mb-lg">Admin Dashboard</div>

    <div class="row q-col-gutter-md">
      <div
        class="col-12 col-sm-6 col-md-3"
        v-for="stat in stats"
        :key="stat.label"
      >
        <q-card flat bordered>
          <q-card-section>
            <div class="row items-center no-wrap">
              <div class="col">
                <div class="text-caption text-grey">{{ stat.label }}</div>
                <div class="text-h5 text-weight-bold">{{ stat.value }}</div>
              </div>
              <q-icon
                :name="stat.icon"
                size="40px"
                color="primary"
                class="q-ml-md"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Principal Input Demo -->
    <div class="row q-col-gutter-md q-mt-md">
      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6 q-mb-md">Principal Input Demo</div>
            <SidPrincipalInput
              v-model="principal"
              v-model:principal-type="principalType"
            />
            <div class="q-mt-sm text-caption text-grey">
              Detected type:
              <q-badge :color="badgeColor" :label="principalType" />
            </div>
            <div v-if="principal" class="q-mt-xs text-caption text-grey">
              Raw value: <code>{{ principal }}</code>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6">System Health</div>
          </q-card-section>
          <q-card-section class="text-grey">
            Service status and health indicators will appear here.
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { SidPrincipalInput } from "@structured-id/ui-core/quasar";
import type { PrincipalType } from "@structured-id/ui-core/quasar";

const principal = ref("");
const principalType = ref<PrincipalType>("unknown");

const badgeColor = computed(() => {
  switch (principalType.value) {
    case "email":
      return "deep-orange";
    case "phone":
      return "green";
    case "username":
      return "blue";
    default:
      return "grey";
  }
});

const stats = [
  { label: "Users", value: "—", icon: "sym_o_group" },
  { label: "Applications", value: "—", icon: "sym_o_apps" },
  { label: "Active Sessions", value: "—", icon: "sym_o_devices" },
  { label: "Events (24h)", value: "—", icon: "sym_o_history" },
];
</script>
