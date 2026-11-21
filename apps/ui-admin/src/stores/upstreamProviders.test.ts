import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { UpstreamProviderId } from "@structured-id/ids";

const mocks = vi.hoisted(() => ({ getUpstreamProvider: vi.fn() }));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/federation/upstream.client", () => ({
  UpstreamServiceClient: class {
    getUpstreamProvider = mocks.getUpstreamProvider;
  },
}));

import { useUpstreamProvidersStore } from "./upstreamProviders";

const A = UpstreamProviderId.parse("0192f3a4-7c1e-7b2a-9d4e-00000000000a");
const B = UpstreamProviderId.parse("0192f3a4-7c1e-7b2a-9d4e-00000000000b");

describe("upstream providers store: shown provider", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: opening B after A kept A shown while B loaded, and for good
  // when B failed, so disabling or deleting "B" acted on A.
  it("shows no other provider while another one loads or fails", async () => {
    mocks.getUpstreamProvider
      .mockResolvedValueOnce({ response: { provider: { id: A.toWire() } } })
      .mockRejectedValueOnce(new Error("UNAVAILABLE"));
    const store = useUpstreamProvidersStore();
    await store.getProvider(A);

    await expect(store.getProvider(B)).rejects.toThrow("UNAVAILABLE");

    expect(store.currentProvider).toBeNull();
  });

  // An earlier provider's late answer never replaces the one requested since.
  it("drops a late answer for a provider no longer requested", async () => {
    let answerA!: (v: unknown) => void;
    mocks.getUpstreamProvider
      .mockReturnValueOnce(new Promise((r) => (answerA = r)))
      .mockResolvedValueOnce({ response: { provider: { id: B.toWire() } } });
    const store = useUpstreamProvidersStore();

    const loadingA = store.getProvider(A);
    await store.getProvider(B);
    answerA({ response: { provider: { id: A.toWire() } } });
    await loadingA;

    expect(store.currentProvider?.id).toEqual(B.toWire());
  });
});
