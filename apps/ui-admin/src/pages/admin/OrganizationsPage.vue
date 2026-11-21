<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5">Organization</div>
      <q-space />
      <q-badge
        v-if="store.siteInfo"
        color="grey-7"
        :label="store.siteInfo.edition"
        class="text-weight-bold"
      />
    </div>

    <!-- Loading -->
    <template v-if="store.loading && !store.siteInfo">
      <q-card flat bordered>
        <q-card-section>
          <q-skeleton type="text" width="40%" />
          <q-skeleton type="text" width="60%" class="q-mt-sm" />
          <q-skeleton type="text" width="30%" class="q-mt-sm" />
        </q-card-section>
      </q-card>
    </template>

    <template v-if="store.siteInfo">
      <!-- Site Info Card -->
      <q-card flat bordered class="q-mb-md">
        <q-card-section>
          <div class="text-subtitle1 text-weight-medium q-mb-md">
            Site Summary
          </div>

          <q-list>
            <q-item>
              <q-item-section avatar>
                <q-icon name="sym_o_business" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption>Site Name</q-item-label>
                <q-item-label class="text-weight-medium">
                  {{ store.siteInfo.siteName }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn flat dense icon="sym_o_edit" @click="openEditName" />
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section avatar>
                <q-icon name="sym_o_info" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption>Version</q-item-label>
                <q-item-label>{{ store.siteInfo.version }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section avatar>
                <q-icon name="sym_o_dns" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption>Primary Domain</q-item-label>
                <q-item-label>
                  {{ store.siteInfo.primaryDomain || "Not configured" }}
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section avatar>
                <q-icon name="sym_o_contact_mail" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption>Admin Contact</q-item-label>
                <q-item-label>
                  {{ store.siteInfo.adminContact || "Not set" }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>

      <!-- Quick Stats -->
      <div class="row q-col-gutter-md q-mb-md">
        <div
          v-for="stat in statCards"
          :key="stat.label"
          class="col-12 col-sm-6 col-md-3"
        >
          <q-card flat bordered>
            <q-card-section class="text-center">
              <q-icon :name="stat.icon" size="32px" :color="stat.color" />
              <div class="text-h4 text-weight-bold q-mt-sm">
                {{ formatNumber(stat.value) }}
              </div>
              <div class="text-caption text-grey-7">{{ stat.label }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Quick Links -->
      <q-card flat bordered>
        <q-card-section>
          <div class="text-subtitle1 text-weight-medium q-mb-sm">
            Quick Links
          </div>
          <div class="row q-gutter-sm">
            <q-btn
              outline
              no-caps
              icon="sym_o_settings"
              label="Settings"
              to="/admin/settings"
            />
            <q-btn
              outline
              no-caps
              icon="sym_o_group"
              label="Users"
              to="/admin/users"
            />
            <q-btn
              outline
              no-caps
              icon="sym_o_apps"
              label="Applications"
              to="/admin/applications"
            />
          </div>
        </q-card-section>
      </q-card>
    </template>

    <!-- Edit Site Name Dialog -->
    <q-dialog v-model="editNameDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Edit Site Name</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="editName"
            label="Site Name"
            outlined
            dense
            autofocus
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            unelevated
            color="primary"
            label="Save"
            :loading="store.saving"
            @click="saveName"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Error banner -->
    <q-banner v-if="store.error" class="bg-negative text-white q-mt-md" rounded>
      <template #avatar>
        <q-icon name="sym_o_error" />
      </template>
      {{ store.error }}
    </q-banner>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useOrganizationsStore } from "#admin/stores/organizations";

const store = useOrganizationsStore();

const editNameDialog = ref(false);
const editName = ref("");

const statCards = computed(() => {
  const stats = store.siteInfo?.stats;
  if (!stats) return [];
  return [
    {
      label: "Total Users",
      value: Number(stats.totalUsers),
      icon: "sym_o_group",
      color: "primary",
    },
    {
      label: "Active Sessions",
      value: Number(stats.activeSessions),
      icon: "sym_o_devices",
      color: "positive",
    },
    {
      label: "Applications",
      value: Number(stats.applicationsCount),
      icon: "sym_o_apps",
      color: "info",
    },
    {
      label: "External Users",
      value: Number(stats.externalUsers),
      icon: "sym_o_public",
      color: "warning",
    },
  ];
});

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function openEditName() {
  editName.value = store.siteInfo?.siteName ?? "";
  editNameDialog.value = true;
}

async function saveName() {
  await store.updateSiteName(editName.value);
  if (!store.error) {
    editNameDialog.value = false;
  }
}

onMounted(() => {
  store.fetchSiteInfo();
});
</script>
