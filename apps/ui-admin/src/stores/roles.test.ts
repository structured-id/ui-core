import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { MachineUserId, ProfileId, RoleId } from "@structured-id/ids";

const mocks = vi.hoisted(() => ({
  getRole: vi.fn(),
  updateRole: vi.fn(),
  listRoleAssignments: vi.fn(),
  assignRole: vi.fn(),
}));

vi.mock("@structured-id/ui-core", () => ({
  getAccountTransport: () => ({}),
  refusalMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.mock("@structured-id/proto/sid/v1/authz/authz.client", () => ({
  AuthzServiceClient: class {
    getRole = mocks.getRole;
    updateRole = mocks.updateRole;
    listRoleAssignments = mocks.listRoleAssignments;
    assignRole = mocks.assignRole;
  },
}));

import { useRolesStore } from "./roles";

const A = RoleId.parse("0192f3a4-7c1e-7b2a-9d4e-00000000000a");
const B = RoleId.parse("0192f3a4-7c1e-7b2a-9d4e-00000000000b");

describe("roles store: role update", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: saving A and opening B before the answer replaced B's
  // detail with A, and later saves, assignments and deletes targeted A.
  it("keeps another role opened during a save", async () => {
    mocks.getRole
      .mockResolvedValueOnce({
        response: { role: { id: A.toWire(), name: "a" } },
      })
      .mockResolvedValueOnce({
        response: { role: { id: B.toWire(), name: "b" } },
      });
    let answer!: (v: unknown) => void;
    mocks.updateRole.mockReturnValueOnce(new Promise((r) => (answer = r)));
    const store = useRolesStore();
    await store.getRole(A);

    const saving = store.updateRole(A, { permissions: ["x"] });
    await store.getRole(B);
    answer({ response: { role: { id: A.toWire(), name: "a2" } } });
    await saving;

    expect(store.currentRole?.name).toBe("b");
  });

  // Regression: an assignment of role A answered after role B's
  // assignments were shown joined B's list, where revoking it acted on A.
  // An assignment joins only the list of its own role, or of the service
  // account it was given to.
  it("adds an assignment only to the list it belongs to", async () => {
    const PROFILE = ProfileId.parse("0192f3a4-7c1e-7b2a-9d4e-0000000000a1");
    const MACHINE = MachineUserId.parse("0192f3a4-7c1e-7b2a-9d4e-0000000000c1");
    // A fresh list each time: the store keeps the answered array itself.
    mocks.listRoleAssignments.mockImplementation(async () => ({
      response: { assignments: [] },
    }));
    let assignA!: (v: unknown) => void;
    mocks.assignRole
      .mockReturnValueOnce(new Promise((r) => (assignA = r)))
      .mockResolvedValueOnce({ response: { assignment: { scope: "own" } } })
      .mockResolvedValueOnce({ response: { assignment: { scope: "mu" } } });
    const store = useRolesStore();

    await store.fetchRoleAssignments(A);
    const assigning = store.assignRole({
      roleId: A,
      principal: { kind: "profile", id: PROFILE },
    });
    await store.fetchRoleAssignments(B);
    assignA({ response: { assignment: { scope: "late" } } });
    await assigning;
    expect(store.assignments).toEqual([]);

    await store.assignRole({
      roleId: B,
      principal: { kind: "profile", id: PROFILE },
    });
    expect(store.assignments).toEqual([{ scope: "own" }]);

    await store.fetchMachineUserAssignments(MACHINE);
    await store.assignRole({
      roleId: A,
      principal: { kind: "machineUser", id: MACHINE },
    });
    expect(store.assignments).toEqual([{ scope: "mu" }]);
  });
});
