<template>
  <q-page padding class="page">
    <security-settings
      :credentials="credentials"
      :loading="loading"
      :error="error"
      :security-label="level.securityLabel.value"
      :security-color="level.securityColor.value"
      :security-progress="level.securityProgress.value"
      :factor-count="level.factorCount.value"
      :categories="level.categories.value"
      :recoverability-label="level.recoverabilityLabel.value"
      :recoverability-color="level.recoverabilityColor.value"
      :recoverability-progress="level.recoverabilityProgress.value"
      :recovery-methods="level.recoveryMethods.value"
      @edit-label="editLabel"
      @revoke="confirmRevoke"
    />

    <q-card v-if="password" flat bordered class="q-mt-lg">
      <q-card-section>
        <div class="text-subtitle1">Change password</div>
      </q-card-section>
      <q-card-section>
        <q-form @submit="changePassword">
          <q-input
            v-model="current"
            type="password"
            label="Current password"
            autocomplete="current-password"
            outlined
          />
          <q-input
            v-model="next"
            type="password"
            label="New password"
            autocomplete="new-password"
            outlined
            class="q-mt-sm"
          />
          <q-input
            v-model="confirm"
            type="password"
            label="Confirm new password"
            autocomplete="new-password"
            outlined
            class="q-mt-sm"
            :rules="[(v: string) => v === next || 'Passwords do not match']"
          />
          <q-linear-progress
            v-if="progress !== null"
            :value="progress"
            class="q-mt-md"
          />
          <div v-if="changeError" class="text-negative q-mt-sm">
            {{ changeError }}
          </div>
          <q-btn
            type="submit"
            color="primary"
            class="q-mt-md"
            label="Change password"
            :loading="changing"
            :disable="!current || !next || next !== confirm"
          />
        </q-form>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from "vue";
import { useQuasar } from "quasar";
import { CredentialType } from "@structured-id/proto/sid/v1/identity/identity";
import {
  SecuritySettings,
  WrongCurrentPasswordError,
  fetchCredentials,
  fetchPrincipals,
  revokeCredential,
  updateCredentialLabel,
  useSecurityLevel,
  type Credential,
  type Principal,
} from "@structured-id/ui-core/profile";
import { refusalMessage } from "@structured-id/ui-core";
import { useAuth } from "src/composables/useAuth";

const $q = useQuasar();
const { changePassword: change, prewarm } = useAuth();

const credentials = shallowRef<Credential[]>([]);
const principals = shallowRef<Principal[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const level = useSecurityLevel(credentials, principals);

/** The account's password credential, the one a change replaces. */
const password = computed(() =>
  credentials.value.find((c) => c.type === CredentialType.OPAQUE),
);
const current = ref("");
const next = ref("");
const confirm = ref("");
const changing = ref(false);
const progress = ref<number | null>(null);
const changeError = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    [credentials.value, principals.value] = await Promise.all([
      fetchCredentials(),
      fetchPrincipals(),
    ]);
  } catch (e) {
    error.value = refusalMessage(e, "Your sign-in methods cannot be loaded");
  } finally {
    loading.value = false;
  }
}

function editLabel(cred: Credential) {
  $q.dialog({
    title: "Rename",
    prompt: { model: cred.label ?? "", type: "text" },
    cancel: true,
  }).onOk(async (label: string) => {
    try {
      await updateCredentialLabel(cred.id, label);
      await load();
    } catch (e) {
      error.value = refusalMessage(e, "The name was not changed");
    }
  });
}

function confirmRevoke(cred: Credential) {
  $q.dialog({
    title: "Remove sign-in method",
    message: "It can no longer be used to sign in to this account.",
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await revokeCredential(cred.id);
      await load();
    } catch (e) {
      error.value = refusalMessage(e, "The sign-in method was not removed");
    }
  });
}

/** The current password is proved inside the change, whatever the policy. */
async function changePassword() {
  if (!password.value) return;
  changing.value = true;
  changeError.value = null;
  try {
    await change(
      {
        credentialId: password.value.id,
        newPassword: next.value,
        currentPassword: current.value,
      },
      (p) => (progress.value = p.fraction),
    );
    current.value = next.value = confirm.value = "";
    $q.notify({ type: "positive", message: "Password changed" });
  } catch (e) {
    changeError.value =
      e instanceof WrongCurrentPasswordError
        ? "The current password is not correct"
        : refusalMessage(e, "The password was not changed");
  } finally {
    changing.value = false;
    progress.value = null;
  }
}

onMounted(() => {
  void prewarm();
  void load();
});
</script>

<style scoped>
.page {
  max-width: 720px;
  margin: 0 auto;
}
</style>
