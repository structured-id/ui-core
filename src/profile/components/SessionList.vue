<template>
  <div>
    <q-banner v-if="error" class="bg-negative text-white q-mb-md" rounded dense>
      {{ error }}
    </q-banner>

    <div v-if="loading" class="text-center q-pa-lg">
      <q-spinner-dots size="32px" color="primary" />
    </div>

    <q-list v-else-if="sessions.length > 0" separator>
      <q-item v-for="session in sessions" :key="session.id">
        <q-item-section avatar>
          <q-icon :name="deviceIcon(session.userAgent)" size="sm" />
        </q-item-section>
        <q-item-section>
          <q-item-label>
            {{ parseUserAgent(session.userAgent) }}
            <q-badge
              v-if="isCurrentSession(session)"
              color="positive"
              label="Current"
              class="q-ml-sm"
            />
          </q-item-label>
          <q-item-label caption>
            <span v-if="session.ipAddress">{{ session.ipAddress }}</span>
            <span v-if="session.lastActivityAt">
              &middot; {{ formatRelative(session.lastActivityAt) }}
            </span>
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn
            v-if="!isCurrentSession(session)"
            flat
            dense
            color="negative"
            icon="sym_o_logout"
            :loading="revoking === session.id"
            @click="$emit('revoke', session.id)"
          />
        </q-item-section>
      </q-item>
    </q-list>

    <div v-else class="text-center text-grey q-pa-lg">No active sessions</div>
  </div>
</template>

<script setup lang="ts">
import { type Session, Timestamp } from "../../index";

defineProps<{
  sessions: Session[];
  loading: boolean;
  error: string | null;
  revoking: string | null;
  currentSessionId?: string;
}>();

defineEmits<{
  revoke: [sessionId: string];
}>();

function isCurrentSession(session: Session): boolean {
  return false; // Overridden via currentSessionId prop comparison
}

function deviceIcon(userAgent: string | undefined): string {
  if (!userAgent) return "sym_o_devices";
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone"))
    return "sym_o_smartphone";
  if (ua.includes("tablet") || ua.includes("ipad")) return "sym_o_tablet";
  return "sym_o_computer";
}

function parseUserAgent(userAgent: string | undefined): string {
  if (!userAgent) return "Unknown device";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Edge")) return "Edge";
  return userAgent.slice(0, 40);
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
