/**
 * IndexedDB storage for Browser VP.
 *
 * Database: sid-browser-vp
 *   ├── bindings       — per-service binding entries (key: service_sector)
 *   └── profile-state  — profile state + encrypted blob (key: profile_id)
 *
 * See arch/auth/browser-vp.md § IndexedDB Storage Schema.
 */

import type { ProfileState, BindingEntry } from "./types";

const DB_NAME = "sid-browser-vp";
const DB_VERSION = 1;
const STORE_BINDINGS = "bindings";
const STORE_PROFILE = "profile-state";

/**
 * Open (or create) the IndexedDB database.
 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_BINDINGS)) {
        db.createObjectStore(STORE_BINDINGS, { keyPath: "serviceSector" });
      }
      if (!db.objectStoreNames.contains(STORE_PROFILE)) {
        db.createObjectStore(STORE_PROFILE, { keyPath: "profileId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Profile State ──

/** Save or update profile state. */
export async function saveProfileState(
  profileId: string,
  state: ProfileState,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROFILE, "readwrite");
    tx.objectStore(STORE_PROFILE).put({ profileId, ...state });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Load profile state by ID. Returns null if not found. */
export async function loadProfileState(
  profileId: string,
): Promise<ProfileState | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROFILE, "readonly");
    const request = tx.objectStore(STORE_PROFILE).get(profileId);
    request.onsuccess = () => {
      const result = request.result;
      if (!result) {
        resolve(null);
        return;
      }
      // Strip the profileId key we added for IndexedDB
      const { profileId: _profileId, ...state } = result;
      resolve(state as ProfileState);
    };
    request.onerror = () => reject(request.error);
  });
}

/** Delete profile state. */
export async function deleteProfileState(profileId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROFILE, "readwrite");
    tx.objectStore(STORE_PROFILE).delete(profileId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Bindings ──

/** Save or update a binding entry. */
export async function saveBinding(
  serviceSector: string,
  entry: BindingEntry,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BINDINGS, "readwrite");
    tx.objectStore(STORE_BINDINGS).put({ serviceSector, ...entry });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Load a binding by service sector. */
export async function loadBinding(
  serviceSector: string,
): Promise<BindingEntry | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BINDINGS, "readonly");
    const request = tx.objectStore(STORE_BINDINGS).get(serviceSector);
    request.onsuccess = () => {
      const result = request.result;
      if (!result) {
        resolve(null);
        return;
      }
      const { serviceSector: _serviceSector, ...entry } = result;
      resolve(entry as BindingEntry);
    };
    request.onerror = () => reject(request.error);
  });
}

/** List all stored bindings. */
export async function listBindings(): Promise<
  Array<{ serviceSector: string } & BindingEntry>
> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BINDINGS, "readonly");
    const request = tx.objectStore(STORE_BINDINGS).getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

/** Delete a binding. */
export async function deleteBinding(serviceSector: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BINDINGS, "readwrite");
    tx.objectStore(STORE_BINDINGS).delete(serviceSector);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Clear all data (profile state + bindings). */
export async function clearAll(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROFILE, STORE_BINDINGS], "readwrite");
    tx.objectStore(STORE_PROFILE).clear();
    tx.objectStore(STORE_BINDINGS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Check if IndexedDB is available in this environment. */
export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
