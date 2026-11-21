import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { MachineUserId } from "@structured-id/ids";

const mocks = vi.hoisted(() => ({
  getMachineUser: vi.fn(),
  updateMachineUser: vi.fn(),
  suspendMachineUser: vi.fn(),
  reactivateMachineUser: vi.fn(),
}));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/machine/machine_user.client", () => ({
  MachineUserServiceClient: class {
    getMachineUser = mocks.getMachineUser;
    updateMachineUser = mocks.updateMachineUser;
    suspendMachineUser = mocks.suspendMachineUser;
    reactivateMachineUser = mocks.reactivateMachineUser;
  },
}));

import { useMachineUsersStore } from "./machineUsers";

const A = MachineUserId.parse("0192f3a4-7c1e-7b2a-9d4e-00000000000a");
const B = MachineUserId.parse("0192f3a4-7c1e-7b2a-9d4e-00000000000b");

const answer = (id: MachineUserId, displayName: string) => ({
  response: { machineUser: { id: id.toWire(), displayName } },
});

describe("machine users store: changes of an account no longer shown", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: saving, suspending or reactivating A, then opening B,
  // replaced B's detail with A's answer; B's page then acted on A.
  it.each(["updateMachineUser", "suspendMachineUser", "reactivateMachineUser"])(
    "%s keeps the account opened since",
    async (method) => {
      mocks.getMachineUser.mockResolvedValueOnce(answer(B, "b"));
      (mocks as Record<string, ReturnType<typeof vi.fn>>)[
        method
      ].mockResolvedValueOnce(answer(A, "a2"));
      const store = useMachineUsersStore();
      await store.getMachineUser(B);

      if (method === "updateMachineUser") {
        await store.updateMachineUser(A, {
          displayName: "a2",
          description: "",
          scopes: [],
          ipAllowlist: [],
          rateLimitRpm: 0,
          maxTokenLifetime: 0,
        });
      } else if (method === "suspendMachineUser") {
        await store.suspendMachineUser(A);
      } else {
        await store.reactivateMachineUser(A);
      }

      expect(store.currentMachineUser?.displayName).toBe("b");
    },
  );
});
