import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ProjectId } from "@structured-id/ids";
import { BrandingStatus } from "@structured-id/proto/sid/v1/admin/branding";

const mocks = vi.hoisted(() => ({ listBrandingConfigs: vi.fn() }));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/admin/branding.client", () => ({
  BrandingServiceClient: class {
    listBrandingConfigs = mocks.listBrandingConfigs;
  },
}));

import { useBrandingStore } from "./branding";

const at = (seconds: number) => ({ seconds: BigInt(seconds), nanos: 0 });

describe("branding store: editable configuration", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: a saved draft was never shown again (the page read only the
  // published configuration) and so could never be published. The editor
  // opens the latest draft, else the published one.
  it("opens the latest draft before the published configuration", async () => {
    mocks.listBrandingConfigs.mockResolvedValueOnce({
      response: {
        configs: [
          { status: BrandingStatus.PUBLISHED, updatedAt: at(30) },
          { status: BrandingStatus.DRAFT, updatedAt: at(10) },
          { status: BrandingStatus.DRAFT, updatedAt: at(20) },
          { status: BrandingStatus.ARCHIVED, updatedAt: at(40) },
        ],
      },
    });
    const store = useBrandingStore();

    await store.loadEditable(ProjectId.system());

    expect(store.config?.status).toBe(BrandingStatus.DRAFT);
    expect(store.config?.updatedAt).toEqual(at(20));
  });

  // Without a draft the published configuration is edited; without either,
  // nothing is, and saving creates the first draft.
  it("opens the published configuration, or none", async () => {
    mocks.listBrandingConfigs
      .mockResolvedValueOnce({
        response: {
          configs: [
            { status: BrandingStatus.ARCHIVED, updatedAt: at(40) },
            { status: BrandingStatus.PUBLISHED, updatedAt: at(30) },
          ],
        },
      })
      .mockResolvedValueOnce({ response: { configs: [] } });
    const store = useBrandingStore();

    await store.loadEditable(ProjectId.system());
    expect(store.config?.status).toBe(BrandingStatus.PUBLISHED);

    await store.loadEditable(ProjectId.system());
    expect(store.config).toBeNull();
  });
});
