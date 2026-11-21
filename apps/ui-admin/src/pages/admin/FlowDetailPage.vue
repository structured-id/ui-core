<template>
  <q-page padding>
    <!-- Loading -->
    <q-linear-progress
      v-if="store.loading && !store.currentFlow"
      indeterminate
      color="primary"
      class="q-mb-md"
    />

    <!-- Error -->
    <q-banner v-if="store.error" dense class="bg-negative text-white q-mb-md">
      {{ store.error }}
    </q-banner>

    <template v-if="store.currentFlow">
      <!-- Header -->
      <div class="row items-center q-mb-lg">
        <q-btn
          flat
          round
          dense
          icon="sym_o_arrow_back"
          :to="{ name: 'admin-flows' }"
          class="q-mr-sm"
        />
        <div class="col">
          <div class="text-h5">
            {{ store.currentFlow.name }}
            <q-badge
              v-if="store.currentFlow.builtIn"
              color="blue-grey"
              label="Built-in"
              class="q-ml-sm"
            />
            <q-badge
              :color="flowPurposeColor(store.currentFlow.purpose)"
              :label="flowPurposeLabel(store.currentFlow.purpose)"
              class="q-ml-sm"
            />
            <q-icon
              v-if="store.currentFlow.bound"
              name="sym_o_check_circle"
              color="positive"
              size="sm"
              class="q-ml-sm"
            >
              <q-tooltip>Active binding</q-tooltip>
            </q-icon>
          </div>
          <div
            v-if="store.currentFlow.description"
            class="text-body2 text-grey-7"
          >
            {{ store.currentFlow.description }}
          </div>
        </div>
        <q-btn
          v-if="!store.currentFlow.bound"
          outline
          color="primary"
          icon="sym_o_link"
          label="Bind as Active"
          no-caps
          @click="handleBind"
        />
      </div>

      <!-- Tabs -->
      <q-tabs
        v-model="tab"
        dense
        align="left"
        active-color="primary"
        indicator-color="primary"
        class="q-mb-md"
        no-caps
      >
        <q-tab name="pipeline" label="Pipeline" />
        <q-tab name="actions" label="Actions" />
        <q-tab name="settings" label="Settings" />
      </q-tabs>

      <q-tab-panels v-model="tab" animated>
        <!-- Pipeline Tab -->
        <q-tab-panel name="pipeline" class="q-pa-none">
          <div class="row items-center q-mb-md">
            <div class="col text-subtitle1 text-weight-medium">
              Step Bindings
            </div>
            <q-btn
              color="primary"
              icon="sym_o_add"
              label="Add Step"
              no-caps
              size="sm"
              @click="showAddStepDialog = true"
            />
          </div>

          <!-- Step bindings list -->
          <q-list bordered separator v-if="store.stepBindings.length">
            <q-item
              v-for="(binding, idx) in store.stepBindings"
              :key="binding.id"
            >
              <q-item-section avatar>
                <q-avatar
                  color="grey-3"
                  text-color="grey-8"
                  size="32px"
                  class="text-weight-bold"
                >
                  {{ idx + 1 }}
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ binding.displayName }}</q-item-label>
                <q-item-label caption>
                  {{ binding.stepType }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge
                  :color="stepRequirementColor(binding.requirement)"
                  :label="stepRequirementLabel(binding.requirement)"
                />
              </q-item-section>
              <q-item-section side>
                <div class="q-gutter-xs">
                  <q-btn
                    flat
                    round
                    dense
                    icon="sym_o_arrow_upward"
                    size="xs"
                    :disable="idx === 0"
                    @click="moveStep(idx, idx - 1)"
                  />
                  <q-btn
                    flat
                    round
                    dense
                    icon="sym_o_arrow_downward"
                    size="xs"
                    :disable="idx === store.stepBindings.length - 1"
                    @click="moveStep(idx, idx + 1)"
                  />
                  <q-btn
                    flat
                    round
                    dense
                    icon="sym_o_delete"
                    size="xs"
                    color="negative"
                    @click="removeStep(store.currentFlow!.id, binding.id)"
                  />
                </div>
              </q-item-section>
            </q-item>
          </q-list>

          <div v-else class="text-grey-5 text-center q-pa-xl text-body1">
            No steps configured. Add a step to build the authentication
            pipeline.
          </div>
        </q-tab-panel>

        <!-- Actions Tab -->
        <q-tab-panel name="actions" class="q-pa-none">
          <div class="row items-center q-mb-md">
            <div class="col text-subtitle1 text-weight-medium">
              Actions (Hooks)
            </div>
            <q-btn
              color="primary"
              icon="sym_o_add"
              label="Create Action"
              no-caps
              size="sm"
              @click="showCreateActionDialog = true"
            />
          </div>

          <!-- Actions table -->
          <q-table
            :rows="store.actions"
            :columns="actionColumns"
            row-key="id"
            flat
            bordered
            :pagination="{ rowsPerPage: 10 }"
          >
            <template #body-cell-type="props">
              <q-td :props="props">
                <q-icon
                  :name="actionTypeIcon(props.row.type)"
                  size="xs"
                  class="q-mr-xs"
                />
                {{ actionTypeLabel(props.row.type) }}
              </q-td>
            </template>
            <template #body-cell-hookPoint="props">
              <q-td :props="props">
                {{ actionHookPointLabel(props.row.hookPoint) }}
              </q-td>
            </template>
            <template #body-cell-enabled="props">
              <q-td :props="props">
                <q-toggle
                  :model-value="props.row.enabled"
                  dense
                  @update:model-value="
                    toggleAction(props.row.id, $event as boolean)
                  "
                />
              </q-td>
            </template>
            <template #body-cell-actionsCol="props">
              <q-td :props="props" auto-width>
                <q-btn
                  flat
                  round
                  dense
                  icon="sym_o_play_arrow"
                  size="sm"
                  color="primary"
                  @click="handleTestAction(props.row.id)"
                >
                  <q-tooltip>Test action</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  round
                  dense
                  icon="sym_o_delete"
                  size="sm"
                  color="negative"
                  @click="store.deleteAction(props.row.id)"
                />
              </q-td>
            </template>
          </q-table>

          <!-- Builtin Actions -->
          <div class="text-subtitle1 text-weight-medium q-mt-lg q-mb-md">
            Built-in Actions
          </div>
          <q-list bordered separator v-if="store.builtinActions.length">
            <q-item v-for="ba in store.builtinActions" :key="ba.actionType">
              <q-item-section>
                <q-item-label>{{ ba.displayName }}</q-item-label>
                <q-item-label caption>{{ ba.description }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  :model-value="ba.enabled"
                  dense
                  @update:model-value="
                    store.configureBuiltinAction({
                      actionType: ba.actionType,
                      enabled: $event as boolean,
                    })
                  "
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-tab-panel>

        <!-- Settings Tab -->
        <q-tab-panel name="settings" class="q-pa-none">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle1 text-weight-medium q-mb-md">
                Flow Settings
              </div>
              <q-input
                v-model="settingsForm.name"
                outlined
                dense
                label="Name"
                class="q-mb-md"
              />
              <q-input
                v-model="settingsForm.description"
                outlined
                dense
                label="Description"
                type="textarea"
                rows="3"
              />
            </q-card-section>
            <q-card-actions>
              <q-btn
                color="primary"
                label="Save"
                no-caps
                :loading="store.loading"
                @click="saveSettings"
              />
            </q-card-actions>
          </q-card>
        </q-tab-panel>
      </q-tab-panels>
    </template>

    <!-- Add Step Dialog -->
    <q-dialog v-model="showAddStepDialog" persistent>
      <q-card style="min-width: 450px">
        <q-card-section>
          <div class="text-h6">Add Step</div>
        </q-card-section>
        <q-card-section>
          <q-select
            v-model="addStepForm.stepType"
            outlined
            dense
            :options="stepTypeOptions"
            emit-value
            map-options
            label="Step Type"
            class="q-mb-md"
          >
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption>
                    {{ scope.opt.description }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
          <q-input
            v-model="addStepForm.displayName"
            outlined
            dense
            label="Display Name"
            class="q-mb-md"
          />
          <q-select
            v-model="addStepForm.requirement"
            outlined
            dense
            :options="requirementOptions"
            emit-value
            map-options
            label="Requirement"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Add"
            no-caps
            :loading="store.loading"
            @click="submitAddStep"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Create Action Dialog -->
    <q-dialog v-model="showCreateActionDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Create Action</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="actionForm.name"
            outlined
            dense
            label="Name"
            class="q-mb-md"
          />
          <q-input
            v-model="actionForm.description"
            outlined
            dense
            label="Description"
            class="q-mb-md"
          />
          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-6">
              <q-select
                v-model="actionForm.type"
                outlined
                dense
                :options="actionTypeOptions"
                emit-value
                map-options
                label="Type"
              />
            </div>
            <div class="col-6">
              <q-select
                v-model="actionForm.hookPoint"
                outlined
                dense
                :options="hookPointOptions"
                emit-value
                map-options
                label="Hook Point"
              />
            </div>
          </div>
          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-6">
              <q-input
                v-model.number="actionForm.priority"
                outlined
                dense
                label="Priority"
                type="number"
              />
            </div>
            <div class="col-6">
              <q-toggle v-model="actionForm.enabled" label="Enabled" />
            </div>
          </div>

          <!-- Webhook fields -->
          <template v-if="actionForm.type === ActionType.WEBHOOK">
            <q-input
              v-model="actionForm.webhookUrl"
              outlined
              dense
              label="Webhook URL"
              class="q-mb-md"
            />
            <q-input
              v-model="actionForm.webhookSecret"
              outlined
              dense
              label="Webhook Secret"
              type="password"
              class="q-mb-md"
            />
            <q-input
              v-model.number="actionForm.webhookTimeoutMs"
              outlined
              dense
              label="Timeout (ms)"
              type="number"
            />
          </template>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Create"
            no-caps
            :loading="store.loading"
            @click="submitCreateAction"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Test Action Result Dialog -->
    <q-dialog v-model="showTestResult">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Test Result</div>
        </q-card-section>
        <q-card-section v-if="testResult">
          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-6">
              <div class="text-caption text-grey">Status</div>
              <q-badge
                :color="testResult.success ? 'positive' : 'negative'"
                :label="testResult.success ? 'Success' : 'Failed'"
              />
            </div>
            <div class="col-3">
              <div class="text-caption text-grey">HTTP Code</div>
              <div>{{ testResult.statusCode }}</div>
            </div>
            <div class="col-3">
              <div class="text-caption text-grey">Latency</div>
              <div>{{ testResult.latencyMs }}ms</div>
            </div>
          </div>
          <div v-if="testResult.error" class="q-mb-md">
            <div class="text-caption text-grey">Error</div>
            <div class="text-negative">{{ testResult.error }}</div>
          </div>
          <div v-if="testResult.responseBody">
            <div class="text-caption text-grey">Response</div>
            <pre class="bg-grey-2 q-pa-sm rounded-borders text-body2">{{
              testResult.responseBody
            }}</pre>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useFlowsStore } from "#admin/stores/flows";
import {
  StepRequirement,
  ActionType,
  ActionHookPoint,
} from "@structured-id/proto/sid/v1/authn/flows";
import type { TestActionResponse } from "@structured-id/proto/sid/v1/authn/flows";
import {
  flowPurposeLabel,
  flowPurposeColor,
  stepRequirementLabel,
  stepRequirementColor,
  actionTypeLabel,
  actionTypeIcon,
  actionHookPointLabel,
} from "#admin/composables/useEnumLabels";
import type { QTableColumn } from "quasar";

const route = useRoute();
const store = useFlowsStore();

const tab = ref("pipeline");
const showAddStepDialog = ref(false);
const showCreateActionDialog = ref(false);
const showTestResult = ref(false);
const testResult = ref<TestActionResponse | null>(null);

const settingsForm = ref({ name: "", description: "" });

const addStepForm = ref({
  stepType: "",
  displayName: "",
  requirement: StepRequirement.REQUIRED,
});

const actionForm = ref({
  name: "",
  description: "",
  type: ActionType.WEBHOOK,
  hookPoint: ActionHookPoint.POST_AUTHENTICATION,
  enabled: true,
  priority: 0,
  webhookUrl: "",
  webhookSecret: "",
  webhookTimeoutMs: 5000,
  eventFilters: [] as string[],
});

const requirementOptions = [
  { label: "Required", value: StepRequirement.REQUIRED },
  { label: "Alternative", value: StepRequirement.ALTERNATIVE },
  { label: "Optional", value: StepRequirement.OPTIONAL },
  { label: "Conditional", value: StepRequirement.CONDITIONAL },
  { label: "Disabled", value: StepRequirement.DISABLED },
];

const actionTypeOptions = [
  { label: "Webhook", value: ActionType.WEBHOOK },
  { label: "Log", value: ActionType.LOG },
  { label: "Assign Role", value: ActionType.ASSIGN_ROLE },
  { label: "Add Claim", value: ActionType.ADD_CLAIM },
  { label: "Send Email", value: ActionType.SEND_EMAIL },
  { label: "Deny", value: ActionType.DENY },
  { label: "Redirect", value: ActionType.REDIRECT },
];

const hookPointOptions = [
  { label: "Pre Authentication", value: ActionHookPoint.PRE_AUTHENTICATION },
  { label: "Post Authentication", value: ActionHookPoint.POST_AUTHENTICATION },
  { label: "Post MFA", value: ActionHookPoint.POST_MFA },
  { label: "Pre Token Creation", value: ActionHookPoint.PRE_TOKEN_CREATION },
  { label: "Post Login", value: ActionHookPoint.POST_LOGIN },
  { label: "Post Registration", value: ActionHookPoint.POST_REGISTRATION },
  { label: "Pre Consent", value: ActionHookPoint.PRE_CONSENT },
];

const stepTypeOptions = computed(() =>
  store.stepTypes.map((t) => ({
    label: t.displayName,
    value: t.type,
    description: t.description,
  })),
);

const actionColumns: QTableColumn[] = [
  { name: "name", label: "Name", field: "name", align: "left", sortable: true },
  { name: "type", label: "Type", field: "type", align: "left", sortable: true },
  {
    name: "hookPoint",
    label: "Hook Point",
    field: "hookPoint",
    align: "left",
    sortable: true,
  },
  {
    name: "priority",
    label: "Priority",
    field: "priority",
    align: "center",
    sortable: true,
  },
  { name: "enabled", label: "Enabled", field: "enabled", align: "center" },
  { name: "actionsCol", label: "", field: "id", align: "right" },
];

watch(
  () => store.currentFlow,
  (flow) => {
    if (flow) {
      settingsForm.value = {
        name: flow.name,
        description: flow.description,
      };
    }
  },
);

onMounted(async () => {
  const flowId = route.params.flowId as string;
  await Promise.all([
    store.fetchFlow(flowId),
    store.fetchStepBindings(flowId),
    store.fetchStepTypes(),
    store.fetchActions(),
    store.fetchBuiltinActions(),
  ]);
});

async function handleBind() {
  if (!store.currentFlow) return;
  await store.bindFlow(store.currentFlow.id, store.currentFlow.purpose);
}

async function submitAddStep() {
  if (!store.currentFlow) return;
  try {
    await store.addStepBinding({
      flowId: store.currentFlow.id,
      stepType: addStepForm.value.stepType,
      displayName: addStepForm.value.displayName,
      requirement: addStepForm.value.requirement,
      order: store.stepBindings.length,
    });
    showAddStepDialog.value = false;
    addStepForm.value = {
      stepType: "",
      displayName: "",
      requirement: StepRequirement.REQUIRED,
    };
  } catch {
    // error shown via store.error
  }
}

async function moveStep(fromIdx: number, toIdx: number) {
  if (!store.currentFlow) return;
  const ids = store.stepBindings.map((b) => b.id);
  const [moved] = ids.splice(fromIdx, 1);
  ids.splice(toIdx, 0, moved);
  await store.reorderStepBindings(store.currentFlow.id, ids);
}

async function removeStep(flowId: string, bindingId: string) {
  await store.removeStepBinding(flowId, bindingId);
}

async function toggleAction(actionId: string, enabled: boolean) {
  await store.updateAction({
    actionId,
    enabled,
    eventFilters: [],
  });
}

async function submitCreateAction() {
  try {
    await store.createAction(actionForm.value);
    showCreateActionDialog.value = false;
    actionForm.value = {
      name: "",
      description: "",
      type: ActionType.WEBHOOK,
      hookPoint: ActionHookPoint.POST_AUTHENTICATION,
      enabled: true,
      priority: 0,
      webhookUrl: "",
      webhookSecret: "",
      webhookTimeoutMs: 5000,
      eventFilters: [],
    };
  } catch {
    // error shown via store.error
  }
}

async function handleTestAction(actionId: string) {
  try {
    testResult.value = await store.testAction(actionId);
    showTestResult.value = true;
  } catch {
    // error shown via store.error
  }
}

async function saveSettings() {
  if (!store.currentFlow) return;
  await store.updateFlow({
    flowId: store.currentFlow.id,
    name: settingsForm.value.name,
    description: settingsForm.value.description,
  });
}
</script>
