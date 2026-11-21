<template>
  <q-page padding>
    <!-- Header -->
    <div class="row items-center q-mb-lg">
      <q-btn flat round icon="sym_o_arrow_back" :to="{ name: 'admin-users' }" />
      <div class="col q-ml-sm">
        <div class="row items-center q-gutter-sm">
          <div class="text-h5">
            {{
              store.currentProfile?.formattedName ||
              store.currentProfile?.username ||
              "User"
            }}
          </div>
          <q-badge
            v-if="store.currentProfile"
            :color="profileStatusColor(store.currentProfile.status)"
            :label="profileStatusLabel(store.currentProfile.status)"
          />
          <q-badge
            v-if="store.currentProfile"
            color="grey-3"
            text-color="grey-8"
            :label="ProfileType[store.currentProfile.profileType] || 'Personal'"
          />
        </div>
        <div v-if="store.currentProfile" class="text-caption text-grey">
          @{{ store.currentProfile.username }} &middot;
          {{ store.currentProfile.email || "No email" }}
          <template v-if="store.currentProfile.createdAt">
            · Joined {{ formatDate(store.currentProfile.createdAt) }}
          </template>
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
      <q-tab name="profile" label="Profile" icon="sym_o_person" />
      <q-tab name="credentials" label="Credentials" icon="sym_o_passkey" />
      <q-tab name="sessions" label="Sessions" icon="sym_o_devices" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <!-- Profile Tab -->
      <q-tab-panel name="profile">
        <div
          v-if="store.currentProfile"
          class="q-gutter-md"
          style="max-width: 600px"
        >
          <q-input
            :model-value="store.currentProfile.username"
            outlined
            label="Username"
            readonly
            dense
            hint="Cannot be changed after creation"
          />
          <q-input
            v-model="profileForm.givenName"
            outlined
            label="Given name"
            dense
          />
          <q-input
            v-model="profileForm.familyName"
            outlined
            label="Family name"
            dense
            hint="Optional — leave empty for mononyms"
          />
          <q-input
            v-model="profileForm.middleName"
            outlined
            label="Middle name"
            dense
          />
          <q-input
            :model-value="store.currentProfile.email"
            outlined
            label="Email"
            readonly
            dense
          >
            <template #append>
              <q-icon
                v-if="store.currentProfile.emailVerified"
                name="sym_o_verified"
                color="positive"
              />
            </template>
          </q-input>

          <!-- Identifiers -->
          <div class="text-subtitle2 q-mt-md">Identifiers</div>
          <q-list bordered separator>
            <q-item
              v-for="ident in store.currentProfile.principals"
              :key="shown(ident.id)"
            >
              <q-item-section>
                <q-item-label>{{ ident.value }}</q-item-label>
                <q-item-label caption>
                  {{ principalTypeLabel(ident.type) }}
                  <q-badge
                    v-if="ident.verified"
                    color="positive"
                    label="Verified"
                    class="q-ml-sm"
                  />
                  <q-badge
                    v-if="ident.isPrimary"
                    color="primary"
                    label="Primary"
                    class="q-ml-sm"
                  />
                  <!-- loginEnabled removed: all principals are login-capable -->
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="!store.currentProfile.principals.length">
              <q-item-section class="text-grey">
                No identifiers
              </q-item-section>
            </q-item>
          </q-list>

          <!-- Status Management -->
          <div class="text-subtitle2 q-mt-md">Status</div>
          <div class="row items-center q-gutter-sm">
            <q-badge
              :color="profileStatusColor(store.currentProfile.status)"
              :label="profileStatusLabel(store.currentProfile.status)"
            />
            <q-btn
              v-if="store.currentProfile.status === ProfileStatus.ACTIVE"
              flat
              dense
              color="warning"
              label="Suspend"
              icon="sym_o_block"
              no-caps
              size="sm"
              @click="suspendUser"
            />
            <q-btn
              v-else-if="
                store.currentProfile.status === ProfileStatus.SUSPENDED
              "
              flat
              dense
              color="positive"
              label="Activate"
              icon="sym_o_check_circle"
              no-caps
              size="sm"
              @click="activateUser"
            />
          </div>

          <q-btn
            color="primary"
            label="Save Changes"
            no-caps
            :loading="store.loading"
            :disable="!profileFormChanged"
            @click="saveProfile"
          />

          <!-- Danger Zone -->
          <q-separator class="q-my-lg" />
          <div class="text-subtitle1 text-negative">Danger Zone</div>
          <q-card flat bordered class="q-pa-md">
            <div class="row items-center justify-between">
              <div>
                <div class="text-subtitle2">Delete this user</div>
                <div class="text-caption text-grey">
                  Permanently remove user and all associated data.
                </div>
              </div>
              <q-btn
                outline
                color="negative"
                label="Delete"
                no-caps
                @click="confirmDelete"
              />
            </div>
          </q-card>
        </div>
      </q-tab-panel>

      <!-- Credentials Tab -->
      <q-tab-panel name="credentials">
        <div style="max-width: 600px">
          <q-list bordered separator v-if="store.credentials.length">
            <q-item v-for="cred in store.credentials" :key="shown(cred.id)">
              <q-item-section avatar>
                <q-icon :name="credentialTypeIcon(cred.type)" />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ cred.label || credentialTypeLabel(cred.type) }}
                </q-item-label>
                <q-item-label caption>
                  {{ credentialTypeLabel(cred.type) }}
                  <template v-if="cred.info.oneofKind === 'webauthnInfo'">
                    ·
                    {{
                      AuthenticatorAttachment[
                        cred.info.webauthnInfo.attachment
                      ] ?? ""
                    }}
                    <q-badge
                      v-if="cred.info.webauthnInfo.backupState"
                      color="info"
                      label="Synced"
                      class="q-ml-xs"
                      dense
                    />
                  </template>
                  <span v-if="cred.lastUsedAt">
                    · Last used {{ formatDate(cred.lastUsedAt) }}
                  </span>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  round
                  dense
                  icon="sym_o_delete"
                  color="negative"
                  @click="revokeCredential(cred.id)"
                >
                  <q-tooltip>Revoke</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="text-grey q-pa-md text-center">
            No credentials registered.
          </div>
        </div>
      </q-tab-panel>

      <!-- Sessions Tab -->
      <q-tab-panel name="sessions">
        <div style="max-width: 800px">
          <div class="row items-center q-mb-md">
            <div class="col text-subtitle2">
              Active Sessions ({{ store.sessions.length }})
            </div>
          </div>
          <q-table
            v-if="store.sessions.length"
            :rows="store.sessions"
            :columns="sessionColumns"
            :row-key="(s: Session) => shown(s.id)"
            flat
            bordered
            :pagination="{ rowsPerPage: 10 }"
          >
            <template #body-cell-actions="props">
              <q-td :props="props" auto-width>
                <q-btn
                  flat
                  round
                  dense
                  icon="sym_o_logout"
                  color="negative"
                  @click="revokeSessionAction(props.row.id)"
                >
                  <q-tooltip>Revoke</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
          <div v-else class="text-grey q-pa-md text-center">
            No active sessions.
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Delete confirmation -->
    <q-dialog v-model="deleteDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Delete User</div>
        </q-card-section>
        <q-card-section>
          <p>
            Are you sure you want to delete
            <strong>{{
              store.currentProfile?.formattedName ||
              store.currentProfile?.username
            }}</strong>?
          </p>
          <p class="text-negative text-caption">
            This action is permanent and cannot be undone.
          </p>
          <q-input
            v-model="deleteConfirmName"
            outlined
            dense
            :placeholder="`Type '${store.currentProfile?.username}' to confirm`"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            flat
            color="negative"
            label="Delete"
            :disable="deleteConfirmName !== store.currentProfile?.username"
            @click="executeDelete"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuasar } from "quasar";
