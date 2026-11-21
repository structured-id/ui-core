import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({ listDeliveries: vi.fn() }));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/admin/webhooks.client", () => ({
  WebhookServiceClient: class {
    listDeliveries = mocks.listDeliveries;
  },
  EventCatalogServiceClient: class {},
}));

import { useWebhooksStore } from "./webhooks";

const page = (ids: string[]) => ({
  response: {
    deliveries: ids.map((deliveryId) => ({ deliveryId })),
    nextPageToken: "",
  },
});

describe("webhooks store: deliveries of one endpoint", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: after A's deliveries, a failed load of B kept A's rows, and
  // redelivering one sent B's endpoint with A's delivery id.
  it("shows no other endpoint's rows while another loads or fails", async () => {
    mocks.listDeliveries
      .mockResolvedValueOnce(page(["a1"]))
      .mockRejectedValueOnce(new Error("UNAVAILABLE"));
    const store = useWebhooksStore();
    await store.fetchDeliveries("A");
    expect(store.deliveriesEndpoint).toBe("A");

    await store.fetchDeliveries("B");

    expect(store.deliveries).toEqual([]);
    expect(store.deliveriesEndpoint).toBeNull();
  });

  // A late answer for an earlier search never replaces the latest one.
  it("drops a late answer for an endpoint no longer searched", async () => {
    let answerA!: (v: unknown) => void;
    mocks.listDeliveries
      .mockReturnValueOnce(new Promise((r) => (answerA = r)))
      .mockResolvedValueOnce(page(["b1"]));
    const store = useWebhooksStore();

    const loadingA = store.fetchDeliveries("A");
    await store.fetchDeliveries("B");
    answerA(page(["a1"]));
    await loadingA;

    expect(store.deliveries.map((d) => d.deliveryId)).toEqual(["b1"]);
    expect(store.deliveriesEndpoint).toBe("B");
  });
});
