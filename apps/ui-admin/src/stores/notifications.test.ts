import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({ getTemplate: vi.fn() }));

vi.mock("@structured-id/ui-core", () => ({
  getAccountTransport: () => ({}),
  refusalMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.mock("@structured-id/proto/sid/v1/admin/notifications.client", () => ({
  NotificationTemplateServiceClient: class {
    getTemplate = mocks.getTemplate;
  },
}));

import { useNotificationsStore } from "./notifications";

/** A request answered when `release` is called. */
function deferred(templateId: string) {
  let release!: () => void;
  const answered = new Promise<{ response: { templateId: string } }>(
    (resolve) => {
      release = () => resolve({ response: { templateId } });
    },
  );
  return { answered, release };
}

describe("notifications store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: selecting A then B, with A's answer arriving last, left A
  // loaded while B stayed selected, so saving wrote A's content into B. Only
  // the latest request's answer is applied.
  it("ignores an answer to an earlier selection", async () => {
    const a = deferred("a");
    const b = deferred("b");
    mocks.getTemplate
      .mockReturnValueOnce(a.answered)
      .mockReturnValueOnce(b.answered);
    const store = useNotificationsStore();

    const first = store.fetchTemplate("a", 1, "en");
    const second = store.fetchTemplate("b", 1, "en");
    b.release();
    expect(await second).toBe(true);
    a.release();
    expect(await first).toBe(false);

    expect(store.currentTemplate?.templateId).toBe("b");
  });
});
