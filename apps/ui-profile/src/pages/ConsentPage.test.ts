import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  getConsent: vi.fn(),
  getFlowState: vi.fn(),
  submitConsent: vi.fn(),
}));

// Wire enum values, as protobuf-ts generates them; hoisted with the mock.
const { SHARING, DECISION } = vi.hoisted(() => ({
  SHARING: { UNSPECIFIED: 0, NONE: 1, STATIC: 2, SUBSCRIBED: 3 },
  DECISION: { UNSPECIFIED: 0, APPROVE: 1, DENY: 2 },
}));

vi.mock("@structured-id/ui-core/profile", () => ({
  ClaimSharing: SHARING,
  ConsentDecision: DECISION,
  getConsent: api.getConsent,
  getFlowState: api.getFlowState,
  submitConsent: api.submitConsent,
}));

vi.mock("@structured-id/ui-core", () => ({
  refusalMessage: (_e: unknown, fallback: string) => fallback,
}));

const query: Record<string, string> = {};
vi.mock("vue-router", () => ({ useRoute: () => ({ query }) }));

import ConsentPage from "./ConsentPage.vue";

const OPERATION = "0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d9e";

const REVIEW = {
  operationId: { value: new Uint8Array(16) },
  revision: 3n,
  csrfToken: new Uint8Array([1]),
  issuer: "https://sid.example.com",
  clientId: "app",
  clientName: "App",
  resource: "",
  scopes: ["openid"],
  identityDisplayName: "alice",
  claims: [
    // Required, only subscribed sharing allowed.
    { name: "email", level: 1, allowed: [SHARING.SUBSCRIBED], type: 0 },
    // Optional, static allowed.
    {
      name: "phone",
      level: 2,
      allowed: [SHARING.NONE, SHARING.STATIC],
      type: 0,
    },
  ],
};

const assign = vi.fn();

function mountPage() {
  return mount(ConsentPage, {
    global: {
      stubs: {
        CeremonyFrame: { template: "<div><slot /></div>" },
        QCard: { template: "<div><slot /></div>" },
        QCardSection: { template: "<div><slot /></div>" },
        QCardActions: { template: "<div><slot /></div>" },
        QList: { template: "<div><slot /></div>" },
        QItem: { template: "<div><slot /></div>" },
        QItemSection: { template: "<div><slot /></div>" },
        QItemLabel: { template: "<div><slot /></div>" },
        QChip: { template: "<span><slot /></span>" },
        QSkeleton: true,
        QBanner: { template: "<div class='banner'><slot /></div>" },
        QToggle: {
          props: ["modelValue", "disable"],
          emits: ["update:modelValue"],
          template:
            "<input type='checkbox' :checked='modelValue' :disabled='disable' @change=\"$emit('update:modelValue', $event.target.checked)\" />",
        },
        QBtn: {
          props: ["label"],
          emits: ["click"],
          template: "<button @click=\"$emit('click')\">{{ label }}</button>",
        },
      },
    },
  });
}

describe("ConsentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.operation = OPERATION;
    vi.stubGlobal("location", {
      origin: "https://sid.example.com",
      assign,
    });
  });

  // An approval sends one choice per reviewed claim: a shared claim with the
  // sharing it allows (static preferred), a declined optional one as none;
  // then the browser follows the issuer's continuation.
  it("approves with one choice per claim and continues", async () => {
    api.getConsent.mockResolvedValue(REVIEW);
    api.submitConsent.mockResolvedValue({
      step: 2,
      continuationUri: "https://sid.example.com/oauth2/authorize?op=x",
    });
    const w = mountPage();
    await flushPromises();

    await w.findAll("input")[1].setValue(false);
    await w
      .findAll("button")
      .find((b) => b.text() === "Allow")!
      .trigger("click");
    await flushPromises();

    expect(api.submitConsent).toHaveBeenCalledWith(REVIEW, DECISION.APPROVE, [
      { name: "email", sharing: SHARING.SUBSCRIBED },
      { name: "phone", sharing: SHARING.NONE },
    ]);
    expect(assign).toHaveBeenCalledWith(
      "https://sid.example.com/oauth2/authorize?op=x",
    );
  });

  // A required claim cannot be switched off on the page.
  it("does not let a required claim be declined", async () => {
    api.getConsent.mockResolvedValue(REVIEW);
    const w = mountPage();
    await flushPromises();

    expect(w.findAll("input")[0].attributes("disabled")).toBeDefined();
  });

  // The continuation is the issuer's own endpoint; an address on another
  // origin is never followed.
  it("refuses to follow a continuation to another origin", async () => {
    api.getConsent.mockResolvedValue(REVIEW);
    api.submitConsent.mockResolvedValue({
      step: 3,
      continuationUri: "https://evil.example.org/x",
    });
    const w = mountPage();
    await flushPromises();

    await w
      .findAll("button")
      .find((b) => b.text() === "Deny")!
      .trigger("click");
    await flushPromises();

    expect(assign).not.toHaveBeenCalled();
    expect(w.find(".banner").text()).toContain("elsewhere");
  });

  // A reload after the decision finds the operation decided: the page
  // continues where the issuer says instead of reviewing again.
  it("continues an operation already decided", async () => {
    api.getConsent.mockRejectedValue(new Error("FAILED_PRECONDITION"));
    api.getFlowState.mockResolvedValue({
      step: 2,
      continuationUri: "https://sid.example.com/oauth2/authorize?op=y",
    });
    mountPage();
    await flushPromises();

    expect(assign).toHaveBeenCalledWith(
      "https://sid.example.com/oauth2/authorize?op=y",
    );
  });
});
