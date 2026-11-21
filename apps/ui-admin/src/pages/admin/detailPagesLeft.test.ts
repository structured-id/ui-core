import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, shallowMount } from "@vue/test-utils";
import { reactive } from "vue";

const ID = "0192f3a4-7c1e-7b2a-9d4e-00000000000a";

const state = vi.hoisted(() => ({
  store: null as null | Record<string, unknown>,
  answer: (() => {}) as () => void,
}));

/** The page's first load, answered when the test says so. */
function pending() {
  return vi.fn(
    () => new Promise((r) => (state.answer = () => r({ displayName: "" }))),
  );
}

vi.mock("#admin/stores/roles", () => ({ useRolesStore: () => state.store }));
vi.mock("#admin/stores/groups", () => ({ useGroupsStore: () => state.store }));
vi.mock("#admin/stores/users", () => ({ useUsersStore: () => state.store }));
vi.mock("#admin/stores/scopes", () => ({ useScopesStore: () => state.store }));
vi.mock("vue-router", () => ({
  useRoute: () => ({
    params: { roleId: ID, groupId: ID, userId: ID, scopeId: ID },
  }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("quasar", () => ({
  useQuasar: () => ({ notify: vi.fn() }),
  copyToClipboard: vi.fn(),
}));

import RoleDetailPage from "./RoleDetailPage.vue";
import GroupDetailPage from "./GroupDetailPage.vue";
import UserDetailPage from "./UserDetailPage.vue";
import ScopeDetailPage from "./ScopeDetailPage.vue";

// Regression: a detail page left before its object loaded still loaded that
// object's dependent list (assignments, members, credentials and sessions,
// claim mappings) into the shared store, beneath the next object's page,
// whose actions then acted on the first object.
describe.each([
  {
    name: "RoleDetailPage",
    page: RoleDetailPage,
    first: "getRole",
    dependent: ["fetchRoleAssignments"],
  },
  {
    name: "GroupDetailPage",
    page: GroupDetailPage,
    first: "getGroup",
    dependent: ["fetchMembers"],
  },
  {
    name: "UserDetailPage",
    page: UserDetailPage,
    first: "getProfile",
    dependent: ["fetchCredentials", "fetchSessions"],
  },
  {
    name: "ScopeDetailPage",
    page: ScopeDetailPage,
    first: "fetchScope",
    dependent: ["fetchClaimMappings"],
  },
])("$name left before its object loaded", ({ page, first, dependent }) => {
  beforeEach(() => {
    const store: Record<string, unknown> = {
      error: null,
      loading: false,
      // What the templates read before anything loaded.
      assignments: [],
      members: [],
      claimMappings: [],
      credentials: [],
      sessions: [],
      // UserDetailPage loads the lists only for a loaded profile.
      currentProfile: { id: ID, principals: [], roles: [] },
      [first]: pending(),
    };
    for (const name of dependent) store[name] = vi.fn();
    state.store = reactive(store);
  });

  it("loads nothing more", async () => {
    const mounted = shallowMount(page);
    mounted.unmount();
    state.answer();
    await flushPromises();

    for (const name of dependent) {
      expect(state.store![name], name).not.toHaveBeenCalled();
    }
  });
});
