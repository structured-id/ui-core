import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({
  listStepBindings: vi.fn(),
  reorderStepBindings: vi.fn(),
  addStepBinding: vi.fn(),
  updateStepBinding: vi.fn(),
  removeStepBinding: vi.fn(),
}));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/authn/flows.client", () => ({
  FlowServiceClient: class {
    listStepBindings = mocks.listStepBindings;
    reorderStepBindings = mocks.reorderStepBindings;
    addStepBinding = mocks.addStepBinding;
    updateStepBinding = mocks.updateStepBinding;
    removeStepBinding = mocks.removeStepBinding;
  },
  StepServiceClient: class {},
  ActionServiceClient: class {},
}));

import { useFlowsStore } from "./flows";

/** B's pipeline as its list answers it; a fresh array each time, since the
 *  store keeps the answered array itself. */
const bPipeline = () => [{ id: "b1", displayName: "b step" }];
const bOnly = bPipeline();

describe("flows store: step bindings of the shown flow", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Regression: a reorder or an added step of flow A answered after flow B
  // was opened replaced or extended B's pipeline with A's bindings; B's page
  // then moved and removed A's bindings under B's id.
  it("keeps another flow's pipeline when a step change of the former answers late", async () => {
    let reorderA!: (v: unknown) => void;
    let addA!: (v: unknown) => void;
    mocks.reorderStepBindings.mockReturnValueOnce(
      new Promise((r) => (reorderA = r)),
    );
    mocks.addStepBinding.mockReturnValueOnce(new Promise((r) => (addA = r)));
    mocks.listStepBindings
      .mockResolvedValueOnce({ response: { bindings: [{ id: "a1" }] } })
      .mockResolvedValueOnce({ response: { bindings: bPipeline() } });
    const store = useFlowsStore();

    await store.fetchStepBindings("A");
    const reordering = store.reorderStepBindings("A", ["a1"]);
    const adding = store.addStepBinding({
      flowId: "A",
      stepType: "otp",
      displayName: "a step",
      requirement: 0,
      order: 1,
    });
    await store.fetchStepBindings("B");

    reorderA({ response: { bindings: [{ id: "a1" }] } });
    addA({ response: { id: "a2" } });
    await reordering;
    await adding;

    expect(store.stepBindings).toEqual(bOnly);
  });

  // Updates and removals answered for a flow no longer shown leave the shown
  // pipeline as it is.
  it("keeps the shown pipeline when an update or removal of the former answers late", async () => {
    let updateA!: (v: unknown) => void;
    let removeA!: (v: unknown) => void;
    mocks.updateStepBinding.mockReturnValueOnce(
      new Promise((r) => (updateA = r)),
    );
    mocks.removeStepBinding.mockReturnValueOnce(
      new Promise((r) => (removeA = r)),
    );
    mocks.listStepBindings
      .mockResolvedValueOnce({ response: { bindings: [{ id: "b1" }] } })
      .mockResolvedValueOnce({ response: { bindings: bPipeline() } });
    const store = useFlowsStore();

    await store.fetchStepBindings("A");
    const updating = store.updateStepBinding({
      flowId: "A",
      bindingId: "b1",
      displayName: "renamed",
    });
    const removing = store.removeStepBinding("A", "b1");
    await store.fetchStepBindings("B");

    updateA({ response: { id: "b1", displayName: "renamed" } });
    removeA({ response: {} });
    await updating;
    await removing;

    expect(store.stepBindings).toEqual(bOnly);
  });
});
