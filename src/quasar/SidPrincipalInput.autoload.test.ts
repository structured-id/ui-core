import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

// A module graph of its own: here no application started the email parser,
// so the field is what starts it.
vi.mock("../utils/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/email")>();
  const { TEST_PSL } = await import("../utils/email.testing");
  return {
    ...actual,
    // The field calls it without options; the test serves the trie itself.
    initEmail: vi.fn(() => actual.initEmail({ psl: TEST_PSL })),
  };
});

const stubs = {
  "q-input": { template: "<div />" },
  "q-icon": { template: "<span />" },
  "q-chip": { template: "<span />" },
};

describe("SidPrincipalInput starting the parser", () => {
  // Regression: the parser was started only on mount, so a field whose
  // accepted types came to include email later kept every email pending
  // and its form's submit disabled for good.
  it("starts it when the accepted types come to include email", async () => {
    const email = await import("../utils/email");
    const { default: SidPrincipalInput } =
      await import("./SidPrincipalInput.vue");
    const w = mount(SidPrincipalInput, {
      props: { modelValue: "alice@example.com", types: ["username"] },
      global: { stubs },
    });
    expect(email.initEmail).not.toHaveBeenCalled();
    await w.setProps({ types: ["email", "username"] });
    await vi.waitFor(() => expect(email.emailReady.value).toBe(true));
    await flushPromises();
    expect(email.initEmail).toHaveBeenCalled();
    expect(w.emitted("update:valid")?.at(-1)?.[0]).toBe(true);
  });
});
