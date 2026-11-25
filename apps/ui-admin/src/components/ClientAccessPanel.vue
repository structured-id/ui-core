<template>
  <div class="q-gutter-md" style="max-width: 720px">
    <div class="text-subtitle2">Resources this client may reach</div>
    <div class="text-caption text-grey">
      A client obtains a token only for a resource it was given access to, with
      no more than the scopes of that access. Nothing else gives access: not the
      project, the issuer or the same user.
    </div>

    <q-banner v-if="failure" dense class="bg-negative text-white" rounded>
      {{ failure }}
      <template #action>
        <q-btn flat label="Try again" no-caps @click="load" />
      </template>
    </q-banner>

    <template v-if="rows === null && !failure">
      <q-skeleton v-for="n in 2" :key="n" type="text" />
    </template>

    <q-list v-else-if="rows" bordered separator data-test="access-list">
      <q-item v-if="!rows.length" data-test="access-empty">
        <q-item-section class="text-grey-7">
          This client has access to no resource. A request for a token is
          refused until it has one.
        </q-item-section>
      </q-item>
      <q-item v-for="row in rows" :key="row.key" data-test="access-row">
        <q-item-section>
          <q-item-label>
            {{ row.resource?.name ?? "A resource not listed here" }}
            <q-badge
              v-if="row.isDefault"
              color="primary"
              label="Default target"
              class="q-ml-sm"
              data-test="default-target"
            />
          </q-item-label>
          <q-item-label caption>
            {{ row.resource?.resource.indicator ?? row.key }}
          </q-item-label>
          <q-item-label caption>
            <template v-if="row.access.scopes.length">
              Scopes: {{ row.access.scopes.join(" ") }}
            </template>
            <template v-else>No scopes</template>
          </q-item-label>
        </q-item-section>
        <q-item-section v-if="!readonly" side>
          <div class="row q-gutter-xs">
            <q-btn
              v-if="!row.isDefault"
              flat
              dense
              no-caps
              color="primary"
              label="Make default"
              :disable="busy"
              data-test="make-default"
              @click="makeDefault(row)"
            />
            <q-btn
              v-else
              flat
              dense
              no-caps
              label="Clear default"
              :disable="busy"
              data-test="clear-default"
              @click="clearDefault"
            />
            <q-btn
              v-if="row.resource"
              flat
              dense
              no-caps
              label="Scopes"
              :disable="busy"
              data-test="edit-scopes"
              @click="openEdit(row.resource, row.access.scopes)"
            />
            <q-btn
              flat
              dense
              no-caps
              color="negative"
              label="Remove"
              :disable="busy"
              data-test="remove-access"
              @click="confirmRemove(row)"
            />
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <div v-if="rows && !defaultRow" class="text-caption text-grey-8">
      No default target: a token request must name its resource (the
      <code>resource</code> parameter), or it is refused.
    </div>

    <q-btn
      v-if="!readonly && rows"
      outline
      color="primary"
      icon="sym_o_add"
      label="Add access"
      no-caps
      :disable="busy || !addable.length"
      data-test="add-access"
      @click="openAdd"
    />
    <div
      v-if="!readonly && rows && !addable.length"
      class="text-caption text-grey"
    >
      The client has access to every resource registered under its issuer.
    </div>

    <q-dialog v-model="editOpen">
      <q-card style="min-width: 420px">
        <q-card-section class="text-subtitle1">
          {{ editing ? `Access to ${editing.name}` : "Add access" }}
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-if="!editing"
            v-model="chosen"
            outlined
            dense
            label="Resource"
            :options="addable"
            option-label="name"
            data-test="resource-select"
          >
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.name }}</q-item-label>
                  <q-item-label caption>
                    {{ scope.opt.resource.indicator }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
          <template v-if="target">
            <div class="text-caption text-grey">
              {{ target.resource.indicator }}
            </div>
            <div v-if="target.resource.scopes.length" class="q-gutter-sm">
              <q-checkbox
                v-for="scope in target.resource.scopes"
                :key="scope"
                v-model="scopes"
                :val="scope"
                :label="scope"
              />
            </div>
            <div v-else class="text-caption text-grey">
              This resource has no scopes.
            </div>
            <div class="text-body2" data-test="access-summary">
              {{ summary }}
            </div>
          </template>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" no-caps v-close-popup />
          <q-btn
            color="primary"
            label="Save"
            no-caps
            :disable="!target"
            :loading="busy"
            data-test="save-access"
            @click="save"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * A client's access to resources: what it may obtain tokens for, with which
 * scopes, and its default target. Every change is the administrator's
 * explicit choice and is stated before it is saved; the server checks each
 * one again.
 */
import { computed, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";
import { refusalMessage } from "@structured-id/ui-core";
import type {
  Application,
  OAuthClient,
  ResourceAccess,
} from "@structured-id/proto/sid/v1/projects/projects";
import { useApplicationsStore } from "#admin/stores/applications";
import {
  accessRows,
  grantableResources,
  resourcesWithoutAccess,
  type AccessRow,
  type NamedResource,
} from "#admin/resourceAccess";

const props = defineProps<{
  client: OAuthClient;
  /** The project's applications: where the resources are named. */
  applications: Application[];
  /** A client SID manages itself: shown, not changed here. */
  readonly?: boolean;
}>();

const store = useApplicationsStore();
const $q = useQuasar();

const access = ref<ResourceAccess[] | null>(null);
const failure = ref<string | null>(null);
const busy = ref(false);

const resources = computed(() =>
  grantableResources(props.applications, props.client),
);
const rows = computed<AccessRow[] | null>(() =>
  access.value === null
    ? null
    : accessRows(access.value, resources.value, props.client),
);
const defaultRow = computed(() => rows.value?.find((row) => row.isDefault));
const addable = computed(() =>
  resourcesWithoutAccess(resources.value, access.value ?? []),
);

async function load() {
  failure.value = null;
  try {
    access.value = await store.listClientAccess(props.client.clientId);
  } catch (e) {
    access.value = null;
    failure.value = refusalMessage(e, "The access could not be loaded");
  }
}

onMounted(load);
watch(() => props.client.clientId, load);

/** One change: run, then read the access again so the list is the server's. */
async function change(run: () => Promise<unknown>, done: string) {
  busy.value = true;
  try {
    await run();
    await load();
    $q.notify({ type: "positive", message: done });
    return true;
  } catch (e) {
    $q.notify({
      type: "negative",
      message: refusalMessage(e, "The change was not saved"),
    });
    return false;
  } finally {
    busy.value = false;
  }
}

const editOpen = ref(false);
/** The resource whose access is edited; null while adding a new access. */
const editing = ref<NamedResource | null>(null);
const chosen = ref<NamedResource | null>(null);
const scopes = ref<string[]>([]);
const target = computed(() => editing.value ?? chosen.value);

/** What saving the dialog gives, in the administrator's terms. */
const summary = computed(() => {
  if (!target.value) return "";
  const granted = scopes.value.length
    ? `with ${scopes.value.join(", ")}`
    : "with no scopes";
  return `${props.client.name} can obtain tokens for ${target.value.name} ${granted}. It gets access to nothing else.`;
});

function openAdd() {
  editing.value = null;
  chosen.value = addable.value.length === 1 ? addable.value[0]! : null;
  scopes.value = [];
  editOpen.value = true;
}

function openEdit(resource: NamedResource, current: string[]) {
  editing.value = resource;
  chosen.value = null;
  scopes.value = [...current];
  editOpen.value = true;
}

// A scope of one resource is not carried to another chosen in its place.
watch(chosen, () => {
  if (!editing.value) scopes.value = [];
});

async function save() {
  const to = target.value;
  if (!to) return;
  // Kept in the resource's own order, whatever order they were ticked in.
  const granted = to.resource.scopes.filter((s) => scopes.value.includes(s));
  const saved = await change(
    () => store.setClientAccess(props.client.clientId, to.resource.id, granted),
    `Access to ${to.name} saved`,
  );
  if (saved) editOpen.value = false;
}

function makeDefault(row: AccessRow) {
  return change(
    () => store.setDefaultTarget(props.client.clientId, row.access.resourceId),
    "Default target saved",
  );
}

function clearDefault() {
  return change(
    () => store.setDefaultTarget(props.client.clientId, undefined),
    "Default target removed",
  );
}

function confirmRemove(row: AccessRow) {
  const name = row.resource?.name ?? "this resource";
  $q.dialog({
    title: "Remove access?",
    message: row.isDefault
      ? `${props.client.name} loses access to ${name}, its default target: a request naming no resource is then refused. Tokens already issued are not withdrawn by this.`
      : `${props.client.name} loses access to ${name}. Tokens already issued are not withdrawn by this.`,
    cancel: true,
    persistent: true,
  }).onOk(() =>
    change(
      () =>
        store.removeClientAccess(props.client.clientId, row.access.resourceId),
      `Access to ${name} removed`,
    ),
  );
}

defineExpose({ load });
</script>
