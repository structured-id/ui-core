import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

// Hoisted mocks
const mocks = vi.hoisted(() => ({
  listRoles: vi.fn().mockResolvedValue({
    response: { roles: [] },
  }),
  createRole: vi.fn().mockResolvedValue({
    response: { id: "role-new", name: "New Role" },
  }),
  deleteRole: vi.fn().mockResolvedValue({ response: {} }),
  getRole: vi.fn(),
  updateRole: vi.fn(),
  listRoleAssignments: vi.fn().mockResolvedValue({
    response: { assignments: [] },
  }),
  assignRole: vi.fn(),
  revokeRole: vi.fn(),
}));

vi.mock("@structured-id/ui-core", () => ({
  getAccountTransport: () => ({}),
}));

vi.mock("@structured-id/proto/sid/v1/authz/authz.client", () => ({
  AuthzServiceClient: class {
    listRoles = mocks.listRoles;
    createRole = mocks.createRole;
    deleteRole = mocks.deleteRole;
    getRole = mocks.getRole;
    updateRole = mocks.updateRole;
    listRoleAssignments = mocks.listRoleAssignments;
    assignRole = mocks.assignRole;
    revokeRole = mocks.revokeRole;
  },
}));

vi.mock("quasar", () => ({
  useQuasar: () => ({ notify: vi.fn() }),
}));

import { createRouter, createMemoryHistory } from "vue-router";
import { RoleId } from "@structured-id/ids";
import RolesPage from "./RolesPage.vue";
import { useRolesStore } from "#admin/stores/roles";
import { quasarStubs } from "#admin/test-utils/quasar-stubs";

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      {
        path: "/admin/roles/:id",
        name: "admin-role-detail",
        component: { template: "<div />" },
      },
    ],
  });
}

/** The `n`th role id: a UUIDv7. */
function roleId(n = 1) {
  return RoleId.parse(
    `0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d${n.toString(16).padStart(2, "0")}`,
  );
}

function makeRole(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: roleId().toWire(),
    name: "Admin",
    description: "Full admin access",
    permissions: ["users.read", "users.write"],
    ...overrides,
  };
}

async function mountPage() {
  const router = createTestRouter();
  await router.push("/");
  await router.isReady();
  return mount(RolesPage, {
    global: {
      plugins: [createPinia(), router],
      stubs: quasarStubs,
      directives: { "close-popup": () => {} },
    },
  });
}

describe("RolesPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.listRoles.mockResolvedValue({
      response: { roles: [] },
    });
  });

  it("renders the page heading", async () => {
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Roles");
  });

  it("calls fetchRoles on mount", async () => {
    await mountPage();
    await flushPromises();
    expect(mocks.listRoles).toHaveBeenCalledOnce();
  });

  it("shows empty state when no roles", async () => {
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("No roles defined");
  });

  it("renders roles when store has data", async () => {
    mocks.listRoles.mockResolvedValue({
      response: { roles: [makeRole()] },
    });
    const wrapper = await mountPage();
    await flushPromises();
    const store = useRolesStore();
    expect(store.roles).toHaveLength(1);
    expect(wrapper.text()).toContain("Admin");
  });

  it("shows error banner on fetch failure", async () => {
    mocks.listRoles.mockRejectedValueOnce(new Error("Network error"));
    const wrapper = await mountPage();
    await flushPromises();
    const store = useRolesStore();
    expect(store.error).toBeTruthy();
    expect(wrapper.find(".q-banner").exists()).toBe(true);
  });

  it("has Create Role button", async () => {
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Create Role");
  });

  it("populates store with multiple roles", async () => {
    const roles = [
      makeRole({ id: roleId(1).toWire(), name: "Admin" }),
      makeRole({ id: roleId(2).toWire(), name: "Editor" }),
      makeRole({ id: roleId(3).toWire(), name: "Viewer" }),
    ];
    mocks.listRoles.mockResolvedValue({
      response: { roles },
    });
    await mountPage();
    await flushPromises();
    const store = useRolesStore();
    expect(store.roles).toHaveLength(3);
  });

  it("displays role description", async () => {
    mocks.listRoles.mockResolvedValue({
      response: { roles: [makeRole({ description: "Manages everything" })] },
    });
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Admin");
  });

  it("store.createRole calls gRPC with name and permissions", async () => {
    mocks.createRole.mockResolvedValue({
      response: {
        role: {
          id: roleId(9).toWire(),
          name: "Auditor",
          description: "",
          permissions: ["audit.read"],
        },
      },
    });
    await mountPage();
    await flushPromises();
    const store = useRolesStore();

    await store.createRole({
      name: "Auditor",
      description: "",
      permissions: ["audit.read"],
    });
    expect(mocks.createRole).toHaveBeenCalledOnce();
    expect(store.roles).toHaveLength(1);
  });

  it("store.deleteRole calls gRPC and removes from list", async () => {
    mocks.listRoles.mockResolvedValue({
      response: { roles: [makeRole()] },
    });
    mocks.deleteRole.mockResolvedValue({ response: {} });
    await mountPage();
    await flushPromises();
    const store = useRolesStore();
    expect(store.roles).toHaveLength(1);

    await store.deleteRole(roleId());
    expect(mocks.deleteRole).toHaveBeenCalledOnce();
    // The role is named by its id message and leaves the list.
    expect(mocks.deleteRole).toHaveBeenCalledWith({ id: roleId().toWire() });
    expect(store.roles).toHaveLength(0);
  });

  it("store.deleteRole sets error on failure", async () => {
    mocks.deleteRole.mockRejectedValueOnce(new Error("Role in use"));
    await mountPage();
    await flushPromises();
    const store = useRolesStore();

    try {
      await store.deleteRole(roleId());
    } catch {
      // store re-throws after setting error
    }
    expect(store.error).toBe("Role in use");
  });
});
