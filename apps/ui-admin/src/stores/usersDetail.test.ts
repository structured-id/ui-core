import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ProfileId } from "@structured-id/ids";

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  listCredentials: vi.fn(),
  listSessions: vi.fn(),
}));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/identity/identity.client", () => ({
  IdentityServiceClient: class {
    getProfile = mocks.getProfile;
    listCredentials = mocks.listCredentials;
    listSessions = mocks.listSessions;
  },
}));

import { useUsersStore } from "./users";

const A = ProfileId.parse("0192f3a4-7c1e-7b2a-9d4e-00000000000a");
const B = ProfileId.parse("0192f3a4-7c1e-7b2a-9d4e-00000000000b");

describe("users store: one user's detail", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: opening user B kept A's credentials and sessions on screen,
  // with revoke buttons, until B's answered (forever if they failed). The
  // detail of another user starts empty.
  it("starts another user's detail empty", async () => {
    mocks.getProfile.mockResolvedValue({
      response: { profile: { username: "a" } },
    });
    mocks.listCredentials.mockResolvedValueOnce({
      response: { credentials: [{ label: "a-key" }] },
    });
    mocks.listSessions.mockResolvedValueOnce({
      response: { sessions: [{ ipAddress: "1" }] },
    });
    const store = useUsersStore();
    await store.getProfile(A);
    await store.fetchCredentials(A);
    await store.fetchSessions(A);

    mocks.listCredentials.mockRejectedValueOnce(new Error("UNAVAILABLE"));
    mocks.listSessions.mockRejectedValueOnce(new Error("UNAVAILABLE"));
    await store.getProfile(B);
    await store.fetchCredentials(B);
    await store.fetchSessions(B);

    expect(store.credentials).toEqual([]);
    expect(store.sessions).toEqual([]);
  });

  // An answer for a user no longer shown is dropped.
  it("ignores a late answer for the previous user", async () => {
    let answerA!: (v: unknown) => void;
    mocks.getProfile.mockResolvedValue({ response: { profile: {} } });
    mocks.listCredentials
      .mockReturnValueOnce(new Promise((r) => (answerA = r)))
      .mockResolvedValueOnce({ response: { credentials: [] } });
    const store = useUsersStore();
    await store.getProfile(A);
    const lateA = store.fetchCredentials(A);

    await store.getProfile(B);
    await store.fetchCredentials(B);
    answerA({ response: { credentials: [{ label: "a-key" }] } });
    await lateA;

    expect(store.credentials).toEqual([]);
  });
});
