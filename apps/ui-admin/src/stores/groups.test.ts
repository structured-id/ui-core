import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { GroupId, ProfileId } from "@structured-id/ids";

const mocks = vi.hoisted(() => ({
  listGroupMembers: vi.fn(),
  removeFromGroup: vi.fn().mockResolvedValue({ response: {} }),
  getGroup: vi.fn(),
  updateGroup: vi.fn(),
}));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/authz/authz.client", () => ({
  AuthzServiceClient: class {
    listGroupMembers = mocks.listGroupMembers;
    removeFromGroup = mocks.removeFromGroup;
    getGroup = mocks.getGroup;
    updateGroup = mocks.updateGroup;
  },
}));

import { useGroupsStore } from "./groups";

const A = GroupId.parse("0192f3a4-7c1e-7b2a-9d4e-00000000000a");
const B = GroupId.parse("0192f3a4-7c1e-7b2a-9d4e-00000000000b");
const ALICE = ProfileId.parse("0192f3a4-7c1e-7b2a-9d4e-0000000000a1");

describe("groups store: shown group", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: a late load or save of A replaced B's detail after B was
  // opened; B's page then saved and acted on A.
  it("keeps another group opened during a load or a save", async () => {
    let loadA!: (v: unknown) => void;
    mocks.getGroup
      .mockReturnValueOnce(new Promise((r) => (loadA = r)))
      .mockResolvedValueOnce({
        response: { group: { id: B.toWire(), name: "b" } },
      });
    const store = useGroupsStore();

    const loadingA = store.getGroup(A);
    await store.getGroup(B);
    loadA({ response: { group: { id: A.toWire(), name: "a" } } });
    await loadingA;
    expect(store.currentGroup?.name).toBe("b");

    mocks.updateGroup.mockResolvedValueOnce({
      response: { group: { id: A.toWire(), name: "a2" } },
    });
    await store.updateGroup(A, "x");
    expect(store.currentGroup?.name).toBe("b");
  });
});

describe("groups store: members", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: opening group B kept A's members on screen while B loaded
  // (and for good when it failed), and removing one of those rows sent B's
  // id. Members belong to the group that answered them.
  it("clears the previous group's members and acts on their own group", async () => {
    mocks.listGroupMembers
      .mockResolvedValueOnce({ response: { profileIds: [ALICE.toWire()] } })
      .mockRejectedValueOnce(new Error("UNAVAILABLE"));
    const store = useGroupsStore();
    await store.fetchMembers(A);
    expect(store.members).toHaveLength(1);

    await store.fetchMembers(B);
    expect(store.members).toEqual([]);
    expect(store.membersOf?.equals(B)).toBe(true);
  });

  // Removal targets the group the shown rows came from.
  it("removes a member from the group the rows belong to", async () => {
    mocks.listGroupMembers.mockResolvedValueOnce({
      response: { profileIds: [ALICE.toWire()] },
    });
    const store = useGroupsStore();
    await store.fetchMembers(A);

    await store.removeMember(ALICE);

    expect(mocks.removeFromGroup).toHaveBeenCalledWith({
      groupId: A.toWire(),
      profileId: ALICE.toWire(),
    });
    expect(store.members).toEqual([]);
  });

  // An answer for a group no longer shown is dropped.
  it("ignores members answered for a group no longer shown", async () => {
    let answerA!: (v: unknown) => void;
    mocks.listGroupMembers
      .mockReturnValueOnce(new Promise((r) => (answerA = r)))
      .mockResolvedValueOnce({ response: { profileIds: [] } });
    const store = useGroupsStore();

    const first = store.fetchMembers(A);
    await store.fetchMembers(B);
    answerA({ response: { profileIds: [ALICE.toWire()] } });
    await first;

    expect(store.members).toEqual([]);
    expect(store.membersOf?.equals(B)).toBe(true);
  });
});
