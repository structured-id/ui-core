import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({
  getTemplate: vi.fn(),
  updateTemplate: vi.fn(),
}));

vi.mock("@structured-id/ui-core", () => ({
  getAccountTransport: () => ({}),
  refusalMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.mock("@structured-id/proto/sid/v1/admin/notifications.client", () => ({
  NotificationTemplateServiceClient: class {
    getTemplate = mocks.getTemplate;
    updateTemplate = mocks.updateTemplate;
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

  // Regression: a save of A answered after B was loaded replaced B with A.
  // The answer of a save applies only to the template still loaded.
  it("keeps another template loaded during a save", async () => {
    mocks.getTemplate
      .mockResolvedValueOnce({ response: { templateId: "a" } })
      .mockResolvedValueOnce({ response: { templateId: "b" } });
    let answer!: (v: unknown) => void;
    mocks.updateTemplate.mockReturnValueOnce(
      new Promise((resolve) => (answer = resolve)),
    );
    const store = useNotificationsStore();
    await store.fetchTemplate("a", 1, "en");

    const saving = store.updateTemplate("a", {
      channel: 1,
      locale: "en",
    } as never);
    await store.fetchTemplate("b", 1, "en");
    answer({ response: { templateId: "a", customized: true } });

    expect(await saving).toBe(false);
    expect(store.currentTemplate?.templateId).toBe("b");
  });
});
