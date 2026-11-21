import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({
  listClaimMappings: vi.fn(),
  addClaimMapping: vi.fn(),
  updateClaimMapping: vi.fn(),
  deleteClaimMapping: vi.fn(),
}));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/admin/scopes.client", () => ({
  ScopeServiceClient: class {
    listClaimMappings = mocks.listClaimMappings;
    addClaimMapping = mocks.addClaimMapping;
    updateClaimMapping = mocks.updateClaimMapping;
    deleteClaimMapping = mocks.deleteClaimMapping;
  },
}));

import { useScopesStore } from "./scopes";

/** B's mappings as its list answers them; a fresh array each time, since
 *  the store keeps the answered array itself. */
const bMappings = () => [{ id: "m1", claimName: "b" }];

const mapping = (scopeId: string) => ({
  scopeId,
  claimName: "x",
  source: 0,
  sourceKey: "",
  staticValue: "",
  multivalued: false,
  addToIdToken: false,
  addToAccessToken: false,
  addToUserinfo: false,
});

describe("scopes store: claim mappings of the shown scope", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: a mapping added, updated or deleted for scope A that
  // answered after scope B was opened changed B's mappings; B's page then
  // acted on A's mapping under B's id.
  it("keeps the shown scope's mappings when a change of the former answers late", async () => {
    let addA!: (v: unknown) => void;
    let updateA!: (v: unknown) => void;
    let deleteA!: (v: unknown) => void;
    mocks.addClaimMapping.mockReturnValueOnce(new Promise((r) => (addA = r)));
    mocks.updateClaimMapping.mockReturnValueOnce(
      new Promise((r) => (updateA = r)),
    );
    mocks.deleteClaimMapping.mockReturnValueOnce(
      new Promise((r) => (deleteA = r)),
    );
    mocks.listClaimMappings
      .mockResolvedValueOnce({ response: { mappings: [{ id: "m1" }] } })
      .mockResolvedValueOnce({ response: { mappings: bMappings() } });
    const store = useScopesStore();

    await store.fetchClaimMappings("A");
    const adding = store.addClaimMapping(mapping("A"));
    const updating = store.updateClaimMapping({
      scopeId: "A",
      mappingId: "m1",
      claimName: "renamed",
    });
    const deleting = store.deleteClaimMapping("A", "m1");
    await store.fetchClaimMappings("B");

    addA({ response: { id: "m2" } });
    updateA({ response: { id: "m1", claimName: "renamed" } });
    deleteA({ response: {} });
    await Promise.all([adding, updating, deleting]);

    expect(store.claimMappings).toEqual(bMappings());
  });
});
