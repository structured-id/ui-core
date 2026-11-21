import { defineStore } from "pinia";
import { ref } from "vue";
import { SessionServiceClient } from "@structured-id/proto/sid/v1/admin/sessions.client";
import type {
  AdminSession,
  SessionStats,
} from "@structured-id/proto/sid/v1/admin/sessions";
import { SessionAuthMethod } from "@structured-id/proto/sid/v1/admin/sessions";
import { getAccountTransport } from "@structured-id/ui-core";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import type { ProfileId, SessionId } from "@structured-id/ids";
import { names } from "src/ids";

function getClient() {
  return new SessionServiceClient(getAccountTransport());
}

export const useSessionsStore = defineStore("sessions", () => {
  const sessions = ref<AdminSession[]>([]);
  const totalCount = ref(0);
  const stats = ref<SessionStats | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchSessions(filters?: {
    clientId?: string;
    profileId?: ProfileId;
    ipAddress?: string;
    authMethod?: SessionAuthMethod;
    startedAfter?: Timestamp;
    startedBefore?: Timestamp;
    search?: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      // Every matching session, page by page under the same filters: the
      // console's table pages the list locally.
      const client = getClient();
      const all: AdminSession[] = [];
      let pageToken = "";
      let total = 0;
      do {
        const { response } = await client.listSessions({
          pageSize: 100,
          pageToken,
          clientId: filters?.clientId ?? "",
          profileId: filters?.profileId?.toWire(),
          ipAddress: filters?.ipAddress ?? "",
          authMethod: filters?.authMethod ?? SessionAuthMethod.UNSPECIFIED,
          startedAfter: filters?.startedAfter,
          startedBefore: filters?.startedBefore,
          search: filters?.search ?? "",
        });
        all.push(...response.sessions);
        total = response.totalCount;
        pageToken = response.nextPageToken;
      } while (pageToken);
      sessions.value = all;
      totalCount.value = total;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load sessions";
    } finally {
      loading.value = false;
    }
  }

  async function fetchStats() {
    error.value = null;
    try {
      const { response } = await getClient().getSessionStats({});
      stats.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load session stats";
    }
  }

  async function revokeSession(sessionId: SessionId) {
    error.value = null;
    try {
      await getClient().revokeSession({ sessionId: sessionId.toWire() });
      sessions.value = sessions.value.filter(
        (s) => !names(s.sessionId, sessionId),
      );
      if (stats.value) {
        stats.value = {
          ...stats.value,
          totalActive: Math.max(0, stats.value.totalActive - 1),
        };
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to revoke session";
      throw err;
    }
  }

  async function revokeApplicationSessions(clientId: string) {
    error.value = null;
    try {
      const { response } = await getClient().revokeApplicationSessions({
        clientId,
      });
      sessions.value = sessions.value.filter((s) => s.clientId !== clientId);
      return response.revokedCount;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to revoke application sessions";
      throw err;
    }
  }

  async function revokeRealmSessions(confirmation: string) {
    error.value = null;
    try {
      const { response } = await getClient().revokeRealmSessions({
        confirmation,
      });
      sessions.value = [];
      if (stats.value) {
        stats.value = { ...stats.value, totalActive: 0, activeUsers: 0 };
      }
      return response.revokedCount;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to revoke all sessions";
      throw err;
    }
  }

  return {
    sessions,
    totalCount,
    stats,
    loading,
    error,
    fetchSessions,
    fetchStats,
    revokeSession,
    revokeApplicationSessions,
    revokeRealmSessions,
  };
});
