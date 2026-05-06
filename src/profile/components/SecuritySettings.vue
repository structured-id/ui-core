<template>
  <div>
    <q-banner v-if="error" class="bg-negative text-white q-mb-md" rounded dense>
      {{ error }}
    </q-banner>

    <!-- Security & Recoverability overview -->
    <div class="row q-gutter-md q-mb-md">
      <q-card flat bordered class="col">
        <q-card-section>
          <div class="text-subtitle2">Security level</div>
          <div :class="`text-${securityColor}`" class="text-h5">
            {{ securityLabel }}
          </div>
          <q-linear-progress
            :value="securityProgress"
            :color="securityColor"
            class="q-mt-sm"
          />
          <div class="text-caption text-grey q-mt-xs">
            {{ factorCount }} factor{{ factorCount !== 1 ? "s" : "" }},
            {{ categories.size }} categor{{
              categories.size !== 1 ? "ies" : "y"
            }}
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="col">
        <q-card-section>
          <div class="text-subtitle2">Recoverability</div>
          <div :class="`text-${recoverabilityColor}`" class="text-h5">
            {{ recoverabilityLabel }}
          </div>
          <q-linear-progress
            :value="recoverabilityProgress"
            :color="recoverabilityColor"
            class="q-mt-sm"
          />
          <div class="text-caption text-grey q-mt-xs">
            {{ recoveryMethods.length }} recovery method{{
              recoveryMethods.length !== 1 ? "s" : ""
            }}
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Credentials list -->
    <div v-if="loading" class="text-center q-pa-lg">
      <q-spinner-dots size="32px" color="primary" />
    </div>

    <q-list v-else-if="credentials.length > 0" separator>
      <q-item v-for="cred in credentials" :key="cred.id">
        <q-item-section avatar>
          <q-icon :name="credIcon(cred.type)" :color="credColor(cred.type)" />
        </q-item-section>
        <q-item-section>
          <q-item-label>
            {{ cred.label || credTypeName(cred.type) }}
          </q-item-label>
          <q-item-label caption>
            {{ credTypeName(cred.type) }}
            <span v-if="cred.lastUsedAt">
              &middot; Last used {{ formatRelative(cred.lastUsedAt) }}
            </span>
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <div class="row q-gutter-xs">
            <q-btn
              flat
              dense
              icon="sym_o_edit"
              @click="$emit('edit-label', cred)"
            />
            <q-btn
              flat
              dense
              icon="sym_o_delete"
              color="negative"
              @click="$emit('revoke', cred)"
            />
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <div v-else class="text-center text-grey q-pa-lg">
      No credentials configured
    </div>

    <slot name="actions" />
  </div>
</template>

<script setup lang="ts">
import { type Credential, CredentialType, Timestamp } from "../../index";
import type { FactorCategory } from "../composables/useSecurityLevel";

defineProps<{
  credentials: Credential[];
  loading: boolean;
  error: string | null;
  securityLabel: string;
  securityColor: string;
  securityProgress: number;
  factorCount: number;
  categories: Set<FactorCategory>;
  recoverabilityLabel: string;
  recoverabilityColor: string;
  recoverabilityProgress: number;
  recoveryMethods: string[];
}>();

defineEmits<{
  "edit-label": [cred: Credential];
  revoke: [cred: Credential];
}>();

const CRED_ICONS: Partial<Record<CredentialType, string>> = {
  [CredentialType.OPAQUE]: "sym_o_key",
  [CredentialType.LEGACY_HASH]: "sym_o_key",
  [CredentialType.TOTP]: "sym_o_timer",
  [CredentialType.WEBAUTHN]: "sym_o_passkey",
  [CredentialType.RECOVERY]: "sym_o_vpn_key",
};

function credIcon(type: CredentialType): string {
  return CRED_ICONS[type] || "sym_o_security";
}

const CRED_COLORS: Partial<Record<CredentialType, string>> = {
  [CredentialType.OPAQUE]: "blue",
  [CredentialType.LEGACY_HASH]: "orange",
  [CredentialType.TOTP]: "teal",
  [CredentialType.WEBAUTHN]: "purple",
  [CredentialType.RECOVERY]: "amber",
};

function credColor(type: CredentialType): string {
  return CRED_COLORS[type] || "grey";
}

const CRED_TYPE_NAMES: Partial<Record<CredentialType, string>> = {
  [CredentialType.OPAQUE]: "Password",
  [CredentialType.LEGACY_HASH]: "Legacy password",
  [CredentialType.TOTP]: "Authenticator app",
  [CredentialType.WEBAUTHN]: "Passkey",
  [CredentialType.RECOVERY]: "Recovery codes",
};

function credTypeName(type: CredentialType): string {
  return CRED_TYPE_NAMES[type] || String(type);
}

function formatRelative(ts?: { seconds: bigint; nanos: number }): string {
  if (!ts) return "";
  const date = Timestamp.toDate(ts);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
</script>
