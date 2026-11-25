import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import {
  ResourceState,
  type Application,
  type OAuthClient,
  type ResourceAccess,
} from "@structured-id/proto/sid/v1/projects/projects";

const store = vi.hoisted(() => ({
  listClientAccess: vi.fn(),
  setClientAccess: vi.fn(),
  removeClientAccess: vi.fn(),
  setDefaultTarget: vi.fn(),
}));
vi.mock("#admin/stores/applications", () => ({
  useApplicationsStore: () => store,
}));

const quasar = vi.hoisted(() => ({
  notify: vi.fn(),
  // The confirmation is accepted at once.
  dialog: vi.fn((_options: { message: string }) => ({
    onOk: (run: () => unknown) => run(),
  })),
}));
vi.mock("quasar", () => ({ useQuasar: () => quasar }));
vi.mock("@structured-id/ui-core", () => ({
  refusalMessage: (e: unknown, fallback: string) =>
    e instanceof Error ? e.message : fallback,
}));

import ClientAccessPanel from "./ClientAccessPanel.vue";
import { quasarStubs } from "#admin/test-utils/quasar-stubs";

const ISSUER = "https://sid.example.com";
const id = (n: number) => ({ value: new Uint8Array(16).fill(n) });

const USERINFO = {
  name: "OIDC UserInfo",
  resource: {
    id: id(1),
    indicator: `${ISSUER}/userinfo`,
    issuer: ISSUER,
    scopes: ["openid", "profile", "email"],
    state: ResourceState.ACTIVE,
    revision: 1n,
  },
} as Application;
const ORDERS = {
  name: "Orders API",
  resource: {
    id: id(2),
    indicator: "https://api.sid.example.com/orders",
    issuer: ISSUER,
    scopes: ["orders.read", "orders.write"],
    state: ResourceState.ACTIVE,
    revision: 1n,
  },
} as Application;

const client = (over: Partial<OAuthClient> = {}) =>
  ({
    clientId: "sid_notes",
    name: "Notes",
    issuer: ISSUER,
    allowedScopes: [],
    ...over,
  }) as OAuthClient;

const stubs = {
  ...quasarStubs,
  QBtn: {
    props: ["label", "disable"],
    emits: ["click"],
    template:
      '<button :disabled="disable" @click="$emit(\'click\')">{{ label }}</button>',
  },
  QSkeleton: { template: "<i class='skeleton' />" },
  QCheckbox: {
    props: ["modelValue", "val", "label"],
    emits: ["update:modelValue"],
    template:
      "<label><input type='checkbox' :data-scope='val' @change=\"$emit('update:modelValue', [...modelValue, val])\" />{{ label }}</label>",
  },
};

async function shown(
  access: ResourceAccess[],
  of: OAuthClient = client(),
  readonly = false,
) {
  store.listClientAccess.mockResolvedValue(access);
  const w = mount(ClientAccessPanel, {
    props: { client: of, applications: [USERINFO, ORDERS], readonly },
    global: { stubs },
  });
  await flushPromises();
  return w;
}

const USERINFO_ACCESS: ResourceAccess = {
  clientId: "sid_notes",
  resourceId: id(1),
  scopes: ["openid", "profile"],
};

beforeEach(() => vi.clearAllMocks());

