import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, reactive } from "vue";
import { shallowMount } from "@vue/test-utils";

const store = vi.hoisted(() => ({
  value: null as null | Record<string, unknown>,
}));

vi.mock("#admin/stores/userProfile", () => ({
  useUserProfileStore: () => store.value,
}));

import ProfileSchemaPage from "./ProfileSchemaPage.vue";

type Vm = {
  viewMode: "visual" | "json";
  jsonText: string;
  localSchema: { groups: { name: string }[] } | null;
};

function mountPage() {
  return shallowMount(ProfileSchemaPage, {
    global: { stubs: { QBtnToggle: true, QCard: true, QBtn: true } },
  });
}

describe("ProfileSchemaPage: one draft in both editors", () => {
  beforeEach(() => {
    store.value = reactive({
      schema: { groups: [{ name: "Basic", attributes: [] }], jsonSchema: "" },
      loading: false,
      saving: false,
      error: null as string | null,
      fetchSchema: vi.fn(),
      updateSchema: vi.fn(),
    });
  });

  // Regression: visual edits were lost when the JSON editor, still holding
  // the loaded schema, was applied. It opens on the visual draft instead.
  it("opens the JSON editor on the visual edits", async () => {
    const vm = mountPage().vm as unknown as Vm;
    vm.localSchema!.groups[0].name = "Edited";

    vm.viewMode = "json";
    await nextTick();

    expect(JSON.parse(vm.jsonText).groups[0].name).toBe("Edited");
  });

  // JSON edits reach the visual editor; unparsable text keeps JSON open.
  it("takes JSON edits back to the visual editor, or stays on bad JSON", async () => {
    const vm = mountPage().vm as unknown as Vm;
    vm.viewMode = "json";
    await nextTick();

    vm.jsonText = JSON.stringify({
      groups: [{ name: "Typed", attributes: [] }],
    });
    vm.viewMode = "visual";
    await nextTick();
    expect(vm.localSchema!.groups[0].name).toBe("Typed");

    vm.viewMode = "json";
    await nextTick();
    vm.jsonText = "{";
    vm.viewMode = "visual";
    await nextTick();
    await nextTick();
    expect(vm.viewMode).toBe("json");
    // Regression: returning to the JSON editor rewrote the text from the
    // visual draft, losing what was typed.
    expect(vm.jsonText).toBe("{");
    expect(store.value!.error).toBe("Invalid JSON");
    expect(vm.localSchema!.groups[0].name).toBe("Typed");
  });
});
