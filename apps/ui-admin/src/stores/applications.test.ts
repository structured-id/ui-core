import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ProjectId } from "@structured-id/ids";

const mocks = vi.hoisted(() => ({ listApplications: vi.fn() }));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/projects/projects.client", () => ({
  ProjectServiceClient: class {
    listApplications = mocks.listApplications;
  },
}));

import { useApplicationsStore } from "./applications";

describe("applications store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: only the first page was kept, and the list page searches
  // and pages locally, so applications past it could not be administered.
  it("reads every page of the project's applications", async () => {
    mocks.listApplications
      .mockResolvedValueOnce({
        response: { applications: [{ name: "a" }], nextPageToken: "t1" },
      })
      .mockResolvedValueOnce({
        response: { applications: [{ name: "b" }], nextPageToken: "" },
      });
    const store = useApplicationsStore();

    await store.fetchApplications(ProjectId.system());

    expect(
      mocks.listApplications.mock.calls.map((c) => c[0].pageToken),
    ).toEqual(["", "t1"]);
    expect(store.applications.map((a) => a.name)).toEqual(["a", "b"]);
  });
});
