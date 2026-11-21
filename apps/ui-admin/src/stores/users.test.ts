import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({ listProfiles: vi.fn() }));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/identity/identity.client", () => ({
  IdentityServiceClient: class {
    listProfiles = mocks.listProfiles;
  },
}));

import { useUsersStore } from "./users";

describe("users store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: only the first page was kept, so the console's search and
  // table never reached profiles past it. Every page is read, each with the
  // token the previous answer gave.
  it("reads every page of profiles", async () => {
    mocks.listProfiles
      .mockResolvedValueOnce({
        response: { profiles: [{ username: "a" }], nextPageToken: "t1" },
      })
      .mockResolvedValueOnce({
        response: { profiles: [{ username: "b" }], nextPageToken: "" },
      });
    const store = useUsersStore();

    await store.fetchProfiles();

    expect(mocks.listProfiles.mock.calls.map((c) => c[0].pageToken)).toEqual([
      "",
      "t1",
    ]);
    expect(store.profiles.map((p) => p.username)).toEqual(["a", "b"]);
  });

  // A failed later page leaves the earlier list in place and reports.
  it("keeps the previous list when a page fails", async () => {
    mocks.listProfiles
      .mockResolvedValueOnce({
        response: { profiles: [{ username: "a" }], nextPageToken: "" },
      })
      .mockResolvedValueOnce({
        response: { profiles: [{ username: "x" }], nextPageToken: "t1" },
      })
      .mockRejectedValueOnce(new Error("UNAVAILABLE"));
    const store = useUsersStore();
    await store.fetchProfiles();

    await store.fetchProfiles();

    expect(store.profiles.map((p) => p.username)).toEqual(["a"]);
    expect(store.error).toBe("UNAVAILABLE");
  });
});
