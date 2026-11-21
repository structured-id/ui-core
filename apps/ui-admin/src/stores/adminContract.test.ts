// Store behaviour on the current admin API contract: test sends of email and
// notifications answer Empty and refuse with a google.rpc.Status, whose text
// for people (LocalizedMessage) is what the stores report; a machine user's
// roles are its role assignments, listed by the machine user filter.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { BinaryWriter } from "@protobuf-ts/runtime";
import { RpcError } from "@protobuf-ts/runtime-rpc";

const mocks = vi.hoisted(() => ({
  sendTestNotification: vi.fn(),
  testEmailConnection: vi.fn(),
  listRoleAssignments: vi.fn(),
}));

vi.mock("@structured-id/ui-core", async (importActual) => ({
  ...(await importActual<typeof import("@structured-id/ui-core")>()),
  getTransport: () => ({}),
}));

vi.mock("@structured-id/proto/sid/v1/admin/notifications.client", () => ({
  NotificationTemplateServiceClient: class {
    sendTestNotification = mocks.sendTestNotification;
  },
}));

vi.mock("@structured-id/proto/sid/v1/admin/settings.client", () => ({
  RealmServiceClient: class {
    testEmailConnection = mocks.testEmailConnection;
  },
  FeatureServiceClient: class {},
}));

vi.mock("@structured-id/proto/sid/v1/authz/authz.client", () => ({
  AuthzServiceClient: class {
    listRoleAssignments = mocks.listRoleAssignments;
  },
}));

import { useNotificationsStore } from "./notifications";
import { useSettingsStore } from "./settings";
import { useRolesStore } from "./roles";
import { NotificationChannel } from "@structured-id/proto/sid/v1/admin/notifications";
import { MachineUserId } from "@structured-id/ids";

/** A refusal as the server sends it: Status with a LocalizedMessage detail. */
function refusal(text: string): RpcError {
  const localized = new BinaryWriter()
    .tag(1, 2)
    .string("en")
    .tag(2, 2)
    .string(text)
    .finish();
  const any = new BinaryWriter()
    .tag(1, 2)
    .string("type.googleapis.com/google.rpc.LocalizedMessage")
    .tag(2, 2)
    .bytes(localized)
    .finish();
  const status = new BinaryWriter()
    .tag(1, 0)
    .int32(9)
    .tag(2, 2)
    .string("provider not configured")
    .tag(3, 2)
    .bytes(any)
    .finish();
  const b64 = btoa(String.fromCharCode(...status));
  return new RpcError("provider not configured", "FAILED_PRECONDITION", {
    "grpc-status-details-bin": b64,
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe("test notification send", () => {
  it("resolves when the channel accepted it", async () => {
    mocks.sendTestNotification.mockResolvedValue({ response: {} });
    const store = useNotificationsStore();
    await expect(
      store.sendTestNotification("welcome", NotificationChannel.EMAIL, "en"),
    ).resolves.toBeUndefined();
    expect(store.error).toBeNull();
  });

  // A refused send is no longer a success response with an error field: the
  // store must report the refusal's text for people, not the status message.
  it("reports the refusal's text when the send is refused", async () => {
    mocks.sendTestNotification.mockRejectedValue(
      refusal("No email channel is configured."),
    );
    const store = useNotificationsStore();
    await expect(
      store.sendTestNotification("welcome", NotificationChannel.EMAIL, "en"),
    ).rejects.toBeInstanceOf(RpcError);
    expect(store.error).toBe("No email channel is configured.");
  });
});

describe("email connection test", () => {
  it("resolves when the provider answers", async () => {
    mocks.testEmailConnection.mockResolvedValue({ response: {} });
    const store = useSettingsStore();
    await expect(store.testEmailConnection()).resolves.toBeUndefined();
    expect(store.error).toBeNull();
  });

  it("reports the refusal's text when the provider is refused", async () => {
    mocks.testEmailConnection.mockRejectedValue(
      refusal("The email provider did not answer."),
    );
    const store = useSettingsStore();
    await expect(store.testEmailConnection()).rejects.toBeInstanceOf(RpcError);
    expect(store.error).toBe("The email provider did not answer.");
  });
});

describe("machine user roles", () => {
  // A machine user's roles are role assignments of its principal; the store
  // lists them by the machine user filter, not from the machine user record.
  it("lists the assignments the machine user holds", async () => {
    const machineUser = MachineUserId.parse(
      "0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d60",
    );
    const assignment = {
      id: { value: new Uint8Array(16).fill(1) },
      roleId: { value: new Uint8Array(16).fill(2) },
    };
    mocks.listRoleAssignments.mockResolvedValue({
      response: { assignments: [assignment] },
    });
    const store = useRolesStore();
    await store.fetchMachineUserAssignments(machineUser);
    expect(mocks.listRoleAssignments).toHaveBeenCalledWith({
      filter: {
        oneofKind: "machineUserId",
        machineUserId: machineUser.toWire(),
      },
    });
    expect(store.assignments).toEqual([assignment]);
  });
});
