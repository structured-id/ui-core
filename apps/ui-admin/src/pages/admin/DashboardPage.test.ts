import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import DashboardPage from "./DashboardPage.vue";

// Stub ui-core components
vi.mock("@structured-id/ui-core/quasar", () => ({
  SidPrincipalInput: {
    name: "SidPrincipalInput",
    template: '<input class="sid-principal-input" />',
    props: ["modelValue", "principalType"],
    emits: ["update:modelValue", "update:principalType"],
  },
}));

function mountPage() {
  return mount(DashboardPage, {
    global: {
      plugins: [createPinia()],
      stubs: {
        QPage: { template: "<div><slot /></div>" },
        QCard: { template: "<div><slot /></div>" },
        QCardSection: { template: "<div><slot /></div>" },
        QIcon: { template: "<i />" },
        QBadge: {
          template: '<span class="q-badge">{{ label }}</span>',
          props: ["color", "label"],
        },
      },
    },
  });
}

describe("DashboardPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders the dashboard heading", () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain("Admin Dashboard");
  });

  it("renders all 4 stat cards", () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain("Users");
    expect(wrapper.text()).toContain("Applications");
    expect(wrapper.text()).toContain("Active Sessions");
    expect(wrapper.text()).toContain("Events (24h)");
  });

  it("renders Principal Input Demo section", () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain("Principal Input Demo");
    expect(wrapper.find(".sid-principal-input").exists()).toBe(true);
  });

  it("renders System Health section", () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain("System Health");
  });
});
