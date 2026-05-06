<template>
  <div>
    <q-banner v-if="error" class="bg-negative text-white q-mb-md" rounded dense>
      {{ error }}
    </q-banner>

    <div v-if="loading" class="text-center q-pa-lg">
      <q-spinner-dots size="32px" color="primary" />
    </div>

    <div
      v-else-if="consents.length === 0"
      class="text-center text-grey q-pa-lg"
    >
      No connected applications
    </div>

    <div v-else class="row q-gutter-md">
      <div
        v-for="consent in consents"
        :key="consent.siteId"
        class="col-12 col-sm-6 col-md-4"
      >
        <q-card flat bordered>
          <q-card-section class="row items-center q-gutter-sm">
            <q-avatar size="32px" color="grey-3">
              <img
                v-if="consent.siteFavicon"
                :src="consent.siteFavicon"
                :alt="consent.siteName"
              />
              <q-icon v-else name="sym_o_language" color="grey" />
            </q-avatar>
            <div class="col">
              <div class="text-subtitle2">{{ consent.siteName }}</div>
              <div class="text-caption text-grey">
                Connected {{ formatDate(consent.connectedAt) }}
              </div>
            </div>
            <q-badge
              :color="consent.status === activeStatus ? 'positive' : 'grey'"
              :label="consent.status === activeStatus ? 'Active' : 'Inactive'"
            />
          </q-card-section>
          <q-separator />
          <q-card-actions align="right">
            <q-btn
              flat
              dense
              label="Details"
              color="primary"
              @click="$emit('view-detail', consent.siteId)"
            />
            <q-btn
              flat
              dense
              label="Disconnect"
              color="negative"
              @click="$emit('disconnect', consent.siteId)"
            />
          </q-card-actions>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type ConsentInfo, ConsentStatus, Timestamp } from "../../index";

defineProps<{
  consents: ConsentInfo[];
  loading: boolean;
  error: string | null;
}>();

defineEmits<{
  "view-detail": [siteId: string];
  disconnect: [siteId: string];
}>();

const activeStatus = ConsentStatus.ACTIVE;

function formatDate(ts?: { seconds: bigint; nanos: number }): string {
  if (!ts) return "";
  return Timestamp.toDate(ts).toLocaleDateString();
}
</script>
