import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({
  getChannelConfig: vi.fn(),
  updateChannelConfig: vi.fn(),
}));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/admin/operations.client", () => ({
  FeatureFlagServiceClient: class {},
  SystemHealthServiceClient: class {},
  NotificationChannelServiceClient: class {
    getChannelConfig = mocks.getChannelConfig;
    updateChannelConfig = mocks.updateChannelConfig;
  },
}));

import { useOperationsStore } from "./operations";

// ChannelType: EMAIL 1, SMS 2.
describe("operations store: channel configuration", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: opening SMS after email showed email's configuration under
  // the SMS heading (for good if SMS failed), and saving it changed email.
  // Another channel's configuration starts empty.
  it("clears the previous channel's configuration", async () => {
    mocks.getChannelConfig
      .mockResolvedValueOnce({ response: { channel: 1, enabled: true } })
      .mockRejectedValueOnce(new Error("UNAVAILABLE"));
    const store = useOperationsStore();
    await store.fetchChannelConfig(1);

    await store.fetchChannelConfig(2);

    expect(store.channelConfig).toBeNull();
  });

  // Regression: an email save answered after SMS was opened replaced the
  // SMS configuration. A save's answer applies only to its own channel.
  it("keeps another channel opened during a save", async () => {
    mocks.getChannelConfig
      .mockResolvedValueOnce({ response: { channel: 1, enabled: true } })
      .mockResolvedValueOnce({ response: { channel: 2, enabled: false } });
    let answer!: (v: unknown) => void;
    mocks.updateChannelConfig.mockReturnValueOnce(
      new Promise((r) => (answer = r)),
    );
    const store = useOperationsStore();
    await store.fetchChannelConfig(1);

    const saving = store.updateChannelConfig({ channel: 1 } as never);
    await store.fetchChannelConfig(2);
    answer({ response: { channel: 1, enabled: false } });

    expect(await saving).toBe(false);
    expect(store.channelConfig?.channel).toBe(2);
  });

  // A late answer for a channel no longer shown is dropped.
  it("ignores a late answer for the previous channel", async () => {
    let answerEmail!: (v: unknown) => void;
    mocks.getChannelConfig
      .mockReturnValueOnce(new Promise((r) => (answerEmail = r)))
      .mockResolvedValueOnce({ response: { channel: 2, enabled: false } });
    const store = useOperationsStore();

    const email = store.fetchChannelConfig(1);
    await store.fetchChannelConfig(2);
    answerEmail({ response: { channel: 1, enabled: true } });
    await email;

    expect(store.channelConfig?.channel).toBe(2);
  });
});
