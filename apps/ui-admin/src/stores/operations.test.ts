import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({ updateDefaultPreferences: vi.fn() }));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/admin/operations.client", () => ({
  FeatureFlagServiceClient: class {},
  SystemHealthServiceClient: class {},
  NotificationChannelServiceClient: class {
    updateDefaultPreferences = mocks.updateDefaultPreferences;
  },
}));

import { useOperationsStore } from "./operations";
import type { DefaultNotificationPreferences } from "@structured-id/proto/sid/v1/admin/operations";

/** Preferences shaped as the page holds them; only the fields under test. */
function prefs(...rows: object[]): DefaultNotificationPreferences {
  return { preferences: rows } as unknown as DefaultNotificationPreferences;
}

type Row = DefaultNotificationPreferences["preferences"][number];

describe("operations store: default preferences", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: an answer to an earlier save replaced the preferences after
  // the administrator had changed another toggle, so the newer change was
  // lost and the next save sent the old values. An answer arriving after a
  // later edit leaves that edit in place.
  it("keeps an edit made while a save is in flight", async () => {
    let answer!: (v: unknown) => void;
    mocks.updateDefaultPreferences.mockReturnValueOnce(
      new Promise((resolve) => (answer = resolve)),
    );
    const store = useOperationsStore();
    store.defaultPreferences = prefs({ eventType: "a", email: true });
    store.preferencesEdited();

    const saving = store.updateDefaultPreferences();
    store.defaultPreferences!.preferences[0] = {
      eventType: "a",
      email: false,
    } as unknown as Row;
    store.preferencesEdited();
    answer({ response: { preferences: [{ eventType: "a", email: true }] } });
    await saving;

    expect(store.defaultPreferences!.preferences[0]).toMatchObject({
      email: false,
    });
  });

  // Without a later edit the server's answer is the state shown.
  it("applies the answer when nothing changed meanwhile", async () => {
    mocks.updateDefaultPreferences.mockResolvedValueOnce({
      response: { preferences: [{ eventType: "a", email: true, sms: true }] },
    });
    const store = useOperationsStore();
    store.defaultPreferences = prefs({ eventType: "a", email: true });
    store.preferencesEdited();

    await store.updateDefaultPreferences();

    expect(store.defaultPreferences!.preferences[0]).toMatchObject({
      sms: true,
    });
  });
});
