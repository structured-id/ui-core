import { ref, onMounted, onUnmounted } from "vue";
import type { SessionInfo } from "../types/auth";

/**
 * Vue composable for session management.
 *
 * Provides reactive session list, auto-refresh, and revocation.
 * The actual gRPC calls are delegated to a callback to keep
 * ui-core independent of specific proto client versions.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useSession } from '@structured-id/ui-core'
 *
 * const { sessions, loading, refresh } = useSession({
 *   fetchSessions: async () => { ... },
 *   revokeSession: async (id) => { ... },
 * })
 * </script>
 * ```
 */
export interface SessionCallbacks {
  fetchSessions: () => Promise<SessionInfo[]>;
  revokeSession: (sessionId: string) => Promise<void>;
}

export function useSession(callbacks: SessionCallbacks) {
  const sessions = ref<SessionInfo[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      sessions.value = await callbacks.fetchSessions();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function revoke(sessionId: string): Promise<void> {
    await callbacks.revokeSession(sessionId);
    sessions.value = sessions.value.filter((s) => s.id !== sessionId);
  }

  function startAutoRefresh(intervalMs = 30_000): void {
    stopAutoRefresh();
    refreshTimer = setInterval(refresh, intervalMs);
  }

  function stopAutoRefresh(): void {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  onMounted(() => {
    refresh();
  });

  onUnmounted(() => {
    stopAutoRefresh();
  });

  return {
    sessions,
    loading,
    error,
    refresh,
    revoke,
    startAutoRefresh,
    stopAutoRefresh,
  };
}
