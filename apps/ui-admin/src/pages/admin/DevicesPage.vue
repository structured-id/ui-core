<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none">Devices</h5>
        <p class="text-caption text-grey q-mb-none">
          User devices, trust levels and attestation.
        </p>
      </div>
      <div class="col-auto">
        <q-btn
          flat
          icon="sym_o_refresh"
          :loading="store.loading"
          @click="store.fetchAllDevices()"
        />
      </div>
    </div>

    <q-banner v-if="store.error" class="bg-negative text-white q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <!-- Filter bar -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-12 col-sm-4">
        <q-input
          v-model="search"
          outlined
          dense
          placeholder="Search devices..."
          clearable
        >
          <template #prepend>
            <q-icon name="sym_o_search" />
          </template>
        </q-input>
      </div>
      <div class="col-6 col-sm-3">
        <q-select
          v-model="filterAssurance"
          outlined
          dense
          :options="assuranceOptions"
          label="Assurance"
          emit-value
          map-options
          clearable
        />
      </div>
      <div class="col-6 col-sm-3">
        <q-select
          v-model="filterType"
          outlined
          dense
          :options="typeOptions"
          label="Device type"
          emit-value
          map-options
          clearable
        />
      </div>
    </div>

    <!-- Devices Table -->
    <q-table
      :rows="filteredDevices"
      :columns="columns"
      :row-key="(d: Device) => shown(d.id)"
      flat
      bordered
      :loading="store.loading"
      :pagination="{ rowsPerPage: 20 }"
    >
      <template #body-cell-device="props">
        <q-td :props="props">
          <div class="row items-center no-wrap q-gutter-sm">
            <q-icon :name="deviceIcon(props.row.deviceType)" size="20px" />
            <div>
              <div>
                {{
                  props.row.displayName ||
                  DeviceType[props.row.deviceType] ||
                  "Unknown"
                }}
              </div>
              <div v-if="props.row.osInfo" class="text-caption text-grey">
                {{ props.row.osInfo }}
              </div>
            </div>
          </div>
        </q-td>
      </template>

      <template #body-cell-assurance="props">
        <q-td :props="props">
          <q-badge
            :color="assuranceColor(props.row.assurance as DeviceAssurance)"
            :label="assuranceLabel(props.row.assurance as DeviceAssurance)"
          />
        </q-td>
      </template>

      <template #body-cell-attestation="props">
        <q-td :props="props">
          <q-icon
            :name="
              props.row.hardwareAttested ? 'sym_o_lock' : 'sym_o_lock_open'
            "
            :color="props.row.hardwareAttested ? 'positive' : 'grey'"
            size="18px"
          />
          <q-tooltip>
            {{
              props.row.hardwareAttested ? "Hardware attested" : "Software only"
            }}
          </q-tooltip>
        </q-td>
      </template>

      <template #body-cell-lastSeen="props">
        <q-td :props="props">
          {{ formatDate(props.row.lastSeenAt) }}
          <div v-if="props.row.lastIpGeo" class="text-caption text-grey">
            {{ props.row.lastIpGeo }}
          </div>
        </q-td>
      </template>

      <template #body-cell-actions="props">
        <q-td :props="props">
          <q-btn-group flat>
            <q-btn
              v-if="!props.row.trusted"
              flat
              dense
              size="sm"
              icon="sym_o_verified_user"
              color="positive"
              @click="handleTrust(props.row)"
            >
              <q-tooltip>Trust device</q-tooltip>
            </q-btn>
            <q-btn
              v-else
              flat
              dense
              size="sm"
              icon="sym_o_gpp_bad"
              color="warning"
              @click="handleRevokeTrust(props.row)"
            >
              <q-tooltip>Revoke trust</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              size="sm"
              icon="sym_o_edit"
              @click="handleRename(props.row)"
            >
              <q-tooltip>Rename</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              size="sm"
              icon="sym_o_delete"
              color="negative"
              @click="handleRemove(props.row)"
            >
              <q-tooltip>Remove device</q-tooltip>
            </q-btn>
          </q-btn-group>
        </q-td>
      </template>
    </q-table>

    <!-- Assurance Model Reference -->
    <q-card flat bordered class="q-mt-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Device Assurance Levels</div>
        <q-list dense separator>
          <q-item v-for="level in assuranceLevels" :key="level.value">
            <q-item-section avatar>
              <q-badge :color="level.color" :label="level.label" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ level.description }}</q-item-label>
              <q-item-label caption>
                Session TTL: {{ level.sessionTtl }} · MFA:
                {{ level.mfa }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useQuasar } from "quasar";
