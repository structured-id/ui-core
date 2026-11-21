<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h4">Enrollment Policy</div>
        <div class="text-caption text-grey">
          Control who can register, manage invite codes, and track registration
          sources
        </div>
      </div>
    </div>

    <q-linear-progress
      v-if="store.loading"
      indeterminate
      color="primary"
      class="q-mb-md"
    />

    <q-banner v-if="store.error" dense class="bg-negative text-white q-mb-md">
      {{ store.error }}
    </q-banner>

    <!-- Tabs -->
    <q-tabs v-model="tab" dense align="left" class="q-mb-lg" no-caps>
      <q-tab name="policy" label="Policy" icon="sym_o_policy" />
      <q-tab name="invites" label="Invite Codes" icon="sym_o_mail" />
      <q-tab
        name="analytics"
        label="Registration Analytics"
        icon="sym_o_bar_chart"
      />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <!-- ═══════ Policy Tab ═══════ -->
      <q-tab-panel name="policy">
        <div class="row q-col-gutter-lg">
          <!-- Enrollment Mode -->
          <div class="col-12 col-md-8">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-h6 q-mb-md">Registration Mode</div>

                <q-option-group
                  v-model="editMode"
                  :options="modeOptions"
                  type="radio"
                  class="q-gutter-sm"
                >
                  <template #label="opt">
                    <div class="row items-center no-wrap q-ml-sm">
                      <q-icon
                        :name="enrollmentModeIcon(opt.value)"
                        size="sm"
                        class="q-mr-sm"
                      />
                      <div>
                        <div class="text-weight-medium">
                          {{ enrollmentModeLabel(opt.value) }}
                        </div>
                        <div class="text-caption text-grey">
                          {{ enrollmentModeDescription(opt.value) }}
                        </div>
                      </div>
                    </div>
                  </template>
                </q-option-group>
              </q-card-section>
            </q-card>

            <!-- Domain Restriction (visible when mode = DOMAIN_RESTRICTED) -->
            <q-card
              v-if="editMode === EnrollmentMode.DOMAIN_RESTRICTED"
              flat
              bordered
              class="q-mt-md"
            >
              <q-card-section>
                <div class="text-h6 q-mb-md">Allowed Domains</div>
                <div class="text-caption text-grey q-mb-md">
                  Only users with email addresses in these domains can
                  self-register.
                </div>

                <div
                  v-for="(domain, idx) in editDomains"
                  :key="idx"
                  class="row items-center q-mb-sm"
                >
                  <q-chip
                    :label="domain"
                    removable
                    color="primary"
                    text-color="white"
                    @remove="editDomains.splice(idx, 1)"
                  />
                </div>

                <div class="row items-center q-gutter-sm q-mt-sm">
                  <q-input
                    v-model="newDomain"
                    dense
                    outlined
                    placeholder="acme.corp"
                    class="col"
                    @keyup.enter="addDomain"
                  />
                  <q-btn
                    flat
                    icon="sym_o_add"
                    label="Add"
                    color="primary"
                    :disable="!newDomain.trim()"
                    @click="addDomain"
                  />
                </div>
              </q-card-section>
            </q-card>

            <!-- Invite Config (visible when mode = INVITE_ONLY) -->
            <q-card
              v-if="editMode === EnrollmentMode.INVITE_ONLY"
              flat
              bordered
              class="q-mt-md"
            >
              <q-card-section>
                <div class="text-h6 q-mb-md">Invite Defaults</div>

                <div class="row q-col-gutter-md">
                  <div class="col-12 col-sm-6">
                    <q-input
                      v-model.number="editInviteConfig.defaultMaxUses"
                      type="number"
                      label="Default max uses per code"
                      outlined
                      dense
                      :min="0"
                      hint="0 = unlimited"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <q-input
                      v-model.number="editInviteConfig.defaultExpiryHours"
                      type="number"
                      label="Default expiry (hours)"
                      outlined
                      dense
                      :min="0"
                      hint="0 = no expiry"
                    />
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Right sidebar: tracking + save -->
          <div class="col-12 col-md-4">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-h6 q-mb-md">Source Tracking</div>
                <q-toggle
                  v-model="editTrackSource"
                  label="Track registration sources"
                  color="primary"
                />
                <div class="text-caption text-grey q-mt-xs">
                  Records how each profile was created (self-signup, invite,
                  admin, SCIM, federation).
                </div>
              </q-card-section>
            </q-card>

            <q-btn
              class="full-width q-mt-md"
              color="primary"
              label="Save Policy"
              icon="sym_o_save"
              unelevated
              :loading="store.loading"
              @click="savePolicy"
            />

            <!-- Current status -->
            <q-card flat bordered class="q-mt-md">
              <q-card-section>
                <div class="text-subtitle2 q-mb-sm">Current Status</div>
                <div class="row items-center q-mb-xs">
                  <q-icon
                    :name="enrollmentModeIcon(currentMode)"
                    :color="enrollmentModeColor(currentMode)"
                    size="sm"
                    class="q-mr-sm"
                  />
                  <q-badge
                    :color="enrollmentModeColor(currentMode)"
                    :label="enrollmentModeLabel(currentMode)"
                  />
                </div>
                <div class="text-caption text-grey">
                  {{ enrollmentModeDescription(currentMode) }}
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </q-tab-panel>

      <!-- ═══════ Invites Tab ═══════ -->
      <q-tab-panel name="invites">
        <!-- Toolbar -->
        <div class="row items-center q-mb-md q-gutter-sm">
          <q-btn
            unelevated
            color="primary"
            icon="sym_o_add"
            label="Create Invite"
            @click="showCreateInviteDialog = true"
          />
          <q-btn
            outline
            color="primary"
            icon="sym_o_content_copy"
            label="Bulk Generate"
            @click="showBulkDialog = true"
          />
          <q-space />
          <q-select
            v-model="inviteStatusFilter"
            :options="inviteStatusOptions"
            dense
            outlined
            emit-value
            map-options
            label="Status"
            style="min-width: 150px"
            clearable
            @update:model-value="
              store.fetchInvites(inviteStatusFilter ?? undefined)
            "
          />
          <q-input
            v-model="inviteSearch"
            dense
            outlined
            placeholder="Search codes..."
            class="q-ml-sm"
            style="min-width: 200px"
            @keyup.enter="
              store.fetchInvites(inviteStatusFilter ?? undefined, inviteSearch)
            "
          >
            <template #append>
              <q-icon name="sym_o_search" />
            </template>
          </q-input>
        </div>

        <!-- Invites Table -->
        <q-table
          :rows="store.invites"
          :columns="inviteColumns"
          :row-key="(i: Invite) => shown(i.id)"
          flat
          bordered
          :loading="store.loading"
          :rows-per-page-options="[10, 25, 50]"
        >
          <template #body-cell-code="props">
            <q-td :props="props">
              <code class="text-weight-bold">{{ props.row.code }}</code>
              <q-btn
                flat
                dense
                round
                size="xs"
                icon="sym_o_content_copy"
                class="q-ml-xs"
                @click="copyToClipboard(props.row.code)"
              >
                <q-tooltip>Copy code</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                size="xs"
                icon="sym_o_link"
                class="q-ml-xs"
                @click="copyInviteLink(props.row.code)"
              >
                <q-tooltip>Copy invite link</q-tooltip>
              </q-btn>
            </q-td>
          </template>

          <template #body-cell-uses="props">
            <q-td :props="props">
              {{ props.row.useCount }} /
              {{ props.row.maxUses === 0 ? "∞" : props.row.maxUses }}
            </q-td>
          </template>

          <template #body-cell-expiresAt="props">
            <q-td :props="props">
              {{
                props.row.expiresAt
                  ? Timestamp.toDate(props.row.expiresAt).toLocaleDateString()
                  : "—"
              }}
            </q-td>
          </template>

          <template #body-cell-status="props">
            <q-td :props="props">
              <q-badge
                :color="inviteStatusColor(props.row.status)"
                :label="inviteStatusLabel(props.row.status)"
              />
            </q-td>
          </template>

          <template #body-cell-actions="props">
            <q-td :props="props">
              <q-btn
                v-if="props.row.status === InviteStatus.ACTIVE"
                flat
                dense
                color="negative"
                icon="sym_o_block"
                label="Revoke"
                @click="confirmRevokeInvite(props.row)"
              />
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- ═══════ Analytics Tab ═══════ -->
      <q-tab-panel name="analytics">
        <!-- Period selector -->
        <div class="row items-center q-mb-lg q-gutter-sm">
          <q-btn-toggle
            v-model="statsPeriod"
            toggle-color="primary"
            :options="[
              { label: '7 days', value: 7 },
              { label: '30 days', value: 30 },
              { label: '90 days', value: 90 },
            ]"
            unelevated
            @update:model-value="store.fetchRegistrationStats(statsPeriod)"
          />
        </div>

        <!-- Total counter -->
        <q-card flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="text-h3 text-weight-bold text-primary">
              {{ store.stats?.total ?? 0 }}
            </div>
            <div class="text-subtitle1 text-grey">
              New profiles (last {{ statsPeriod }} days)
            </div>
          </q-card-section>
        </q-card>

        <div class="row q-col-gutter-lg">
          <!-- Source Breakdown -->
          <div class="col-12 col-md-7">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-h6 q-mb-md">Registration Sources</div>

                <div
                  v-for="entry in store.stats?.bySource ?? []"
                  :key="entry.sourceType"
                  class="q-mb-md"
                >
                  <div class="row items-center justify-between q-mb-xs">
                    <div class="text-weight-medium">
                      {{ sourceTypeLabel(entry.sourceType) }}
                    </div>
                    <div class="text-caption">
                      {{ entry.count }} ({{ entry.percentage.toFixed(1) }}%)
                    </div>
                  </div>
                  <q-linear-progress
                    :value="entry.percentage / 100"
                    :color="sourceTypeColor(entry.sourceType)"
                    rounded
                    size="md"
                  />
                </div>

                <div
                  v-if="!store.stats?.bySource?.length"
                  class="text-caption text-grey text-center q-pa-lg"
                >
                  No registration data for selected period.
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Referrers -->
          <div class="col-12 col-md-5">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-h6 q-mb-sm">Referrals</div>
                <div class="text-caption text-grey q-mb-md">
                  {{ store.stats?.totalReferrals ?? 0 }} profiles referred by
                  {{ store.stats?.uniqueReferrers ?? 0 }} users
                </div>

                <div class="text-subtitle2 q-mb-sm">Top Referrers</div>
                <q-list dense separator>
                  <q-item
                    v-for="referrer in store.stats?.topReferrers ?? []"
                    :key="shown(referrer.profileId)"
                  >
                    <q-item-section avatar>
                      <q-avatar color="primary" text-color="white" size="sm">
                        {{
                          referrer.displayName?.charAt(0)?.toUpperCase() ?? "?"
                        }}
                      </q-avatar>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ referrer.displayName }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-badge
                        color="primary"
                        :label="String(referrer.referralCount)"
                      />
                    </q-item-section>
                  </q-item>

                  <q-item v-if="!store.stats?.topReferrers?.length">
                    <q-item-section class="text-caption text-grey text-center">
                      No referrals in selected period.
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <!-- ═══════ Create Invite Dialog ═══════ -->
    <q-dialog v-model="showCreateInviteDialog" persistent>
      <q-card style="min-width: 420px">
        <q-card-section>
          <div class="text-h6">Create Invite Code</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model.number="newInviteMaxUses"
            type="number"
            label="Max uses"
            outlined
            dense
            :min="0"
            hint="0 = unlimited, 1 = single-use"
            class="q-mb-md"
          />

          <q-input
            v-model="newInviteExpiry"
            type="date"
            label="Expires at (optional)"
            outlined
            dense
            clearable
            class="q-mb-md"
          />

          <q-expansion-item
            dense
            label="Metadata (optional)"
            caption="Pre-fill fields on registration"
            header-class="text-caption"
          >
            <div
              v-for="(_, key) in newInviteMetadata"
              :key="key"
              class="row items-center q-gutter-sm q-mb-sm q-ml-md"
            >
              <q-input
                :model-value="key"
                dense
                outlined
                readonly
                label="Key"
                class="col"
              />
              <q-input
                v-model="newInviteMetadata[key]"
                dense
                outlined
                label="Value"
                class="col"
              />
              <q-btn
                flat
                dense
                round
                icon="sym_o_close"
                size="sm"
                @click="delete newInviteMetadata[key]"
              />
            </div>
            <div class="row items-center q-gutter-sm q-ml-md q-mt-sm">
              <q-input
                v-model="metaKey"
                dense
                outlined
                placeholder="key"
                class="col"
              />
              <q-input
                v-model="metaValue"
                dense
                outlined
                placeholder="value"
                class="col"
              />
              <q-btn
                flat
                dense
                icon="sym_o_add"
                :disable="!metaKey.trim()"
                @click="addMetadata"
              />
            </div>
          </q-expansion-item>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            unelevated
            color="primary"
            label="Create"
            :loading="store.loading"
            @click="doCreateInvite"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ═══════ Bulk Generate Dialog ═══════ -->
    <q-dialog v-model="showBulkDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Bulk Generate Invite Codes</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model.number="bulkCount"
            type="number"
            label="Number of codes"
            outlined
            dense
            :min="1"
            :max="100"
            class="q-mb-md"
          />
          <q-input
            v-model.number="bulkMaxUses"
            type="number"
            label="Max uses per code"
            outlined
            dense
            :min="0"
            hint="0 = unlimited"
            class="q-mb-md"
          />
          <q-input
            v-model="bulkExpiry"
            type="date"
            label="Expires at (optional)"
            outlined
            dense
            clearable
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            unelevated
            color="primary"
            label="Generate"
            :loading="store.loading"
            @click="doBulkCreate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { copyToClipboard, useQuasar } from "quasar";
