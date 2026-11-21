import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, shallowMount } from "@vue/test-utils";
import { reactive } from "vue";

const A = "0192f3a4-7c1e-7b2a-9d4e-00000000000a";

const stores = vi.hoisted(() => ({
  machine: null as null | Record<string, unknown>,
  roles: null as null | Record<string, unknown>,
}));

vi.mock("#admin/stores/machineUsers", () => ({
  useMachineUsersStore: () => stores.machine,
}));
vi.mock("#admin/stores/roles", () => ({
  useRolesStore: () => stores.roles,
}));
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { machineUserId: A } }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("quasar", () => ({ useQuasar: () => ({ notify: vi.fn() }) }));

import ServiceAccountDetailPage from "./ServiceAccountDetailPage.vue";

describe("ServiceAccountDetailPage: initialization", () => {
  let answer!: () => void;
  let shown = true;

  beforeEach(() => {
    shown = true;
    stores.machine = reactive({
      currentMachineUser: null,
      credentials: [],
      impersonationGrants: [],
      loading: false,
      error: null,
      getMachineUser: vi.fn(() => new Promise<void>((r) => (answer = r))),
      shows: () => shown,
      fetchCredentials: vi.fn(),
      fetchImpersonationGrants: vi.fn(),
    });
    stores.roles = reactive({
      roles: [],
      assignments: [],
      fetchRoles: vi.fn(),
      fetchMachineUserAssignments: vi.fn(),
    });
  });

  // Regression: leaving account A before it loaded still loaded A's role
  // assignments, beneath the next account's page, whose Revoke buttons then
  // revoked A's access.
  it("loads nothing more for an account left before it loaded", async () => {
    const page = shallowMount(ServiceAccountDetailPage);
    page.unmount();
    answer();
    await flushPromises();

    expect(stores.roles!.fetchMachineUserAssignments).not.toHaveBeenCalled();
    expect(stores.machine!.fetchCredentials).not.toHaveBeenCalled();
  });

  // Another account opened meanwhile owns the shown account.
  it("loads nothing more once another account is shown", async () => {
    shallowMount(ServiceAccountDetailPage);
    shown = false;
    answer();
    await flushPromises();

    expect(stores.roles!.fetchMachineUserAssignments).not.toHaveBeenCalled();
  });

  // The account still shown loads its lists.
  it("loads the shown account's lists", async () => {
    shallowMount(ServiceAccountDetailPage);
    answer();
    await flushPromises();

    expect(stores.roles!.fetchMachineUserAssignments).toHaveBeenCalledOnce();
    expect(stores.machine!.fetchCredentials).toHaveBeenCalledOnce();
  });
});
