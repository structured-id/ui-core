import { defineStore } from "pinia";
import { ref } from "vue";
import { MigrationServiceClient } from "@structured-id/proto/sid/v1/admin/migration.client";
import type {
  ImportBlueprintResponse,
  ParseMigrationFileResponse,
  ExecuteMigrationResponse,
  MigrationStatus,
  PasswordMigrationProgress,
  ConflictOverride,
  EntityMapping,
} from "@structured-id/proto/sid/v1/admin/migration";
import {
  BlueprintCategory,
  BlueprintScope,
  MigrationSource,
  ConflictResolution,
} from "@structured-id/proto/sid/v1/admin/migration";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import { getAccountTransport } from "@structured-id/ui-core";

function getClient() {
  return new MigrationServiceClient(getAccountTransport());
}

export const useMigrationStore = defineStore("migration", () => {
  const importPreview = ref<ImportBlueprintResponse | null>(null);
  const parseResult = ref<ParseMigrationFileResponse | null>(null);
  const migrationResult = ref<ExecuteMigrationResponse | null>(null);
  const migrationStatus = ref<MigrationStatus | null>(null);
  const passwordProgress = ref<PasswordMigrationProgress | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  // ── Blueprints ──

  async function exportBlueprint(
    categories: BlueprintCategory[],
    scope: BlueprintScope,
    scopeTargetId: string,
  ) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().exportBlueprint({
        categories,
        scope,
        scopeTargetId,
      });
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to export blueprint";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function importBlueprint(
    yamlContent: string,
    dryRun: boolean,
    defaultConflictResolution: ConflictResolution,
    conflictOverrides: ConflictOverride[],
  ) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await getClient().importBlueprint({
        yamlContent,
        dryRun,
        defaultConflictResolution,
        conflictOverrides,
      });
      importPreview.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to import blueprint";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function exportEntity(entityType: string, entityId: string) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().exportEntity({
        entityType,
        entityId,
      });
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to export entity";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Migration Wizard ──

  async function parseMigrationFile(
    source: MigrationSource,
    fileContent: string,
    filename: string,
  ) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().parseMigrationFile({
        source,
        fileContent,
        filename,
      });
      parseResult.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to parse migration file";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function executeMigration(
    source: MigrationSource,
    fileContent: string,
    mappings: EntityMapping[],
    dryRun: boolean,
    passwordDeadline?: Timestamp,
  ) {
    saving.value = true;
    error.value = null;
    try {
      const { response } = await getClient().executeMigration({
        source,
        fileContent,
        mappings,
        dryRun,
        passwordDeadline,
      });
      migrationResult.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to execute migration";
      throw err;
    } finally {
      saving.value = false;
    }
  }

  async function fetchMigrationStatus(migrationId: string) {
    error.value = null;
    try {
      const { response } = await getClient().getMigrationStatus({
        migrationId,
      });
      migrationStatus.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load migration status";
    }
  }

  async function fetchPasswordProgress() {
    error.value = null;
    try {
      const { response } = await getClient().getPasswordMigrationProgress({});
      passwordProgress.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load password progress";
    }
  }

  return {
    importPreview,
    parseResult,
    migrationResult,
    migrationStatus,
    passwordProgress,
    loading,
    saving,
    error,
    exportBlueprint,
    importBlueprint,
    exportEntity,
    parseMigrationFile,
    executeMigration,
    fetchMigrationStatus,
    fetchPasswordProgress,
  };
});
