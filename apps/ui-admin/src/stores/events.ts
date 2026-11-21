import { defineStore } from "pinia";
import { ref } from "vue";
import {
  EventServiceClient,
  AuditServiceClient,
} from "@structured-id/proto/sid/v1/admin/events.client";
import type {
  Event,
  AdminEvent,
  EventConfig,
  AuditEntry,
  VerifyChainResponse,
} from "@structured-id/proto/sid/v1/admin/events";
import type {
  EventType,
  AdminEventType,
} from "@structured-id/proto/sid/v1/admin/events";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import { getAccountTransport } from "@structured-id/ui-core";
import { Empty } from "@structured-id/proto/google/protobuf/empty";

function getEventClient() {
  return new EventServiceClient(getAccountTransport());
}

function getAuditClient() {
  return new AuditServiceClient(getAccountTransport());
}

export const useEventsStore = defineStore("events", () => {
  // ── State ──
  const events = ref<Event[]>([]);
  const eventsTotalCount = ref(0);
  const eventsNextToken = ref("");
  const adminEvents = ref<AdminEvent[]>([]);
  const adminEventsTotalCount = ref(0);
  const adminEventsNextToken = ref("");
  const auditEntries = ref<AuditEntry[]>([]);
  const auditTotalCount = ref(0);
  const auditNextToken = ref("");
  const eventConfig = ref<EventConfig | null>(null);
  const verifyResult = ref<VerifyChainResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ── User Events ──

  async function fetchEvents(req: {
    pageSize: number;
    pageToken: string;
    type?: EventType;
    profileId?: string;
    clientId?: string;
    ipAddress?: string;
    from?: Timestamp;
    to?: Timestamp;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getEventClient().listEvents(req);
      events.value = response.events;
      eventsTotalCount.value = response.totalCount;
      eventsNextToken.value = response.nextPageToken;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load events";
    } finally {
      loading.value = false;
    }
  }

  /**
   * One page for the live stream, answered to the caller: the stream keeps
   * its own list, so a poll never replaces the User Events search results.
   */
  async function pollEvents(req: {
    pageSize: number;
    pageToken: string;
    type?: EventType;
  }) {
    const { response } = await getEventClient().listEvents(req);
    return response;
  }

  // ── Admin Events ──

  async function fetchAdminEvents(req: {
    pageSize: number;
    pageToken: string;
    type?: AdminEventType;
    adminId?: string;
    resourceType?: string;
    from?: Timestamp;
    to?: Timestamp;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getEventClient().listAdminEvents(req);
      adminEvents.value = response.events;
      adminEventsTotalCount.value = response.totalCount;
      adminEventsNextToken.value = response.nextPageToken;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load admin events";
    } finally {
      loading.value = false;
    }
  }

  // ── Event Config ──

  async function fetchEventConfig() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getEventClient().getEventConfig(
        Empty.create(),
      );
      eventConfig.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load event config";
    } finally {
      loading.value = false;
    }
  }

  async function updateEventConfig(config: EventConfig) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getEventClient().updateEventConfig(config);
      eventConfig.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update event config";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Audit Trail ──

  async function fetchAuditTrail(req: {
    pageSize: number;
    pageToken: string;
    actorId?: string;
    resourceType?: string;
    resourceId?: string;
    from?: Timestamp;
    to?: Timestamp;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getAuditClient().getAuditTrail(req);
      auditEntries.value = response.entries;
      auditTotalCount.value = response.totalCount;
      auditNextToken.value = response.nextPageToken;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load audit trail";
    } finally {
      loading.value = false;
    }
  }

  async function verifyChain(from?: Timestamp, to?: Timestamp) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getAuditClient().verifyChain({ from, to });
      verifyResult.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to verify chain";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function exportAuditTrail(req: {
    format: string;
    actorId?: string;
    resourceType?: string;
    from?: Timestamp;
    to?: Timestamp;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getAuditClient().exportAuditTrail(req);
      const blob = new Blob([new Uint8Array(response.data)], {
        type: response.contentType,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = response.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to export audit trail";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    events,
    eventsTotalCount,
    eventsNextToken,
    adminEvents,
    adminEventsTotalCount,
    adminEventsNextToken,
    auditEntries,
    auditTotalCount,
    auditNextToken,
    eventConfig,
    verifyResult,
    loading,
    error,
    fetchEvents,
    pollEvents,
    fetchAdminEvents,
    fetchEventConfig,
    updateEventConfig,
    fetchAuditTrail,
    verifyChain,
    exportAuditTrail,
  };
});
