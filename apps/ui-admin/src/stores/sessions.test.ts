import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({ listSessions: vi.fn() }));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/admin/sessions.client", () => ({
  SessionServiceClient: class {
    listSessions = mocks.listSessions;
  },
}));

import { useSessionsStore } from "./sessions";

describe("sessions store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: only the first 25 matching sessions were kept, and the table
  // pages locally, so later sessions could not be seen or revoked. Every
  // page is read under the same filters.
  it("reads every page under the same filters", async () => {
    mocks.listSessions
      .mockResolvedValueOnce({
        response: {
          sessions: [{ ipAddress: "a" }],
          totalCount: 2,
          nextPageToken: "t1",
        },
      })
      .mockResolvedValueOnce({
        response: {
          sessions: [{ ipAddress: "b" }],
          totalCount: 2,
          nextPageToken: "",
        },
      });
    const store = useSessionsStore();

    await store.fetchSessions({ clientId: "app" });

    const requests = mocks.listSessions.mock.calls.map((c) => c[0]);
    expect(requests.map((r) => r.pageToken)).toEqual(["", "t1"]);
    expect(requests.every((r) => r.clientId === "app")).toBe(true);
    expect(store.sessions.map((s) => s.ipAddress)).toEqual(["a", "b"]);
    expect(store.totalCount).toBe(2);
  });
});
