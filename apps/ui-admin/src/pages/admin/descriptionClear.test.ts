import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, shallowMount } from "@vue/test-utils";
import { reactive } from "vue";
import { GroupId } from "@structured-id/ids";

const ID = "0192f3a4-7c1e-7b2a-9d4e-00000000000a";

const state = vi.hoisted(() => ({
  store: null as null | Record<string, unknown>,
}));

vi.mock("#admin/stores/roles", () => ({ useRolesStore: () => state.store }));
vi.mock("#admin/stores/groups", () => ({ useGroupsStore: () => state.store }));
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { roleId: ID, groupId: ID } }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("quasar", () => ({
  useQuasar: () => ({ notify: vi.fn() }),
  copyToClipboard: vi.fn(),
}));

import RoleDetailPage from "./RoleDetailPage.vue";
import GroupDetailPage from "./GroupDetailPage.vue";

interface SettingsVm {
  settingsForm: { description: string };
  saveSettings(): Promise<void>;
}

// Regression: deleting an existing description and saving sent no
// description at all (empty text became "unset", which keeps the current
// one), so the old description stayed while the page reported success.
describe("clearing a description", () => {
  beforeEach(() => {
    const current = {
      // Both id types carry the same wire shape.
      id: GroupId.parse(ID).toWire(),
      name: "x",
      description: "old",
      permissions: ["a:read"],
    };
    state.store = reactive({
      error: null,
      loading: false,
      assignments: [],
      members: [],
      currentRole: current,
      currentGroup: current,
      getRole: vi.fn().mockResolvedValue(undefined),
      getGroup: vi.fn().mockResolvedValue(undefined),
      fetchRoleAssignments: vi.fn(),
      fetchMembers: vi.fn(),
      updateRole: vi.fn().mockResolvedValue({}),
      updateGroup: vi.fn().mockResolvedValue({}),
    });
  });

  it("sends the empty group description", async () => {
    const page = shallowMount(GroupDetailPage);
    await flushPromises();
    const vm = page.vm as unknown as SettingsVm;
    vm.settingsForm.description = "";
    await vm.saveSettings();

    expect(state.store!.updateGroup).toHaveBeenCalledWith(
      expect.anything(),
      "",
    );
  });

  it("sends the empty role description", async () => {
    const page = shallowMount(RoleDetailPage);
    await flushPromises();
    const vm = page.vm as unknown as SettingsVm;
    vm.settingsForm.description = "";
    await vm.saveSettings();

    expect(state.store!.updateRole).toHaveBeenCalledWith(expect.anything(), {
      description: "",
      permissions: ["a:read"],
    });
  });
});