import { useUsersStore } from "src/stores/users";
import {
  profileStatusLabel,
  profileStatusColor,
  credentialTypeLabel,
  credentialTypeIcon,
  principalTypeLabel,
} from "src/composables/useEnumLabels";
import {
  ProfileStatus,
  ProfileType,
  AuthenticatorAttachment,
} from "@structured-id/proto/sid/v1/identity/identity";
import type { Session } from "@structured-id/proto/sid/v1/identity/identity";
import type {
  CredentialId as WireCredentialId,
  SessionId as WireSessionId,
} from "@structured-id/proto/sid/v1/ids/ids";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import {
  CredentialId,
  ProfileId,
  SessionId,
  required,
} from "@structured-id/ids";
import { shown } from "src/ids";
import { nameUpdate } from "src/profileUpdate";

const store = useUsersStore();
const route = useRoute();
const router = useRouter();
const $q = useQuasar();

const tab = ref("profile");
const deleteDialog = ref(false);
const deleteConfirmName = ref("");

const profileForm = reactive({
  givenName: "",
  familyName: "",
  middleName: "",
});

const profileFormChanged = computed(
  () =>
    store.currentProfile &&
    (profileForm.givenName !== (store.currentProfile.givenName || "") ||
      profileForm.familyName !== (store.currentProfile.familyName || "") ||
      profileForm.middleName !== (store.currentProfile.middleName || "")),
);

