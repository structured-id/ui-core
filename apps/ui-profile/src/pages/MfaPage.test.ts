import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  pending: null as null | {
    secondFactors: number[];
    enrollableFactors: number[];
  },
  verifyTotp: vi.fn(),
  verifyRecoveryCode: vi.fn(),
  startTotpEnrollment: vi.fn(),
  finishTotpEnrollment: vi.fn(),
  onLoginSuccess: vi.fn(),
}));

// StepUpMethod: TOTP 1, WEBAUTHN 2, RECOVERY_CODE 3.
vi.mock("@structured-id/ui-core/profile", () => ({
  SidMfaChallenge: {
    name: "SidMfaChallenge",
    props: ["methods", "title", "subtitle"],
    emits: ["submit-totp", "submit-recovery"],
    methods: {
      setLoading: () => {},
      setError: () => {},
      setSuccess: () => {},
    },
    template: "<div />",
  },
  pendingSignIn: () => api.pending,
  verifyTotp: api.verifyTotp,
  verifyRecoveryCode: api.verifyRecoveryCode,
  startTotpEnrollment: api.startTotpEnrollment,
  finishTotpEnrollment: api.finishTotpEnrollment,
  useLoginSuccess: () => ({ onLoginSuccess: api.onLoginSuccess }),
}));

vi.mock("@structured-id/ui-core", () => ({
  base32: () => "SECRET",
  totpKeyUri: () => "otpauth://totp/x",
  refusalMessage: (_e: unknown, fallback: string) => fallback,
}));

import MfaPage from "./MfaPage.vue";

const passthrough = { template: "<div><slot /><slot name='action' /></div>" };

function mountPage() {
  return mount(MfaPage, {
    global: {
      stubs: {
        CeremonyFrame: passthrough,
        QBanner: passthrough,
        QCard: passthrough,
        QCardSection: passthrough,
        QForm: { template: "<form><slot /></form>" },
        QInput: true,
        QBtn: true,
      },
    },
  });
}

function challenge(w: ReturnType<typeof mountPage>) {
  return w.findComponent({ name: "SidMfaChallenge" });
}

describe("MfaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.pending = null;
  });

  // Only the factors this page completes are offered, of those the account
  // has: a passkey second factor is not offered here.
  it("offers the account's authenticator and recovery codes", () => {
    api.pending = { secondFactors: [2, 1, 3], enrollableFactors: [] };
    const w = mountPage();
    const types = (challenge(w).props("methods") as { type: string }[]).map(
      (m) => m.type,
    );
    expect(types).toEqual(["totp", "recovery"]);
  });

  // A verified code that delivered the session continues the sign-in.
  it("continues the sign-in once a code delivers the session", async () => {
    api.pending = { secondFactors: [1], enrollableFactors: [] };
    api.verifyTotp.mockResolvedValue({ sessionId: "s" });
    const w = mountPage();

    challenge(w).vm.$emit("submit-totp", "123456");
    await flushPromises();

    expect(api.verifyTotp).toHaveBeenCalledWith("123456");
    expect(api.onLoginSuccess).toHaveBeenCalledWith({ sessionId: "s" });
  });

  // A refused code keeps the user on the page.
  it("stays on the page when the code is refused", async () => {
    api.pending = { secondFactors: [1], enrollableFactors: [] };
    api.verifyTotp.mockRejectedValue(new Error("refused"));
    const w = mountPage();

    challenge(w).vm.$emit("submit-totp", "000000");
    await flushPromises();

    expect(api.onLoginSuccess).not.toHaveBeenCalled();
  });

  // An account with no factor yet sets up an authenticator on the
  // sign-in surface first.
  it("starts the authenticator setup when the account has no factor", async () => {
    api.pending = { secondFactors: [], enrollableFactors: [1] };
    api.startTotpEnrollment.mockResolvedValue({
      sharedSecret: new Uint8Array(),
    });
    const w = mountPage();
    await flushPromises();

    expect(api.startTotpEnrollment).toHaveBeenCalledWith("sign-in");
    expect(w.text()).toContain("SECRET");
  });

  // Without a pending sign-in in this tab there is nothing to complete.
  it("says there is no sign-in to complete without one", () => {
    const w = mountPage();
    expect(w.text()).toContain("no sign-in waiting");
  });
});
