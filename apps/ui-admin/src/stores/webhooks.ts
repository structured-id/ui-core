import { defineStore } from "pinia";
import { ref } from "vue";
import {
  WebhookServiceClient,
  EventCatalogServiceClient,
} from "@structured-id/proto/sid/v1/admin/webhooks.client";
import type {
  WebhookEndpoint,
  DeliverySummary,
  DeliveryDetail,
  DeliveryAnalytics,
  EventTypeInfo,
  EventTypeDetail,
  CreateEndpointRequest,
  UpdateEndpointRequest,
} from "@structured-id/proto/sid/v1/admin/webhooks";
import {
  EndpointStatus,
  DeliveryStatus,
} from "@structured-id/proto/sid/v1/admin/webhooks";
import { getAccountTransport } from "@structured-id/ui-core";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";

function getWebhookClient() {
  return new WebhookServiceClient(getAccountTransport());
}

function getCatalogClient() {
  return new EventCatalogServiceClient(getAccountTransport());
}

export const useWebhooksStore = defineStore("webhooks", () => {
  // ── Endpoints ──
  const endpoints = ref<WebhookEndpoint[]>([]);
  const currentEndpoint = ref<WebhookEndpoint | null>(null);
  const hmacSecret = ref<string | null>(null);

  // ── Deliveries ──
  const deliveries = ref<DeliverySummary[]>([]);
  /** The continuation of the shown deliveries; empty at the last page. */
  const deliveriesNextToken = ref("");
  /** The endpoint the shown deliveries belong to; actions use it. */
  const deliveriesEndpoint = ref<string | null>(null);
  /** The latest delivery search; only its answer is shown. */
  let deliveriesRequest = 0;
  const deliveryDetail = ref<DeliveryDetail | null>(null);
  const analytics = ref<DeliveryAnalytics | null>(null);

  // ── Event Catalog ──
  const eventTypes = ref<EventTypeInfo[]>([]);
  const eventDetail = ref<EventTypeDetail | null>(null);

  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  // ── Endpoint CRUD ──

  async function fetchEndpoints(status?: EndpointStatus, search?: string) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getWebhookClient().listEndpoints({
        status: status ?? EndpointStatus.UNSPECIFIED,
        search: search ?? "",
      });
      endpoints.value = response.endpoints;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load endpoints";
    } finally {
      loading.value = false;
    }
  }

  /** The endpoint asked for last; only its answer is shown. */
  let endpointShown = "";

  async function fetchEndpoint(endpointId: string) {
    if (endpointShown !== endpointId) {
      endpointShown = endpointId;
      currentEndpoint.value = null;
    }
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getWebhookClient().getEndpoint({
        endpointId,
      });
      if (endpointShown === endpointId) currentEndpoint.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load endpoint";
    } finally {
      loading.value = false;
    }
  }

  async function createEndpoint(req: CreateEndpointRequest) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await getWebhookClient().createEndpoint(req);
      if (response.endpoint) {
        endpoints.value.push(response.endpoint);
        currentEndpoint.value = response.endpoint;
      }
      hmacSecret.value = response.hmacSecret;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to create endpoint";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function updateEndpoint(req: UpdateEndpointRequest) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await getWebhookClient().updateEndpoint(req);
      // Another endpoint shown meanwhile keeps its detail.
      if (currentEndpoint.value?.endpointId === req.endpointId) {
        currentEndpoint.value = response;
      }
      const idx = endpoints.value.findIndex(
        (e) => e.endpointId === req.endpointId,
      );
      if (idx >= 0) endpoints.value[idx] = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update endpoint";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function deleteEndpoint(endpointId: string) {
    saving.value = true;
    error.value = null;
    try {
      await getWebhookClient().deleteEndpoint({ endpointId });
      endpoints.value = endpoints.value.filter(
        (e) => e.endpointId !== endpointId,
      );
      if (currentEndpoint.value?.endpointId === endpointId) {
        currentEndpoint.value = null;
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete endpoint";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function pauseEndpoint(endpointId: string) {
    error.value = null;
    try {
      const { response } = await getWebhookClient().pauseEndpoint({
        endpointId,
      });
      const idx = endpoints.value.findIndex((e) => e.endpointId === endpointId);
      if (idx >= 0) endpoints.value[idx] = response;
      if (currentEndpoint.value?.endpointId === endpointId) {
        currentEndpoint.value = response;
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to pause endpoint";
      throw err;
    }
  }

  async function resumeEndpoint(endpointId: string) {
    error.value = null;
    try {
      const { response } = await getWebhookClient().resumeEndpoint({
        endpointId,
      });
      const idx = endpoints.value.findIndex((e) => e.endpointId === endpointId);
      if (idx >= 0) endpoints.value[idx] = response;
      if (currentEndpoint.value?.endpointId === endpointId) {
        currentEndpoint.value = response;
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to resume endpoint";
      throw err;
    }
  }

  async function regenerateSecret(endpointId: string) {
    error.value = null;
    try {
      const { response } = await getWebhookClient().regenerateSecret({
        endpointId,
      });
      hmacSecret.value = response.hmacSecret;
      return response.hmacSecret;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to regenerate secret";
      throw err;
    }
  }

  // ── Deliveries ──

  async function fetchDeliveries(
    endpointId: string,
    filters?: {
      status?: DeliveryStatus;
      eventType?: string;
      from?: Timestamp;
      to?: Timestamp;
      pageToken?: string;
    },
  ) {
    const request = ++deliveriesRequest;
    // Another endpoint's rows are never shown, and so never acted on, as
    // this one's.
    if (deliveriesEndpoint.value !== endpointId) {
      deliveries.value = [];
      deliveriesNextToken.value = "";
      deliveriesEndpoint.value = null;
    }
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getWebhookClient().listDeliveries({
        endpointId,
        status: filters?.status ?? DeliveryStatus.UNSPECIFIED,
        eventType: filters?.eventType ?? "",
        from: filters?.from,
        to: filters?.to,
        pageSize: 25,
        pageToken: filters?.pageToken ?? "",
      });
      // A search started since owns the list; this answer is late.
      if (request !== deliveriesRequest) return;
      // A page after the first continues the list its search began.
      deliveries.value = filters?.pageToken
        ? [...deliveries.value, ...response.deliveries]
        : response.deliveries;
      deliveriesNextToken.value = response.nextPageToken;
      deliveriesEndpoint.value = endpointId;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load deliveries";
    } finally {
      loading.value = false;
    }
  }

  async function fetchDeliveryDetail(endpointId: string, deliveryId: string) {
    error.value = null;
    try {
      const { response } = await getWebhookClient().getDeliveryDetail({
        endpointId,
        deliveryId,
      });
      deliveryDetail.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load delivery detail";
    }
  }

  async function redeliverEvent(endpointId: string, deliveryId: string) {
    error.value = null;
    try {
      const { response } = await getWebhookClient().redeliverEvent({
        endpointId,
        deliveryId,
      });
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to redeliver event";
      throw err;
    }
  }

  async function fetchAnalytics(endpointId?: string) {
    error.value = null;
    try {
      const { response } = await getWebhookClient().getDeliveryAnalytics({
        endpointId: endpointId ?? "",
      });
      analytics.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load analytics";
    }
  }

  // ── Event Catalog ──

  async function fetchEventTypes(domain?: string) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getCatalogClient().listEventTypes({
        domain: domain ?? "",
      });
      eventTypes.value = response.eventTypes;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load event types";
    } finally {
      loading.value = false;
    }
  }

  async function fetchEventDetail(eventType: string) {
    error.value = null;
    try {
      const { response } = await getCatalogClient().getEventTypeDetail({
        eventType,
      });
      eventDetail.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load event detail";
    }
  }

  async function sendTestEvent(
    eventType: string,
    endpointId: string,
    payload?: string,
  ) {
    error.value = null;
    try {
      const { response } = await getCatalogClient().sendTestEvent({
        eventType,
        endpointId,
        payload: payload ?? "",
      });
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to send test event";
      throw err;
    }
  }

  return {
    endpoints,
    currentEndpoint,
    hmacSecret,
    deliveries,
    deliveriesNextToken,
    deliveriesEndpoint,
    deliveryDetail,
    analytics,
    eventTypes,
    eventDetail,
    loading,
    saving,
    error,
    fetchEndpoints,
    fetchEndpoint,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
    pauseEndpoint,
    resumeEndpoint,
    regenerateSecret,
    fetchDeliveries,
    fetchDeliveryDetail,
    redeliverEvent,
    fetchAnalytics,
    fetchEventTypes,
    fetchEventDetail,
    sendTestEvent,
  };
});
