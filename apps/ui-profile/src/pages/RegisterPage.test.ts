import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, shallowMount } from "@vue/test-utils";

// The page's boundary: the installation's registration state and policy,
// and the password ceremonies.
const api = vi.hoisted(() => ({
  getInstanceStatus: vi.fn(),
  getEnrollmentPolicy: vi.fn(),
  readRegistrationSettings: vi.fn(),
  register: vi.fn(),
  login: vi.fn(),
  onLoginSuccess: vi.fn(),
}));

vi.mock("@structured-id/ui-core/profile", () => ({
  AdministratorClaim: { UNSPECIFIED: 0, OPEN: 1, CLAIMED: 2 },
  EnrollmentMode: {
    UNSPECIFIED: 0,
    OPEN: 1,
    INVITE_ONLY: 2,
    ADMIN_ONLY: 3,
    DOMAIN_RESTRICTED: 4,
  },
  SidRegistrationForm: {
    name: "SidRegistrationForm",
    props: [
      "registerFn",
      "claimRequired",
      "inviteRequired",
      "initialInviteCode",
      "loginUrl",
      "principalTypes",
      "usernameMinLength",
    ],
    emits: ["success"],
    template: "<form />",
  },
  getInstanceStatus: api.getInstanceStatus,
  getEnrollmentPolicy: api.getEnrollmentPolicy,
  readRegistrationSettings: api.readRegistrationSettings,
  useLoginSuccess: () => ({ onLoginSuccess: api.onLoginSuccess }),
}));

