import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, shallowMount } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  getInstanceStatus: vi.fn(),
  getEnrollmentPolicy: vi.fn(),
}));

vi.mock("@structured-id/ui-core/profile", () => ({
  AdministratorClaim: { UNSPECIFIED: 0, OPEN: 1, CLAIMED: 2 },
  EnrollmentMode: { UNSPECIFIED: 0, OPEN: 1, INVITE_ONLY: 2, ADMIN_ONLY: 3 },
  SidLoginForm: {
    name: "SidLoginForm",
    props: ["loginFn", "localLogin", "registerUrl", "forgotPasswordUrl"],
    template: "<form />",
  },
  SidRegistrationForm: { name: "SidRegistrationForm", template: "<form />" },
  getInstanceStatus: api.getInstanceStatus,
  getEnrollmentPolicy: api.getEnrollmentPolicy,
  requestPasswordReset: vi.fn(),
  useLoginSuccess: () => ({ onLoginSuccess: vi.fn() }),
}));

vi.mock("@structured-id/ui-core", () => ({
  normalizePrincipal: (v: string) => ({ value: v }),
  refusalMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.mock("src/composables/useAuth", () => ({
  useAuth: () => ({
    login: vi.fn(),
    register: vi.fn(),
    prewarm: vi.fn().mockResolvedValue(undefined),
  }),
}));

const query: Record<string, string> = {};
vi.mock("vue-router", () => ({ useRoute: () => ({ query }) }));

import LoginPage from "./LoginPage.vue";
import ResetRequestPage from "./ResetRequestPage.vue";
import RegisterPage from "./RegisterPage.vue";

const RD = "https://sid.example.com/oauth2/authorize?client_id=a";
const withRd = (path: string) => `${path}?rd=${encodeURIComponent(RD)}`;

const stubs = {
  CeremonyFrame: { template: "<div><slot /></div>" },
  QCard: { template: "<div><slot /></div>" },
  QCardSection: { template: "<div><slot /></div>" },
  QCardActions: { template: "<div><slot /></div>" },
  QBanner: { template: "<div><slot /><slot name='action' /></div>" },
  QBtn: { name: "QBtn", props: ["to", "label"], template: "<a />" },
  QForm: true,
  QInput: true,
  QSkeleton: true,
};

function linkTo(w: ReturnType<typeof shallowMount>, label: string) {
  return w
    .findAllComponents({ name: "QBtn" })
    .find((b) => b.props("label") === label)
    ?.props("to");
}

// Regression: password help and the ways back to sign-in dropped `rd`, so
// signing in afterwards landed in /account instead of finishing the
// requesting application's authorization.
describe("sign-in links keep the authorization continuation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(query)) delete query[k];
    query.rd = RD;
  });

  it("from the sign-in page to password help", () => {
    const w = shallowMount(LoginPage, { global: { stubs } });
    const form = w.findComponent({ name: "SidLoginForm" });
    expect(form.props("forgotPasswordUrl")).toBe(withRd("/account/reset"));
  });

  it("from password help back to sign-in", () => {
    const w = shallowMount(ResetRequestPage, { global: { stubs } });
    expect(linkTo(w, "Back to sign-in")).toBe(withRd("/account/login"));
  });

  it("from a closed registration back to sign-in", async () => {
    api.getInstanceStatus.mockResolvedValue({ claim: 2 });
    api.getEnrollmentPolicy.mockResolvedValue({ mode: 3 });
    const w = shallowMount(RegisterPage, { global: { stubs } });
    await flushPromises();
    expect(linkTo(w, "Sign in")).toBe(withRd("/account/login"));
  });
});
