<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5">User Profile Schema</div>
      <q-space />
      <q-btn-toggle
        v-model="viewMode"
        no-caps
        rounded
        unelevated
        toggle-color="primary"
        :options="[
          { value: 'visual', label: 'Visual Editor' },
          { value: 'json', label: 'JSON' },
        ]"
      />
    </div>

    <!-- Visual Editor -->
    <template v-if="viewMode === 'visual'">
      <!-- Attribute Groups -->
      <div v-if="localSchema" class="q-gutter-md">
        <q-card
          v-for="(group, gi) in localSchema.groups"
          :key="group.name"
          flat
          bordered
        >
          <q-card-section class="row items-center">
            <q-icon name="sym_o_folder" class="q-mr-sm" />
            <span class="text-subtitle1 text-weight-medium">
              {{ group.displayName }}
            </span>
            <q-badge class="q-ml-sm" outline>
              {{ group.attributes.length }} attributes
            </q-badge>
            <q-space />
            <q-btn
              flat
              dense
              icon="sym_o_edit"
              size="sm"
              @click="editGroup(gi)"
            />
            <q-btn
              flat
              dense
              icon="sym_o_delete"
              size="sm"
              color="negative"
              :disable="group.attributes.some((a) => a.isBase)"
              @click="deleteGroup(gi)"
            />
          </q-card-section>

          <q-table
            :rows="group.attributes"
            :columns="attrColumns"
            row-key="variableName"
            flat
            dense
            hide-pagination
            :pagination="{ rowsPerPage: 0 }"
          >
            <template #body-cell-dataType="props">
              <q-td :props="props">
                <q-chip
                  dense
                  size="sm"
                  :icon="attributeDataTypeIcon(props.row.dataType)"
                >
                  {{ attributeDataTypeLabel(props.row.dataType) }}
                </q-chip>
              </q-td>
            </template>

            <template #body-cell-required="props">
              <q-td :props="props">
                <q-icon
                  v-if="props.row.requiredOnRegistration"
                  name="sym_o_check_circle"
                  color="positive"
                  size="xs"
                >
                  <q-tooltip>Required on registration</q-tooltip>
                </q-icon>
                <q-icon v-else name="sym_o_circle" color="grey-4" size="xs" />
              </q-td>
            </template>

            <template #body-cell-permission="props">
              <q-td :props="props">
                <q-badge
                  :color="attributePermissionColor(props.row.permission)"
                  :label="attributePermissionLabel(props.row.permission)"
                />
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props" class="text-right">
                <q-btn
                  flat
                  dense
                  icon="sym_o_edit"
                  size="sm"
                  @click="editAttribute(gi, props.rowIndex)"
                />
                <q-btn
                  v-if="!props.row.isBase"
                  flat
                  dense
                  icon="sym_o_delete"
                  size="sm"
                  color="negative"
                  @click="deleteAttribute(gi, props.rowIndex)"
                />
              </q-td>
            </template>
          </q-table>

          <q-card-actions>
            <q-btn
              flat
              no-caps
              icon="sym_o_add"
              label="Add Attribute"
              color="primary"
              size="sm"
              @click="addAttribute(gi)"
            />
          </q-card-actions>
        </q-card>

        <!-- Add Group -->
        <q-btn
          outline
          no-caps
          icon="sym_o_create_new_folder"
          label="Add Group"
          color="primary"
          @click="addGroup"
        />
      </div>

      <!-- Save -->
      <div class="q-mt-lg" v-if="localSchema">
        <q-btn
          unelevated
          color="primary"
          label="Save Schema"
          icon="sym_o_save"
          :loading="store.saving"
          @click="saveSchema"
        />
      </div>
    </template>

    <!-- JSON Editor -->
    <template v-if="viewMode === 'json'">
      <q-card flat bordered>
        <q-card-section>
          <q-input
            v-model="jsonText"
            type="textarea"
            outlined
            autogrow
            :input-style="{ fontFamily: 'monospace', fontSize: '13px' }"
          />
        </q-card-section>
        <q-card-actions>
          <q-btn
            unelevated
            color="primary"
            label="Apply JSON"
            icon="sym_o_save"
            :loading="store.saving"
            @click="applyJson"
          />
        </q-card-actions>
      </q-card>
    </template>

    <!-- Skeleton -->
    <template v-if="store.loading && !localSchema">
      <q-card flat bordered v-for="i in 3" :key="i" class="q-mb-md">
        <q-card-section>
          <q-skeleton type="text" width="30%" />
          <q-skeleton type="rect" height="100px" class="q-mt-sm" />
        </q-card-section>
      </q-card>
    </template>

    <!-- Attribute Editor Dialog -->
    <q-dialog v-model="attrDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">
            {{
              editingAttr?.isBase
                ? "Edit Base Attribute"
                : isNewAttr
                  ? "Add Attribute"
                  : "Edit Attribute"
            }}
          </div>
        </q-card-section>
        <q-card-section v-if="editingAttr" class="q-gutter-sm">
          <q-input
            v-model="editingAttr.displayName"
            label="Display Name"
            outlined
            dense
          />
          <q-input
            v-model="editingAttr.variableName"
            label="Variable Name"
            outlined
            dense
            :disable="!isNewAttr"
            hint="Immutable after creation"
          />
          <q-select
            v-model="editingAttr.dataType"
            :options="dataTypeOptions"
            label="Data Type"
            outlined
            dense
            emit-value
            map-options
          />
          <q-input
            v-if="editingAttr.dataType === AttributeDataType.ENUM"
            v-model="enumOptionsText"
            label="Enum Options (comma-separated)"
            outlined
            dense
          />
          <q-select
            v-model="editingAttr.permission"
            :options="permissionOptions"
            label="Permission"
            outlined
            dense
            emit-value
            map-options
          />

          <div class="text-subtitle2 q-mt-sm">Required In</div>
          <div class="row q-gutter-sm">
            <q-checkbox
              v-model="editingAttr.requiredOnRegistration"
              label="Registration"
              dense
            />
            <q-checkbox
              v-model="editingAttr.requiredOnAdminEdit"
              label="Admin Edit"
              dense
            />
            <q-checkbox
              v-model="editingAttr.requiredOnUserEdit"
              label="User Edit"
              dense
            />
          </div>

          <div class="text-subtitle2 q-mt-sm">Validation</div>
          <div class="row q-gutter-sm">
            <q-input
              v-model.number="editingAttr.validation!.minLength"
              label="Min Length"
              outlined
              dense
              type="number"
              class="col"
            />
            <q-input
              v-model.number="editingAttr.validation!.maxLength"
              label="Max Length"
              outlined
              dense
              type="number"
              class="col"
            />
          </div>
          <q-input
            v-model="editingAttr.validation!.regexPattern"
            label="Regex Pattern"
            outlined
            dense
          />

          <div class="text-subtitle2 q-mt-sm">UI Hints</div>
          <q-input
            v-model="editingAttr.annotations!.placeholder"
            label="Placeholder"
            outlined
            dense
          />
          <q-input
            v-model="editingAttr.annotations!.helpText"
            label="Help Text"
            outlined
            dense
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            unelevated
            color="primary"
            label="Save"
            @click="saveAttribute"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Group Editor Dialog -->
    <q-dialog v-model="groupDialog">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">
            {{ isNewGroup ? "Add Group" : "Edit Group" }}
          </div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="groupName"
            label="Group Name"
            outlined
            dense
            :disable="!isNewGroup"
          />
          <q-input
            v-model="groupDisplayName"
            label="Display Name"
            outlined
            dense
            class="q-mt-sm"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated color="primary" label="Save" @click="saveGroup" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Error banner -->
    <q-banner v-if="store.error" class="bg-negative text-white q-mt-md" rounded>
      <template #avatar>
        <q-icon name="sym_o_error" />
      </template>
      {{ store.error }}
    </q-banner>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useUserProfileStore } from "src/stores/userProfile";