vi.mock("@structured-id/ui-core", () => ({
  refusalMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.mock("src/composables/useAuth", () => ({
  useAuth: () => ({
    register: api.register,
    login: api.login,
    prewarm: vi.fn().mockResolvedValue(undefined),
  }),
}));

const query: Record<string, string> = {};
vi.mock("vue-router", () => ({ useRoute: () => ({ query }) }));

import RegisterPage from "./RegisterPage.vue";

function mountPage() {
  return shallowMount(RegisterPage, {
    global: {
      stubs: {
        CeremonyFrame: { template: "<div><slot /></div>" },
        QCard: { template: "<div><slot /></div>" },
        QSkeleton: true,
        QBtn: true,
        QBanner: { template: "<div><slot /><slot name='action' /></div>" },
      },
    },
  });
}

function form(w: ReturnType<typeof mountPage>) {
  return w.findComponent({ name: "SidRegistrationForm" });
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(query)) delete query[k];
    // A self-hosted installation's open registration, unless a case says
    // otherwise.
    api.readRegistrationSettings.mockResolvedValue({
      open: true,
      principalTypes: ["email", "phone", "username"],
      usernameMinLength: 3,
    });
  });

  // The policy may admit visitors while the installation itself takes no
  // registrations (its own switch is off): it then publishes registration
  // as closed, with the types and minimum unchanged.
  // Bug prevented: the form shown on the direct address, where the first
  // request of the registration is refused.
  it("offers no form when the installation publishes registration closed", async () => {
    api.getInstanceStatus.mockResolvedValue({ claim: 2 });
    api.getEnrollmentPolicy.mockResolvedValue({ mode: 1 });
    api.readRegistrationSettings.mockResolvedValue({
      open: false,
      principalTypes: ["email", "phone", "username"],
      usernameMinLength: 3,
    });
    const w = mountPage();
    await flushPromises();

    expect(form(w).exists()).toBe(false);
    expect(w.text()).toContain("does not accept registration");
  });

  // The form admits what the installation publishes: its types and its
  // username minimum, not values of the page's own.
  // Bug prevented: a three-character name stopped before any request on an
  // installation that admits it, because the form assumed six.
  it("gives the form the installation's registration settings", async () => {
    api.getInstanceStatus.mockResolvedValue({ claim: 2 });
    api.getEnrollmentPolicy.mockResolvedValue({ mode: 1 });
    const w = mountPage();
    await flushPromises();

    expect(form(w).props("principalTypes")).toEqual([
      "email",
      "phone",
      "username",
    ]);
    expect(form(w).props("usernameMinLength")).toBe(3);
  });

  // Under a domain-restricted policy the installation registers an email
  // only, and the form offers nothing else.
  it("offers only an email under a domain-restricted policy", async () => {
    api.getInstanceStatus.mockResolvedValue({ claim: 2 });
    api.getEnrollmentPolicy.mockResolvedValue({ mode: 4 });
    api.readRegistrationSettings.mockResolvedValue({
      open: true,
      principalTypes: ["email"],
      usernameMinLength: undefined,
    });
    const w = mountPage();
    await flushPromises();

    expect(form(w).props("principalTypes")).toEqual(["email"]);
    expect(form(w).props("usernameMinLength")).toBeUndefined();
  });

  // Settings that cannot be read are an outage: no form opens with values
  // the installation never stated.
  it("shows an outage when the settings cannot be read", async () => {
    api.getInstanceStatus.mockResolvedValue({ claim: 2 });
    api.getEnrollmentPolicy.mockResolvedValue({ mode: 1 });
    api.readRegistrationSettings.mockRejectedValue(new Error("UNAVAILABLE"));
    const w = mountPage();
    await flushPromises();

    expect(form(w).exists()).toBe(false);
    expect(w.text()).toContain("cannot be reached");
  });

  // The claim registration is a scenario of its own: the first administrator
  // registers by the claim's rules, and the settings are not read for it.
  it("keeps the claim registration's own admission", async () => {
    api.getInstanceStatus.mockResolvedValue({ claim: 1 });
    const w = mountPage();
    await flushPromises();

    expect(form(w).props("claimRequired")).toBe(true);
    expect(api.readRegistrationSettings).not.toHaveBeenCalled();
  });

  // While the installation waits for its first administrator, the claim
  // token alone admits a registration: the policy is not even read.
  it("asks for the claim token while the installation is unclaimed", async () => {
    api.getInstanceStatus.mockResolvedValue({ claim: 1 });
    const w = mountPage();
    await flushPromises();

    expect(form(w).props("claimRequired")).toBe(true);
    expect(form(w).props("inviteRequired")).toBe(false);
    expect(api.getEnrollmentPolicy).not.toHaveBeenCalled();
  });

  // Once claimed, an invite-only policy asks for an invite, pre-filled from
  // the link an administrator shared. The installation publishes
  // registration as closed to a visitor then: the invite is its own entry.
  it("asks for an invite under an invite-only policy", async () => {
    api.getInstanceStatus.mockResolvedValue({ claim: 2 });
    api.getEnrollmentPolicy.mockResolvedValue({ mode: 2 });
    api.readRegistrationSettings.mockResolvedValue({
      open: false,
      principalTypes: ["email", "phone", "username"],
      usernameMinLength: 3,
    });
    query.invite = "ABCD1234";
    const w = mountPage();
    await flushPromises();

    expect(form(w).props("claimRequired")).toBe(false);
    expect(form(w).props("inviteRequired")).toBe(true);
    expect(form(w).props("initialInviteCode")).toBe("ABCD1234");
  });

  // The way back to sign-in keeps the authorization continuation.
  it("keeps the continuation on its sign-in link", async () => {
    api.getInstanceStatus.mockResolvedValue({ claim: 1 });
    query.rd = "https://sid.example.com/oauth2/authorize?client_id=a";
    const w = mountPage();
    await flushPromises();

    expect(form(w).props("loginUrl")).toBe(
      `/account/login?rd=${encodeURIComponent(query.rd)}`,
    );
  });

  // An administrator-only installation offers no form at all.
  it("offers no registration when only administrators create accounts", async () => {
    api.getInstanceStatus.mockResolvedValue({ claim: 2 });
    api.getEnrollmentPolicy.mockResolvedValue({ mode: 3 });
    const w = mountPage();
    await flushPromises();

    expect(form(w).exists()).toBe(false);
    expect(w.text()).toContain("does not accept registration");
  });

  // An unreachable installation is an outage, not an open registration.
  it("shows an outage instead of a form when the state cannot be read", async () => {
    api.getInstanceStatus.mockRejectedValue(new Error("UNAVAILABLE"));
    const w = mountPage();
    await flushPromises();

    expect(form(w).exists()).toBe(false);
    expect(w.text()).toContain("cannot be reached");
  });

  // The new account signs in with the same password, and the sign-in (with
  // a factor it may still owe) continues once the form closes.
  it("signs the new account in and hands the sign-in on", async () => {
    api.getInstanceStatus.mockResolvedValue({ claim: 1 });
    const signedIn = { sessionId: "s", expiresIn: 600, pending: null };
    api.login.mockResolvedValue(signedIn);
    const w = mountPage();
    await flushPromises();

    const registerFn = form(w).props("registerFn") as (
      ...a: unknown[]
    ) => Promise<void>;
    await registerFn("admin", "pw", { claimToken: "sidclaim_x" });
    expect(api.register).toHaveBeenCalledWith(
      "admin",
      "pw",
      { claimToken: "sidclaim_x" },
      undefined,
    );
    expect(api.login).toHaveBeenCalledWith("admin", "pw");

    form(w).vm.$emit("success", {
      identifier: "admin",
      principalType: "username",
    });
    await flushPromises();
    expect(api.onLoginSuccess).toHaveBeenCalledWith(signedIn);
  });
});
