import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";

const page = vi.hoisted(() => ({
  listed: [] as { handle: string; name: string }[],
  load: vi.fn(),
  signInThrough: vi.fn(),
  rd: [] as unknown[],
  origin: [] as string[],
}));

vi.mock("@structured-id/ui-core/profile", () => ({
  SidLoginForm: {
    name: "SidLoginForm",
    props: ["loginFn", "localLogin", "registerUrl", "forgotPasswordUrl"],
    template: "<form><slot name='footer' /></form>",
  },
  useLoginSuccess: () => ({ onLoginSuccess: vi.fn() }),
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
  QBtn: {
    name: "QBtn",
    props: ["label", "loading", "disable"],
    emits: ["click"],
    template: "<button @click=\"$emit('click')\">{{ label }}</button>",
  },
};

async function shown() {
  const w = mount(LoginPage, { global: { stubs } });
  await flushPromises();
  return w;
}

describe("the sign-in page's entry connections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    page.listed = [];
    page.rd.length = 0;
    page.origin.length = 0;
  });

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
    expect(w.findAll("button")).toHaveLength(0);
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
    const buttons = w.findAll("button");
    expect(buttons.map((b) => b.text())).toEqual([
      "Partner",
      "Partner",
      "Head office",
    ]);
    await buttons[1]!.trigger("click");
    expect(page.signInThrough).toHaveBeenCalledExactlyOnceWith("bbbb2222");
  });
});
