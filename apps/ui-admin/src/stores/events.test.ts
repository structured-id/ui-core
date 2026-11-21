import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({ listEvents: vi.fn() }));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/admin/events.client", () => ({
  EventServiceClient: class {
    listEvents = mocks.listEvents;
  },
  AuditServiceClient: class {},
}));

import { useEventsStore } from "./events";

describe("events store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: the live stream polled through the search action, so every
  // poll replaced the filtered User Events results with unfiltered stream
  // events. A stream poll answers its page and leaves the search alone.
  it("polls the stream without replacing the search results", async () => {
    mocks.listEvents
      .mockResolvedValueOnce({
        response: {
          events: [{ id: "searched" }],
          totalCount: 1,
          nextPageToken: "",
        },
      })
      .mockResolvedValueOnce({
        response: {
          events: [{ id: "streamed" }],
          totalCount: 99,
          nextPageToken: "n",
        },
      });
    const store = useEventsStore();
    await store.fetchEvents({ pageSize: 25, pageToken: "", profileId: "p" });

    const page = await store.pollEvents({ pageSize: 10, pageToken: "" });

    expect(page.events.map((e) => e.id)).toEqual(["streamed"]);
    expect(page.nextPageToken).toBe("n");
    expect(store.events.map((e) => e.id)).toEqual(["searched"]);
    expect(store.eventsTotalCount).toBe(1);
  });
});