import type {
  ProfileSchema,
  ProfileAttribute,
} from "@structured-id/proto/sid/v1/admin/user_profile";
import {
  AttributeDataType,
  AttributePermission,
} from "@structured-id/proto/sid/v1/admin/user_profile";
import {
  attributeDataTypeLabel,
  attributeDataTypeIcon,
  attributePermissionLabel,
  attributePermissionColor,
} from "src/composables/useEnumLabels";

const store = useUserProfileStore();

const viewMode = ref<"visual" | "json">("visual");
const localSchema = ref<ProfileSchema | null>(null);
const jsonText = ref("");

// Attribute dialog state
const attrDialog = ref(false);
const editingAttr = ref<ProfileAttribute | null>(null);
const isNewAttr = ref(false);
const editingGroupIdx = ref(0);
const editingAttrIdx = ref(0);
const enumOptionsText = ref("");

// Group dialog state
const groupDialog = ref(false);
const isNewGroup = ref(false);
const editingGroupForDialog = ref(0);
const groupName = ref("");
const groupDisplayName = ref("");

const attrColumns = [
  {
    name: "displayName",
    label: "Display Name",
    field: "displayName",
    align: "left" as const,
  },
  {
    name: "variableName",
    label: "Variable Name",
    field: "variableName",
    align: "left" as const,
  },
  {
    name: "dataType",
    label: "Type",
    field: "dataType",
    align: "left" as const,
  },
  {
    name: "required",
    label: "Required",
    field: "requiredOnRegistration",
    align: "center" as const,
  },
  {
    name: "permission",
    label: "Permission",
    field: "permission",
    align: "left" as const,
  },
  { name: "actions", label: "", field: "actions", align: "right" as const },
];

