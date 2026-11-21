import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({ listUsers: vi.fn(), listGroups: vi.fn() }));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/scim/scim.client", () => ({
  ScimServiceClient: class {
    listUsers = mocks.listUsers;
    listGroups = mocks.listGroups;
  },
}));

import { useScimStore } from "./scim";

describe("scim store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: only the first 25 users were ever requested while the table
  // paged locally. A table page is a SCIM page: its 1-based start index and
  // count (RFC 7644 section 3.4.2.4), under the search's filter.
  it("requests the table's page of users", async () => {
    mocks.listUsers.mockResolvedValue({
      response: { resources: [{ id: "u26" }], totalResults: 60 },
    });
    const store = useScimStore();

    await store.fetchUsers('userName sw "a"', { page: 2, rowsPerPage: 25 });

    expect(mocks.listUsers).toHaveBeenCalledWith({
      filter: 'userName sw "a"',
      startIndex: 26,
      count: 25,
    });
    expect(store.usersTotalResults).toBe(60);
  });

  // Groups page the same way.
  it("requests the table's page of groups", async () => {
    mocks.listGroups.mockResolvedValue({
      response: { resources: [], totalResults: 0 },
    });
    const store = useScimStore();

    await store.fetchGroups("", { page: 3, rowsPerPage: 10 });

    expect(mocks.listGroups).toHaveBeenCalledWith({
      filter: "",
      startIndex: 21,
      count: 10,
    });
  });
});