const sessionColumns = [
  {
    name: "clientId",
    label: "Application",
    field: "clientId",
    align: "left" as const,
  },
  {
    name: "ipAddress",
    label: "IP",
    field: "ipAddress",
    align: "left" as const,
  },
  {
    name: "userAgent",
    label: "User Agent",
    field: "userAgent",
    align: "left" as const,
  },
  {
    name: "createdAt",
    label: "Started",
    field: "createdAt",
    align: "left" as const,
    format: (val: Timestamp | undefined) => formatDate(val),
  },
  {
    name: "lastActivityAt",
    label: "Last Active",
    field: "lastActivityAt",
    align: "left" as const,
    format: (val: Timestamp | undefined) => formatDate(val),
  },
  { name: "actions", label: "", field: "id" },
];

function populateForm() {
  const p = store.currentProfile;
  if (!p) return;
  profileForm.givenName = p.givenName || "";
  profileForm.familyName = p.familyName || "";
  profileForm.middleName = p.middleName || "";
}

watch(() => store.currentProfile, populateForm, { immediate: true });

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  const d = new Date(Number(ts.seconds) * 1000);
  return d.toLocaleDateString();
}

function suspendUser() {
  // TODO: Needs SetProfileStatus RPC in proto (not yet available)
  $q.notify({
    type: "info",
    message: "Profile suspension not yet implemented in backend",
  });
}

function activateUser() {
  // TODO: Needs SetProfileStatus RPC in proto (not yet available)
  $q.notify({
    type: "info",
    message: "Profile activation not yet implemented in backend",
  });
}

async function saveProfile() {
  if (!store.currentProfile) return;
  try {
    await store.updateProfile(
      required(ProfileId, store.currentProfile.id),
      nameUpdate(store.currentProfile, {
        givenName: profileForm.givenName,
        familyName: profileForm.familyName,
        middleName: profileForm.middleName,
      }),
    );
    $q.notify({ type: "positive", message: "Profile updated" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Update failed" });
  }
}

async function revokeCredential(credentialId: WireCredentialId | undefined) {
  try {
    await store.revokeCredential(required(CredentialId, credentialId));
    $q.notify({ type: "positive", message: "Credential revoked" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Revoke failed" });
  }
}

async function revokeSessionAction(sessionId: WireSessionId | undefined) {
  try {
    await store.revokeSession(required(SessionId, sessionId));
    $q.notify({ type: "positive", message: "Session revoked" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Revoke failed" });
  }
}

function confirmDelete() {
  deleteConfirmName.value = "";
  deleteDialog.value = true;
}

async function executeDelete() {
  if (!store.currentProfile) return;
  try {
    await store.deleteProfile(required(ProfileId, store.currentProfile.id));
    deleteDialog.value = false;
    $q.notify({ type: "positive", message: "User deleted" });
    router.push({ name: "admin-users" });
  } catch {
    $q.notify({ type: "negative", message: store.error || "Delete failed" });
  }
}

onMounted(async () => {
  const userId = route.params.userId as string;
  if (userId) {
    // A route that names no valid profile is a broken link, not a lookup.
    let id: ProfileId;
    try {
      id = ProfileId.parse(userId);
    } catch {
      store.error = "This link names no user.";
      return;
    }
    await store.getProfile(id);
    // Load credentials and sessions in parallel
    if (store.currentProfile) {
      store.fetchCredentials(id);
      store.fetchSessions(id);
    }
  }
});
</script>
