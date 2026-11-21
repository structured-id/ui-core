import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { RoleId } from "@structured-id/ids";

const mocks = vi.hoisted(() => ({ getRole: vi.fn(), updateRole: vi.fn() }));

vi.mock("@structured-id/ui-core", () => ({
  getAccountTransport: () => ({}),
  refusalMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.mock("@structured-id/proto/sid/v1/authz/authz.client", () => ({
  AuthzServiceClient: class {
    getRole = mocks.getRole;
    updateRole = mocks.updateRole;
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
});
