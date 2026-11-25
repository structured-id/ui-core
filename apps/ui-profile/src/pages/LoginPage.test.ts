import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";

interface Offer {
  registration: boolean;
  passwordReset: boolean;
  password: boolean;
  passkey: boolean;
}

const page = vi.hoisted(() => ({
  listed: [] as { handle: string; name: string }[],
  load: vi.fn(),
  signInThrough: vi.fn(),
  rd: [] as unknown[],
  origin: [] as string[],
  // What the installation answers its sign-in page may offer, one answer per
  // read; `null` is a read that gets no answer, `"open"` one still under way.
  answers: [] as (Offer | null | "open")[],
  loadOffer: vi.fn(),
  // The passkey sign-in the page starts, and what it continues with.
  signInWithPasskey: vi.fn(),
  onPasskeySuccess: undefined as undefined | ((r: unknown) => unknown),
  onLoginSuccess: vi.fn(),
}));

vi.mock("@structured-id/ui-core/profile", () => ({
  SidLoginForm: {
    name: "SidLoginForm",
    props: ["loginFn", "localLogin", "registerUrl", "passwordSignIn"],
    // The slot gets the login typed, as the real form gives it.
    template:
      "<form><slot name='below-form' identifier='alice' /><slot name='footer' /></form>",
  },
  SidSignInPending: {
    name: "SidSignInPending",
    props: ["failed"],
    emits: ["retry"],
    template: "<section data-test='pending'><slot name='footer' /></section>",
  },
  useLoginSuccess: () => ({ onLoginSuccess: page.onLoginSuccess }),
  usePasskeySignIn: (options: { onSuccess: (r: unknown) => unknown }) => {
    page.onPasskeySuccess = options.onSuccess;
    return {
      signInWithPasskey: page.signInWithPasskey,
      loading: ref(false),
      error: ref<string | null>(null),
    };
  },
  useSignInConnections: (rd: () => unknown, origin: string) => {
    const connections = ref<{ handle: string; name: string }[]>([]);
    page.rd.push(rd());
    page.origin.push(origin);
    return {
      connections,
      leaving: ref<string | null>(null),
      load: page.load.mockImplementation(async () => {
        connections.value = page.listed;
      }),
      signInThrough: page.signInThrough,
    };
  },
  useSignInOffer: () => {
    const offer = ref<Offer | null>(null);
    const failed = ref(false);
    return {
      offer,
      failed,
      load: page.loadOffer.mockImplementation(async () => {
        const answer = page.answers.shift() ?? null;
        if (answer === "open") return new Promise<void>(() => {});
        offer.value = answer;
        failed.value = answer === null;
      }),
    };
  },
}));

vi.mock("src/composables/useAuth", () => ({
  useAuth: () => ({
    login: vi.fn(),
    prewarm: vi.fn().mockResolvedValue(undefined),
  }),
}));

const RD = "https://sid.example.com/oauth2/authorize?client_id=a";
vi.mock("vue-router", () => ({ useRoute: () => ({ query: { rd: RD } }) }));

import LoginPage from "./LoginPage.vue";

const stubs = {
  CeremonyFrame: { template: "<div><slot /></div>" },
  QSeparator: true,
  QCardSection: { template: "<div><slot /></div>" },
  QBanner: { template: "<div><slot /></div>" },
  QBtn: {
    name: "QBtn",
    props: ["label", "loading", "disable"],
    emits: ["click"],
    template: "<button @click=\"$emit('click')\">{{ label }}</button>",
  },
  RouterLink: {
    name: "RouterLink",
    props: ["to"],
    template: "<a :href='to'><slot /></a>",
  },
};

const OPEN: Offer = {
  registration: true,
  passwordReset: true,
  password: true,
  passkey: true,
};

async function shown() {
  const w = mount(LoginPage, { global: { stubs } });
  await flushPromises();
  return w;
}

beforeEach(() => {
  vi.clearAllMocks();
  page.listed = [];
  page.rd.length = 0;
  page.origin.length = 0;
  page.answers = [OPEN];
  page.onPasskeySuccess = undefined;
});

describe("the sign-in page's entry connections", () => {
  // What is tested: the page reads the connections for its own request and
  // origin when it opens.
  // Bug prevented: a page that never asks, so a configured connection is
  // unreachable from it.
  it("reads the connections of its request on its own origin", async () => {
    await shown();
    expect(page.load).toHaveBeenCalledOnce();
    expect(page.rd).toEqual([RD]);
    expect(page.origin).toEqual([window.location.origin]);
  });

  // What is tested: an installation without connections shows local
  // sign-in alone.
  // Bug prevented: an empty "or sign in with" section on every CE page.
  it("shows nothing beside the form without connections", async () => {
    const w = await shown();
    expect(w.findAll('[data-test="sign-in-connection"]')).toHaveLength(0);
    expect(w.text()).not.toContain("Or sign in with");
  });

  // What is tested: each connection is a button by its name, and choosing
  // one passes that connection's handle.
  // Bug prevented: two connections with one name both entering the first.
  it("offers each connection by name and enters the chosen one by handle", async () => {
    page.listed = [
      { handle: "aaaa1111", name: "Partner" },
      { handle: "bbbb2222", name: "Partner" },
      { handle: "cccc3333", name: "Head office" },
    ];
    const w = await shown();
    const buttons = w.findAll('[data-test="sign-in-connection"]');
    expect(buttons.map((b) => b.text())).toEqual([
      "Partner",
      "Partner",
      "Head office",
    ]);
    await buttons[1]!.trigger("click");
    expect(page.signInThrough).toHaveBeenCalledExactlyOnceWith("bbbb2222");
  });
});