import {
  useDevicesStore,
  DeviceType,
  DeviceAssurance,
  type Device,
} from "#admin/stores/devices";
import { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import { DeviceId, required } from "@structured-id/ids";
import { shown } from "#admin/ids";

const $q = useQuasar();
const store = useDevicesStore();

const search = ref("");
const filterAssurance = ref<DeviceAssurance | null>(null);
const filterType = ref<DeviceType | null>(null);

const ASSURANCE_COLORS: Partial<Record<DeviceAssurance, string>> = {
  [DeviceAssurance.UNKNOWN]: "blue",
  [DeviceAssurance.RECOGNIZED]: "amber",
  [DeviceAssurance.TRUSTED]: "positive",
  [DeviceAssurance.MANAGED]: "teal",
};

const DEVICE_ICONS: Partial<Record<DeviceType, string>> = {
  [DeviceType.DESKTOP]: "sym_o_computer",
  [DeviceType.MOBILE]: "sym_o_smartphone",
  [DeviceType.BROWSER]: "sym_o_language",
  [DeviceType.IOT]: "sym_o_sensors",
  [DeviceType.EMBEDDED]: "sym_o_memory",
};

function deviceIcon(type: DeviceType): string {
  return DEVICE_ICONS[type] ?? "sym_o_devices";
}
function assuranceColor(assurance: DeviceAssurance | number): string {
  return ASSURANCE_COLORS[assurance as DeviceAssurance] ?? "grey";
}
function assuranceLabel(assurance: DeviceAssurance | number): string {
  return DeviceAssurance[assurance as DeviceAssurance] ?? "Unknown";
}

const assuranceOptions = [
  { label: "Unknown", value: DeviceAssurance.UNKNOWN },
  { label: "Recognized", value: DeviceAssurance.RECOGNIZED },
  { label: "Trusted", value: DeviceAssurance.TRUSTED },
  { label: "Managed", value: DeviceAssurance.MANAGED },
];

const typeOptions = [
  { label: "Desktop", value: DeviceType.DESKTOP },
  { label: "Mobile", value: DeviceType.MOBILE },
  { label: "Browser", value: DeviceType.BROWSER },
  { label: "IoT", value: DeviceType.IOT },
  { label: "Embedded", value: DeviceType.EMBEDDED },
];

const filteredDevices = computed(() => {
  let result = store.devices;
  if (search.value) {
    const q = search.value.toLowerCase();
    result = result.filter(
      (d) =>
        (d.displayName ?? "").toLowerCase().includes(q) ||
        (d.osInfo ?? "").toLowerCase().includes(q) ||
        (d.lastIpGeo ?? "").toLowerCase().includes(q),
    );
  }
  if (filterAssurance.value != null) {
    result = result.filter((d) => d.assurance === filterAssurance.value);
  }
  if (filterType.value != null) {
    result = result.filter((d) => d.deviceType === filterType.value);
  }
  return result;
});

const columns = [
  {
    name: "device",
    label: "Device",
    field: "displayName",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "assurance",
    label: "Assurance",
    field: "assurance",
    align: "center" as const,
    sortable: true,
  },
  {
    name: "attestation",
    label: "Attestation",
    field: "hardwareAttested",
    align: "center" as const,
  },
  {
    name: "lastSeen",
    label: "Last Seen",
    field: "lastSeenAt",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "actions",
    label: "Actions",
    field: "id",
    align: "right" as const,
  },
];

const assuranceLevels = [
  {
    value: DeviceAssurance.UNKNOWN,
    label: "Unknown",
    color: "blue",
    description: "First login from this device",
    sessionTtl: "5-15 min",
    mfa: "Always required",
  },
  {
    value: DeviceAssurance.RECOGNIZED,
    label: "Recognized",
    color: "amber",
    description: "Seen before, not explicitly trusted",
    sessionTtl: "1-4 hours",
    mfa: "On sensitive ops",
  },
  {
    value: DeviceAssurance.TRUSTED,
    label: "Trusted",
    color: "positive",
    description: "User-trusted, hardware attested",
    sessionTtl: "4-12 hours",
    mfa: "Reduced friction",
  },
];

function formatDate(ts?: { seconds: bigint; nanos: number }): string {
  if (!ts) return "—";
  return Timestamp.toDate(ts).toLocaleDateString();
}

/** The device's identifier as its answer carried it; malformed throws. */
function deviceId(device: Device): DeviceId {
  return required(DeviceId, device.id);
}

async function handleTrust(device: Device) {
  try {
    await store.trustDevice(deviceId(device));
    $q.notify({ type: "positive", message: "Device trusted" });
  } catch {
    $q.notify({ type: "negative", message: "Failed to trust device" });
  }
}

async function handleRevokeTrust(device: Device) {
  $q.dialog({
    title: "Revoke trust",
    message: `Revoke trust for "${device.displayName || "this device"}"?`,
    cancel: true,
  }).onOk(async () => {
    try {
      await store.revokeDeviceTrust(deviceId(device));
      $q.notify({ type: "positive", message: "Trust revoked" });
    } catch {
      $q.notify({ type: "negative", message: "Failed to revoke trust" });
    }
  });
}

function handleRename(device: Device) {
  $q.dialog({
    title: "Rename device",
    message: "Enter a display name:",
    prompt: { model: device.displayName ?? "", type: "text" },
    cancel: true,
  }).onOk(async (name: string) => {
    try {
      await store.updateDevice(deviceId(device), name);
      $q.notify({ type: "positive", message: "Device renamed" });
    } catch {
      $q.notify({ type: "negative", message: "Failed to rename" });
    }
  });
}

function handleRemove(device: Device) {
  $q.dialog({
    title: "Remove device",
    message: `Remove "${device.displayName || "this device"}"? All sessions on this device will be revoked.`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await store.removeDevice(deviceId(device));
      $q.notify({ type: "positive", message: "Device removed" });
    } catch {
      $q.notify({ type: "negative", message: "Failed to remove device" });
    }
  });
}

onMounted(() => {
  store.fetchAllDevices();
});
</script>