describe("ClientAccessPanel", () => {
  // What is tested: a client without access is told what that means, and
  // the access is read for this client.
  // Bug prevented: an empty list that reads as "nothing to configure" on a
  // client whose every request is refused.
  it("says what no access means", async () => {
    const w = await shown([]);
    expect(store.listClientAccess).toHaveBeenCalledExactlyOnceWith("sid_notes");
    expect(w.find('[data-test="access-empty"]').text()).toContain(
      "refused until it has one",
    );
    expect(w.text()).toContain("No default target");
  });

  // What is tested: each access shows its resource and scopes, and the
  // default target is marked on its own row.
  it("lists the access with its scopes and marks the default target", async () => {
    const w = await shown(
      [USERINFO_ACCESS],
      client({ defaultResourceId: id(1) }),
    );
    const row = w.find('[data-test="access-row"]');
    expect(row.text()).toContain("OIDC UserInfo");
    expect(row.text()).toContain(`${ISSUER}/userinfo`);
    expect(row.text()).toContain("Scopes: openid profile");
    expect(row.find('[data-test="default-target"]').exists()).toBe(true);
    expect(w.text()).not.toContain("No default target");
  });

  // What is tested: "Make default" saves this row's resource as the default,
  // "Clear default" removes it, and the list is read again after each.
  // Bug prevented: a default saved for another row's resource, or a list
  // still showing the state before the change.
  it("saves and clears the default target", async () => {
    const w = await shown([USERINFO_ACCESS]);
    await w.find('[data-test="make-default"]').trigger("click");
    await flushPromises();
    expect(store.setDefaultTarget).toHaveBeenCalledExactlyOnceWith(
      "sid_notes",
      id(1),
    );
    expect(store.listClientAccess).toHaveBeenCalledTimes(2);

    const marked = await shown(
      [USERINFO_ACCESS],
      client({ defaultResourceId: id(1) }),
    );
    await marked.find('[data-test="clear-default"]').trigger("click");
    await flushPromises();
    expect(store.setDefaultTarget).toHaveBeenLastCalledWith(
      "sid_notes",
      undefined,
    );
  });

  // What is tested: an access is removed only after the confirmation, which
  // says that the default target goes with it.
  it("removes an access after saying what is lost", async () => {
    const w = await shown(
      [USERINFO_ACCESS],
      client({ defaultResourceId: id(1) }),
    );
    await w.find('[data-test="remove-access"]').trigger("click");
    await flushPromises();
    expect(quasar.dialog.mock.calls[0]![0]).toMatchObject({
      message: expect.stringContaining("its default target"),
    });
    expect(store.removeClientAccess).toHaveBeenCalledExactlyOnceWith(
      "sid_notes",
      id(1),
    );
  });

  // What is tested: the dialog adds an access to the only resource left
  // without one, with the scopes ticked, in the resource's own order.
  // Bug prevented: an access saved to a resource the client already has, or
  // with scopes of another resource.
  it("adds an access with the chosen scopes", async () => {
    const w = await shown([USERINFO_ACCESS]);
    await w.find('[data-test="add-access"]').trigger("click");
    await w.find('[data-scope="orders.write"]').trigger("change");
    await w.find('[data-scope="orders.read"]').trigger("change");
    expect(w.find('[data-test="access-summary"]').text()).toContain(
      "Notes can obtain tokens for Orders API",
    );
    await w.find('[data-test="save-access"]').trigger("click");
    await flushPromises();
    expect(store.setClientAccess).toHaveBeenCalledExactlyOnceWith(
      "sid_notes",
      id(2),
      ["orders.read", "orders.write"],
    );
  });

  // What is tested: a refused change is reported and not shown as saved.
  it("reports a refused change", async () => {
    store.setDefaultTarget.mockRejectedValue(new Error("no access"));
    const w = await shown([USERINFO_ACCESS]);
    await w.find('[data-test="make-default"]').trigger("click");
    await flushPromises();
    expect(quasar.notify).toHaveBeenCalledWith({
      type: "negative",
      message: "no access",
    });
  });

  // What is tested: a client SID manages itself is shown without controls.
  it("shows a managed client's access without changing it", async () => {
    const w = await shown([USERINFO_ACCESS], client(), true);
    expect(w.find('[data-test="access-row"]').exists()).toBe(true);
    expect(w.find('[data-test="remove-access"]').exists()).toBe(false);
    expect(w.find('[data-test="add-access"]').exists()).toBe(false);
  });

  // What is tested: an access that cannot be read is a failure with a retry,
  // not an empty list.
  // Bug prevented: "this client has access to no resource" shown for a
  // client whose access simply failed to load.
  it("reports an access that could not be loaded", async () => {
    store.listClientAccess.mockRejectedValue(new Error("unavailable"));
    const w = mount(ClientAccessPanel, {
      props: { client: client(), applications: [USERINFO, ORDERS] },
      global: { stubs },
    });
    await flushPromises();
    expect(w.text()).toContain("unavailable");
    expect(w.find('[data-test="access-empty"]').exists()).toBe(false);
    expect(w.find('[data-test="add-access"]').exists()).toBe(false);
  });
});