describe("what the sign-in page offers", () => {
  // What is tested: an installation that registers nobody by themselves and
  // serves no password reset gets a sign-in form with neither link.
  // Bug prevented (seen on the development platform): "Create one" and
  // "Forgot password?" on an invitation-only issuer, both leading to a
  // refusal.
  it("links neither registration nor recovery when the installation offers none", async () => {
    page.answers = [{ ...OPEN, registration: false, passwordReset: false }];
    const w = await shown();
    const form = w.findComponent({ name: "SidLoginForm" });
    expect(page.loadOffer).toHaveBeenCalledOnce();
    expect(form.props("registerUrl")).toBeUndefined();
    expect(form.props("passwordSignIn")).toBe(true);
    expect(w.find('[data-test="forgot-password"]').exists()).toBe(false);
  });

  // What is tested: each link follows its own setting and keeps the waiting
  // request.
  // Bug prevented: an open installation losing its links, or a link dropping
  // the request the browser was sent here to complete.
  it("links what the installation offers, with the waiting request", async () => {
    const w = await shown();
    const form = w.findComponent({ name: "SidLoginForm" });
    const register = new URL(
      form.props("registerUrl") as string,
      "https://sid.example.com",
    );
    expect(register.pathname).toBe("/account/register");
    expect(register.searchParams.get("rd")).toBe(RD);
    const reset = new URL(
      w.find('[data-test="forgot-password"]').attributes("href")!,
      "https://sid.example.com",
    );
    expect(reset.pathname).toBe("/account/reset");
    expect(reset.searchParams.get("rd")).toBe(RD);
  });

  // What is tested: an installation that offers passkeys alone shows no
  // password form and no recovery link, and has a passkey button that starts
  // the sign-in for the login typed and continues as any other sign-in.
  // Bug prevented: the password form hidden with nothing left to press, or
  // a passkey sign-in that never returns to the waiting request.
  it("signs in with a passkey when the installation offers no password", async () => {
    page.answers = [{ ...OPEN, password: false }];
    const w = await shown();
    expect(
      w.findComponent({ name: "SidLoginForm" }).props("passwordSignIn"),
    ).toBe(false);
    expect(w.find('[data-test="forgot-password"]').exists()).toBe(false);

    await w.find('[data-test="passkey"]').trigger("click");
    expect(page.signInWithPasskey).toHaveBeenCalledExactlyOnceWith("alice");

    const signedIn = { sessionId: "s", pending: null };
    await page.onPasskeySuccess!(signedIn);
    expect(page.onLoginSuccess).toHaveBeenCalledExactlyOnceWith(signedIn);
  });

  // What is tested: without the passkey method there is no passkey button.
  // Bug prevented: a button whose every attempt the installation refuses.
  it("shows no passkey button when the installation offers none", async () => {
    page.answers = [{ ...OPEN, passkey: false }];
    const w = await shown();
    expect(w.find('[data-test="passkey"]').exists()).toBe(false);
  });
});

describe("the sign-in page before it knows the offer", () => {
  // What is tested: an installation that does not answer gets the failure
  // with its connections and no sign-in form; a retry that is answered shows
  // the offered form.
  // Bug prevented: both sign-in forms shown for an installation that never
  // stated them, or a failed page with no way on.
  it("shows no form until the installation answers, and recovers on a retry", async () => {
    page.answers = [null, { ...OPEN, registration: false }];
    page.listed = [{ handle: "aaaa1111", name: "Partner" }];
    const w = await shown();

    const pending = w.findComponent({ name: "SidSignInPending" });
    expect(pending.props("failed")).toBe(true);
    expect(w.findComponent({ name: "SidLoginForm" }).exists()).toBe(false);
    expect(w.find('[data-test="passkey"]').exists()).toBe(false);
    // The connections are confirmed by their own read.
    expect(w.findAll('[data-test="sign-in-connection"]')).toHaveLength(1);

    pending.vm.$emit("retry");
    await flushPromises();
    expect(page.loadOffer).toHaveBeenCalledTimes(2);
    expect(w.findComponent({ name: "SidSignInPending" }).exists()).toBe(false);
    expect(w.findComponent({ name: "SidLoginForm" }).exists()).toBe(true);
  });

  // What is tested: while the read is under way the page waits, without a
  // form and without a failure.
  // Bug prevented: a form flashing before the answer.
  it("waits without a form while the offer is read", async () => {
    page.answers = ["open"];
    const w = await shown();
    const pending = w.findComponent({ name: "SidSignInPending" });
    expect(pending.exists()).toBe(true);
    expect(pending.props("failed")).toBe(false);
    expect(w.findComponent({ name: "SidLoginForm" }).exists()).toBe(false);
  });
});
