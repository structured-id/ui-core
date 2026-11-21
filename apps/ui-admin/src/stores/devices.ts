import { defineStore } from "pinia";
import { ref } from "vue";
import { IdentityServiceClient } from "@structured-id/proto/sid/v1/identity/identity.client";
import type { Device } from "@structured-id/proto/sid/v1/identity/identity";
import {
  DeviceType,
  DeviceAssurance,
} from "@structured-id/proto/sid/v1/identity/identity";
import { getTransport } from "@structured-id/ui-core";
import type { DeviceId, ProfileId } from "@structured-id/ids";
import { names } from "src/ids";

function getClient() {
  return new IdentityServiceClient(getTransport());
}

export const useDevicesStore = defineStore("devices", () => {
  const devices = ref<Device[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchDevices(profileId: ProfileId) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().listDevices({
        profileId: profileId.toWire(),
      });
      devices.value = response.devices;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load devices";
    } finally {
      loading.value = false;
    }
  }

  async function fetchAllDevices() {
    loading.value = true;
    error.value = null;
    try {
      // No Profile named: the signed-in user's own devices.
      const { response } = await getClient().listDevices({});
      devices.value = response.devices;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load devices";
    } finally {
      loading.value = false;
    }
  }

  async function trustDevice(deviceId: DeviceId) {
    error.value = null;
    try {
      const { response } = await getClient().trustDevice({
        deviceId: deviceId.toWire(),
      });
      const idx = devices.value.findIndex((d) => names(d.id, deviceId));
      if (idx >= 0) devices.value[idx] = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to trust device";
      throw err;
    }
  }

  async function revokeDeviceTrust(deviceId: DeviceId) {
    error.value = null;
    try {
      const { response } = await getClient().revokeDeviceTrust({
        deviceId: deviceId.toWire(),
      });
      const idx = devices.value.findIndex((d) => names(d.id, deviceId));
      if (idx >= 0) devices.value[idx] = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to revoke trust";
      throw err;
    }
  }

  async function removeDevice(deviceId: DeviceId) {
    error.value = null;
    try {
      await getClient().removeDevice({ deviceId: deviceId.toWire() });
      devices.value = devices.value.filter((d) => !names(d.id, deviceId));
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to remove device";
      throw err;
    }
  }

  async function updateDevice(deviceId: DeviceId, displayName: string) {
    error.value = null;
    try {
      const { response } = await getClient().updateDevice({
        deviceId: deviceId.toWire(),
        displayName,
      });
      const idx = devices.value.findIndex((d) => names(d.id, deviceId));
      if (idx >= 0) devices.value[idx] = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update device";
      throw err;
    }
  }

  return {
    devices,
    loading,
    error,
    fetchDevices,
    fetchAllDevices,
    trustDevice,
    revokeDeviceTrust,
    removeDevice,
    updateDevice,
  };
});

export { DeviceType, DeviceAssurance };
export type { Device };
