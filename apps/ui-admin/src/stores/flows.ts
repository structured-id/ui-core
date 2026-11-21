import { defineStore } from "pinia";
import { ref } from "vue";
import {
  FlowServiceClient,
  StepServiceClient,
  ActionServiceClient,
} from "@structured-id/proto/sid/v1/authn/flows.client";
import type {
  Flow,
  StepBinding,
  StepType,
  Action,
  BuiltinAction,
  ActionEventType,
} from "@structured-id/proto/sid/v1/authn/flows";
import {
  FlowPurpose,
  StepRequirement,
} from "@structured-id/proto/sid/v1/authn/flows";
import { getAccountTransport } from "@structured-id/ui-core";
import { Empty } from "@structured-id/proto/google/protobuf/empty";

function getFlowClient() {
  return new FlowServiceClient(getAccountTransport());
}

function getStepClient() {
  return new StepServiceClient(getAccountTransport());
}

function getActionClient() {
  return new ActionServiceClient(getAccountTransport());
}

export const useFlowsStore = defineStore("flows", () => {
  // ── State ──
  const flows = ref<Flow[]>([]);
  const currentFlow = ref<Flow | null>(null);
  const stepBindings = ref<StepBinding[]>([]);
  const stepTypes = ref<StepType[]>([]);
  const actions = ref<Action[]>([]);
  const builtinActions = ref<BuiltinAction[]>([]);
  const eventTypes = ref<ActionEventType[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ── Flows ──

  async function fetchFlows() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getFlowClient().listFlows(Empty.create());
      flows.value = response.flows;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load flows";
    } finally {
      loading.value = false;
    }
  }

  /**
   * The flow whose detail (flow, step bindings) is shown; another flow's
   * starts empty and a late answer for a flow no longer shown is dropped.
   */
  let flowShown = "";

  function showFlow(flowId: string): void {
    if (flowShown !== flowId) {
      flowShown = flowId;
      currentFlow.value = null;
      stepBindings.value = [];
    }
  }

  async function fetchFlow(flowId: string) {
    showFlow(flowId);
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getFlowClient().getFlow({ flowId });
      if (flowShown === flowId) currentFlow.value = response;
      return response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load flow";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createFlow(req: {
    name: string;
    description: string;
    purpose: FlowPurpose;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getFlowClient().createFlow(req);
      flows.value.push(response);
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to create flow";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateFlow(req: {
    flowId: string;
    name?: string;
    description?: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getFlowClient().updateFlow(req);
      const idx = flows.value.findIndex((f) => f.id === req.flowId);
      if (idx !== -1) flows.value[idx] = response;
      if (currentFlow.value?.id === req.flowId) currentFlow.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update flow";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteFlow(flowId: string) {
    loading.value = true;
    error.value = null;
    try {
      await getFlowClient().deleteFlow({ flowId });
      flows.value = flows.value.filter((f) => f.id !== flowId);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete flow";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function duplicateFlow(flowId: string, newName: string) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getFlowClient().duplicateFlow({
        flowId,
        newName,
      });
      flows.value.push(response);
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to duplicate flow";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function bindFlow(flowId: string, purpose: FlowPurpose) {
    loading.value = true;
    error.value = null;
    try {
      await getFlowClient().bindFlow({ flowId, purpose });
      await fetchFlows();
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to bind flow";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function exportBlueprint(flowId: string) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getFlowClient().exportBlueprint({ flowId });
      return response.yaml;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to export blueprint";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function importBlueprint(yaml: string, name: string) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getFlowClient().importBlueprint({
        yaml,
        name,
      });
      flows.value.push(response);
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to import blueprint";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Step Bindings ──

  async function fetchStepBindings(flowId: string) {
    showFlow(flowId);
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getFlowClient().listStepBindings({ flowId });
      if (flowShown === flowId) stepBindings.value = response.bindings;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load step bindings";
    } finally {
      loading.value = false;
    }
  }

  async function addStepBinding(req: {
    flowId: string;
    stepType: string;
    displayName: string;
    requirement: StepRequirement;
    order: number;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getFlowClient().addStepBinding(req);
      if (flowShown === req.flowId) stepBindings.value.push(response);
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to add step binding";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateStepBinding(req: {
    flowId: string;
    bindingId: string;
    displayName?: string;
    requirement?: StepRequirement;
    order?: number;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getFlowClient().updateStepBinding(req);
      if (flowShown === req.flowId) {
        const idx = stepBindings.value.findIndex((b) => b.id === req.bindingId);
        if (idx !== -1) stepBindings.value[idx] = response;
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update step binding";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function removeStepBinding(flowId: string, bindingId: string) {
    loading.value = true;
    error.value = null;
    try {
      await getFlowClient().removeStepBinding({ flowId, bindingId });
      if (flowShown === flowId) {
        stepBindings.value = stepBindings.value.filter(
          (b) => b.id !== bindingId,
        );
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to remove step binding";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function reorderStepBindings(flowId: string, bindingIds: string[]) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getFlowClient().reorderStepBindings({
        flowId,
        bindingIds,
      });
      if (flowShown === flowId) stepBindings.value = response.bindings;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to reorder steps";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Step Types ──

  async function fetchStepTypes() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getStepClient().listStepTypes(Empty.create());
      stepTypes.value = response.types;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load step types";
    } finally {
      loading.value = false;
    }
  }

  // ── Actions ──

  async function fetchActions() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getActionClient().listActions(Empty.create());
      actions.value = response.actions;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load actions";
    } finally {
      loading.value = false;
    }
  }

  async function createAction(req: {
    name: string;
    description: string;
    type: number;
    hookPoint: number;
    enabled: boolean;
    priority: number;
    webhookUrl: string;
    webhookSecret: string;
    webhookTimeoutMs: number;
    eventFilters: string[];
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getActionClient().createAction(req);
      actions.value.push(response);
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to create action";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateAction(req: {
    actionId: string;
    name?: string;
    description?: string;
    enabled?: boolean;
    priority?: number;
    webhookUrl?: string;
    webhookSecret?: string;
    webhookTimeoutMs?: number;
    eventFilters: string[];
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getActionClient().updateAction(req);
      const idx = actions.value.findIndex((a) => a.id === req.actionId);
      if (idx !== -1) actions.value[idx] = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update action";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteAction(actionId: string) {
    loading.value = true;
    error.value = null;
    try {
      await getActionClient().deleteAction({ actionId });
      actions.value = actions.value.filter((a) => a.id !== actionId);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete action";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function testAction(actionId: string) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getActionClient().testAction({ actionId });
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to test action";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchBuiltinActions() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getActionClient().listBuiltinActions(
        Empty.create(),
      );
      builtinActions.value = response.actions;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load builtin actions";
    } finally {
      loading.value = false;
    }
  }

  async function configureBuiltinAction(req: {
    actionType: string;
    enabled: boolean;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getActionClient().configureBuiltinAction(req);
      const idx = builtinActions.value.findIndex(
        (a) => a.actionType === req.actionType,
      );
      if (idx !== -1) builtinActions.value[idx] = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to configure builtin action";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchEventTypes() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getActionClient().listEventTypes(
        Empty.create(),
      );
      eventTypes.value = response.eventTypes;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load event types";
    } finally {
      loading.value = false;
    }
  }

  return {
    flows,
    currentFlow,
    stepBindings,
    stepTypes,
    actions,
    builtinActions,
    eventTypes,
    loading,
    error,
    fetchFlows,
    fetchFlow,
    createFlow,
    updateFlow,
    deleteFlow,
    duplicateFlow,
    bindFlow,
    exportBlueprint,
    importBlueprint,
    fetchStepBindings,
    addStepBinding,
    updateStepBinding,
    removeStepBinding,
    reorderStepBindings,
    fetchStepTypes,
    fetchActions,
    createAction,
    updateAction,
    deleteAction,
    testAction,
    fetchBuiltinActions,
    configureBuiltinAction,
    fetchEventTypes,
  };
});