import {
  useEnrollmentStore,
  EnrollmentMode,
  InviteStatus,
  enrollmentModeLabel,
  enrollmentModeColor,
  enrollmentModeIcon,
  enrollmentModeDescription,
  inviteStatusLabel,
  inviteStatusColor,
  sourceTypeLabel,
  sourceTypeColor,
} from "stores/enrollment";
import type { Invite, InviteConfig } from "stores/enrollment";
import { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import { InviteId, required } from "@structured-id/ids";
import { shown } from "src/ids";

const $q = useQuasar();
const store = useEnrollmentStore();
const tab = ref("policy");

// ── Policy state ──
const editMode = ref<EnrollmentMode>(EnrollmentMode.OPEN);
const editDomains = ref<string[]>([]);
const editTrackSource = ref(true);
const editInviteConfig = ref<InviteConfig>({
  defaultMaxUses: 1,
  defaultExpiryHours: 0,
});
const newDomain = ref("");

const currentMode = computed(() => store.policy?.mode ?? EnrollmentMode.OPEN);

const modeOptions = [
  { value: EnrollmentMode.OPEN },
  { value: EnrollmentMode.INVITE_ONLY },
  { value: EnrollmentMode.ADMIN_ONLY },
  { value: EnrollmentMode.DOMAIN_RESTRICTED },
];

function addDomain() {
  const d = newDomain.value.trim().toLowerCase();
  if (d && !editDomains.value.includes(d)) {
    editDomains.value.push(d);
  }
  newDomain.value = "";
}

async function savePolicy() {
  await store.updatePolicy({
    mode: editMode.value,
    invite:
      editMode.value === EnrollmentMode.INVITE_ONLY
        ? { ...editInviteConfig.value }
        : undefined,
    allowedDomains:
      editMode.value === EnrollmentMode.DOMAIN_RESTRICTED
        ? [...editDomains.value]
        : [],
    trackSource: editTrackSource.value,
  });
  $q.notify({ type: "positive", message: "Enrollment policy saved" });
}

// ── Invites state ──
const inviteStatusFilter = ref<InviteStatus | null>(null);
const inviteSearch = ref("");

const inviteStatusOptions = [
  { label: "Active", value: InviteStatus.ACTIVE },
  { label: "Consumed", value: InviteStatus.CONSUMED },
  { label: "Revoked", value: InviteStatus.REVOKED },
  { label: "Expired", value: InviteStatus.EXPIRED },
];

const inviteColumns = [
  {
    name: "code",
    label: "Code",
    field: "code",
    align: "left" as const,
    sortable: true,
  },
  { name: "uses", label: "Uses", field: "useCount", align: "center" as const },
  {
    name: "expiresAt",
    label: "Expires",
    field: "expiresAt",
    align: "left" as const,
  },
  {
    name: "createdByName",
    label: "Created by",
    field: "createdByName",
    align: "left" as const,
  },
  {
    name: "status",
    label: "Status",
    field: "status",
    align: "center" as const,
  },
  { name: "actions", label: "", field: "id", align: "right" as const },
];

// Create invite
const showCreateInviteDialog = ref(false);
const newInviteMaxUses = ref(1);
const newInviteExpiry = ref<string | null>(null);
const newInviteMetadata = ref<Record<string, string>>({});
const metaKey = ref("");
const metaValue = ref("");

function addMetadata() {
  if (metaKey.value.trim()) {
    newInviteMetadata.value[metaKey.value.trim()] = metaValue.value;
    metaKey.value = "";
    metaValue.value = "";
  }
}

async function doCreateInvite() {
  const invite = await store.createInvite(
    {
      maxUses: newInviteMaxUses.value,
      expiresAt: newInviteExpiry.value ? new Date(newInviteExpiry.value) : null,
    },
    { ...newInviteMetadata.value },
  );
  if (invite) {
    showCreateInviteDialog.value = false;
    $q.notify({ type: "positive", message: `Invite created: ${invite.code}` });
    newInviteMaxUses.value = 1;
    newInviteExpiry.value = null;
    newInviteMetadata.value = {};
  }
}

function copyInviteLink(code: string) {
  // The installation's own registration page, which pre-fills the code.
  const link = `${window.location.origin}/account/register?invite=${encodeURIComponent(code)}`;
  copyToClipboard(link).then(() => {
    $q.notify({ type: "positive", message: "Invite link copied" });
  });
}

function confirmRevokeInvite(invite: Invite) {
  $q.dialog({
    title: "Revoke Invite",
    message: `Revoke invite code "${invite.code}"? It will no longer be usable.`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    await store.revokeInvite(required(InviteId, invite.id));
    $q.notify({ type: "positive", message: "Invite revoked" });
  });
}

// Bulk
const showBulkDialog = ref(false);
const bulkCount = ref(5);
const bulkMaxUses = ref(1);
const bulkExpiry = ref<string | null>(null);

async function doBulkCreate() {
  const created = await store.bulkCreateInvites(
    bulkCount.value,
    {
      maxUses: bulkMaxUses.value,
      expiresAt: bulkExpiry.value ? new Date(bulkExpiry.value) : null,
    },
    {},
  );
  if (created.length) {
    showBulkDialog.value = false;
    $q.notify({
      type: "positive",
      message: `${created.length} invite codes generated`,
    });
  }
}

// ── Analytics state ──
const statsPeriod = ref(30);

// ── Init ──
onMounted(async () => {
  await store.fetchPolicy();
  if (store.policy) {
    editMode.value = store.policy.mode;
    editDomains.value = [...store.policy.allowedDomains];
    editTrackSource.value = store.policy.trackSource;
    if (store.policy.invite) {
      editInviteConfig.value = { ...store.policy.invite };
    }
  }
  store.fetchInvites();
  store.fetchRegistrationStats(statsPeriod.value);
});
</script>