const dataTypeOptions = [
  { value: AttributeDataType.STRING, label: "String" },
  { value: AttributeDataType.NUMBER, label: "Number" },
  { value: AttributeDataType.BOOLEAN, label: "Boolean" },
  { value: AttributeDataType.DATE, label: "Date" },
  { value: AttributeDataType.ENUM, label: "Enum" },
  { value: AttributeDataType.ARRAY, label: "Array" },
];

const permissionOptions = [
  { value: AttributePermission.ADMIN_ONLY, label: "Admin Only" },
  { value: AttributePermission.USER_READ_ONLY, label: "User Read-Only" },
  { value: AttributePermission.USER_READ_WRITE, label: "User Read-Write" },
];

function emptyAttr(): ProfileAttribute {
  return {
    variableName: "",
    displayName: "",
    dataType: AttributeDataType.STRING,
    requiredOnRegistration: false,
    requiredOnAdminEdit: false,
    requiredOnUserEdit: false,
    permission: AttributePermission.USER_READ_WRITE,
    validation: {
      minLength: 0,
      maxLength: 0,
      regexPattern: "",
      minValue: 0,
      maxValue: 0,
    },
    annotations: { placeholder: "", helpText: "", inputType: "" },
    isBase: false,
    order: 0,
    enumOptions: [],
  };
}

function addAttribute(groupIdx: number) {
  editingGroupIdx.value = groupIdx;
  isNewAttr.value = true;
  editingAttr.value = emptyAttr();
  enumOptionsText.value = "";
  attrDialog.value = true;
}

function editAttribute(groupIdx: number, attrIdx: number) {
  editingGroupIdx.value = groupIdx;
  editingAttrIdx.value = attrIdx;
  isNewAttr.value = false;
  const attr = localSchema.value!.groups[groupIdx].attributes[attrIdx];
  editingAttr.value = JSON.parse(JSON.stringify(attr));
  editingAttr.value!.validation ??= {
    minLength: 0,
    maxLength: 0,
    regexPattern: "",
    minValue: 0,
    maxValue: 0,
  };
  editingAttr.value!.annotations ??= {
    placeholder: "",
    helpText: "",
    inputType: "",
  };
  enumOptionsText.value = (editingAttr.value!.enumOptions ?? []).join(", ");
  attrDialog.value = true;
}

function saveAttribute() {
  if (!editingAttr.value || !localSchema.value) return;
  if (editingAttr.value.dataType === AttributeDataType.ENUM) {
    editingAttr.value.enumOptions = enumOptionsText.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const group = localSchema.value.groups[editingGroupIdx.value];
  if (isNewAttr.value) {
    editingAttr.value.order = group.attributes.length;
    group.attributes.push(editingAttr.value);
  } else {
    group.attributes[editingAttrIdx.value] = editingAttr.value;
  }
  attrDialog.value = false;
}

function deleteAttribute(groupIdx: number, attrIdx: number) {
  localSchema.value?.groups[groupIdx].attributes.splice(attrIdx, 1);
}

function addGroup() {
  isNewGroup.value = true;
  groupName.value = "";
  groupDisplayName.value = "";
  groupDialog.value = true;
}

function editGroup(groupIdx: number) {
  isNewGroup.value = false;
  editingGroupForDialog.value = groupIdx;
  const g = localSchema.value!.groups[groupIdx];
  groupName.value = g.name;
  groupDisplayName.value = g.displayName;
  groupDialog.value = true;
}

function saveGroup() {
  if (!localSchema.value) return;
  if (isNewGroup.value) {
    localSchema.value.groups.push({
      name: groupName.value,
      displayName: groupDisplayName.value,
      order: localSchema.value.groups.length,
      attributes: [],
    });
  } else {
    const g = localSchema.value.groups[editingGroupForDialog.value];
    g.displayName = groupDisplayName.value;
  }
  groupDialog.value = false;
}

function deleteGroup(groupIdx: number) {
  localSchema.value?.groups.splice(groupIdx, 1);
}

async function saveSchema() {
  if (!localSchema.value) return;
  await store.updateSchema(localSchema.value);
}

function applyJson() {
  try {
    const parsed = JSON.parse(jsonText.value) as ProfileSchema;
    localSchema.value = parsed;
    saveSchema();
  } catch {
    store.error = "Invalid JSON";
  }
}

watch(
  () => store.schema,
  (s) => {
    if (s) {
      localSchema.value = JSON.parse(JSON.stringify(s));
      jsonText.value = s.jsonSchema || JSON.stringify(s, null, 2);
    }
  },
  { immediate: true },
);

onMounted(() => {
  store.fetchSchema();
});
</script>
