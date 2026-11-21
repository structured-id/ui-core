import { defineStore } from "pinia";
import { ref } from "vue";
import {
  RealmServiceClient,
  FeatureServiceClient,
} from "@structured-id/proto/sid/v1/admin/settings.client";
import { KeyServiceClient } from "@structured-id/proto/sid/v1/admin/keys.client";
import { SecurityServiceClient } from "@structured-id/proto/sid/v1/admin/security.client";
import type {
  RealmSettings,
  LoginSettings,
  SessionConfig,
  TokenConfig,
  Feature,
  EmailSettings,
  LocalizationSettings,
  TranslationOverride,
  ExportRealmResponse,
  ImportRealmResponse,
  ImportPreviewResponse,
} from "@structured-id/proto/sid/v1/admin/settings";
import { ImportConflictStrategy } from "@structured-id/proto/sid/v1/admin/settings";
import type {
  SigningKey,
  KeyProvider,
} from "@structured-id/proto/sid/v1/admin/keys";
import { KeyProviderType } from "@structured-id/proto/sid/v1/admin/keys";
import type {
  PasswordPolicy,
  BruteForceConfig,
  SecurityHeaders,
} from "@structured-id/proto/sid/v1/admin/security";
import { getTransport, refusalMessage } from "@structured-id/ui-core";
import { Empty } from "@structured-id/proto/google/protobuf/empty";

function getRealmClient() {
  return new RealmServiceClient(getTransport());
}

function getFeatureClient() {
  return new FeatureServiceClient(getTransport());
}

function getKeyClient() {
  return new KeyServiceClient(getTransport());
}

function getSecurityClient() {
  return new SecurityServiceClient(getTransport());
}

export const useSettingsStore = defineStore("settings", () => {
  // ── State ──
  const realm = ref<RealmSettings | null>(null);
  const loginSettings = ref<LoginSettings | null>(null);
  const sessionConfig = ref<SessionConfig | null>(null);
  const tokenConfig = ref<TokenConfig | null>(null);
  const features = ref<Feature[]>([]);
  const keys = ref<SigningKey[]>([]);
  const keyProviders = ref<KeyProvider[]>([]);
  const passwordPolicy = ref<PasswordPolicy | null>(null);
  const bruteForceConfig = ref<BruteForceConfig | null>(null);
  const securityHeaders = ref<SecurityHeaders | null>(null);
  const emailSettings = ref<EmailSettings | null>(null);
  const localizationSettings = ref<LocalizationSettings | null>(null);
  const translationOverrides = ref<TranslationOverride[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ── General ──

  async function fetchRealm() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().getRealm({});
      realm.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load realm settings";
    } finally {
      loading.value = false;
    }
  }

  async function updateRealm(update: {
    displayName?: string;
    frontendUrl?: string;
    enabled?: boolean;
    userManagedAccess?: boolean;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().updateRealm(update);
      realm.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update realm settings";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Features ──

  async function fetchFeatures() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getFeatureClient().listFeatures(
        Empty.create(),
      );
      features.value = response.features;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load features";
    } finally {
      loading.value = false;
    }
  }

  async function setFeature(key: string, enabled: boolean) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getFeatureClient().setFeature({
        key,
        enabled,
      });
      const idx = features.value.findIndex((f) => f.key === key);
      if (idx !== -1) {
        features.value[idx] = response;
      }
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update feature";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Login ──

  async function fetchLoginSettings() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().getLoginSettings({});
      loginSettings.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load login settings";
    } finally {
      loading.value = false;
    }
  }

  async function updateLoginSettings(update: {
    selfRegistration?: boolean;
    forgotPassword?: boolean;
    rememberMe?: boolean;
    verifyEmail?: boolean;
    loginWithEmail?: boolean;
    identityFirstLogin?: boolean;
    defaultRoles: string[];
    defaultGroups: string[];
    requiredActions: number[];
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().updateLoginSettings(update);
      loginSettings.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update login settings";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Keys ──

  async function fetchKeys() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getKeyClient().listKeys(Empty.create());
      keys.value = response.keys;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load keys";
    } finally {
      loading.value = false;
    }
  }

  async function fetchKeyProviders() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getKeyClient().listKeyProviders(
        Empty.create(),
      );
      keyProviders.value = response.providers;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load key providers";
    } finally {
      loading.value = false;
    }
  }

  async function addKeyProvider(req: {
    name: string;
    providerType: KeyProviderType;
    priority: number;
    algorithm: string;
    keySize: number;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getKeyClient().addKeyProvider({
        ...req,
        keystoreData: new Uint8Array(),
        keystorePassword: "",
      });
      keyProviders.value.push(response);
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to add key provider";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteKeyProvider(providerId: string) {
    loading.value = true;
    error.value = null;
    try {
      await getKeyClient().deleteKeyProvider({ providerId });
      keyProviders.value = keyProviders.value.filter(
        (p) => p.id !== providerId,
      );
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete key provider";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Security ──

  async function fetchPasswordPolicy() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getSecurityClient().getPasswordPolicy(
        Empty.create(),
      );
      passwordPolicy.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load password policy";
    } finally {
      loading.value = false;
    }
  }

  async function updatePasswordPolicy(policy: PasswordPolicy) {
    loading.value = true;
    error.value = null;
    try {
      const { response } =
        await getSecurityClient().updatePasswordPolicy(policy);
      passwordPolicy.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update password policy";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchBruteForceConfig() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getSecurityClient().getBruteForceConfig(
        Empty.create(),
      );
      bruteForceConfig.value = response;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to load brute force config";
    } finally {
      loading.value = false;
    }
  }

  async function updateBruteForceConfig(config: BruteForceConfig) {
    loading.value = true;
    error.value = null;
    try {
      const { response } =
        await getSecurityClient().updateBruteForceConfig(config);
      bruteForceConfig.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to update brute force config";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchSecurityHeaders() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getSecurityClient().getSecurityHeaders(
        Empty.create(),
      );
      securityHeaders.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load security headers";
    } finally {
      loading.value = false;
    }
  }

  async function updateSecurityHeaders(headers: SecurityHeaders) {
    loading.value = true;
    error.value = null;
    try {
      const { response } =
        await getSecurityClient().updateSecurityHeaders(headers);
      securityHeaders.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to update security headers";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Email ──

  async function fetchEmailSettings() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().getEmailSettings(
        Empty.create(),
      );
      emailSettings.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load email settings";
    } finally {
      loading.value = false;
    }
  }

  async function updateEmailSettings(settings: EmailSettings) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().updateEmailSettings(settings);
      emailSettings.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update email settings";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Check the configured email provider. Resolves when it answers; an
   * unconfigured, unusable or refusing provider rejects, with its text in
   * `error`.
   */
  async function testEmailConnection(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      await getRealmClient().testEmailConnection(Empty.create());
    } catch (err) {
      error.value = refusalMessage(err, "Failed to test email");
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Localization ──

  async function fetchLocalizationSettings() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().getLocalizationSettings(
        Empty.create(),
      );
      localizationSettings.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load localization";
    } finally {
      loading.value = false;
    }
  }

  async function updateLocalizationSettings(settings: LocalizationSettings) {
    loading.value = true;
    error.value = null;
    try {
      const { response } =
        await getRealmClient().updateLocalizationSettings(settings);
      localizationSettings.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update localization";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTranslationOverrides(locale: string, search = "") {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().listTranslationOverrides({
        locale,
        search,
      });
      translationOverrides.value = response.overrides;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load overrides";
    } finally {
      loading.value = false;
    }
  }

  async function setTranslationOverride(
    locale: string,
    key: string,
    overrideValue: string,
  ) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().setTranslationOverride({
        locale,
        key,
        overrideValue,
      });
      const idx = translationOverrides.value.findIndex(
        (o) => o.key === key && o.locale === locale,
      );
      if (idx !== -1) translationOverrides.value[idx] = response;
      else translationOverrides.value.push(response);
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to set override";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteTranslationOverride(locale: string, key: string) {
    loading.value = true;
    error.value = null;
    try {
      await getRealmClient().deleteTranslationOverride({ locale, key });
      translationOverrides.value = translationOverrides.value.filter(
        (o) => !(o.key === key && o.locale === locale),
      );
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete override";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Import / Export ──

  async function exportRealm(opts: {
    includeUsers: boolean;
    includeClients: boolean;
    includeRoles: boolean;
    includeGroups: boolean;
  }): Promise<ExportRealmResponse> {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().exportRealm(opts);
      return response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to export";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function importRealm(opts: {
    data: string;
    conflictStrategy: ImportConflictStrategy;
    includeUsers: boolean;
    includeClients: boolean;
    includeRoles: boolean;
    includeGroups: boolean;
  }): Promise<ImportRealmResponse> {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().importRealm(opts);
      return response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to import";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function previewImport(opts: {
    data: string;
    conflictStrategy: ImportConflictStrategy;
    includeUsers: boolean;
    includeClients: boolean;
    includeRoles: boolean;
    includeGroups: boolean;
  }): Promise<ImportPreviewResponse> {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().previewImport(opts);
      return response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to preview";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Sessions & Tokens ──

  async function fetchSessionConfig() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().getSessionConfig(
        Empty.create(),
      );
      sessionConfig.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load session config";
    } finally {
      loading.value = false;
    }
  }

  async function updateSessionConfig(config: SessionConfig) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().updateSessionConfig(config);
      sessionConfig.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update session config";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTokenConfig() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().getTokenConfig(
        Empty.create(),
      );
      tokenConfig.value = response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load token config";
    } finally {
      loading.value = false;
    }
  }

  async function updateTokenConfig(config: TokenConfig) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getRealmClient().updateTokenConfig(config);
      tokenConfig.value = response;
      return response;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update token config";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    realm,
    loginSettings,
    sessionConfig,
    tokenConfig,
    features,
    keys,
    keyProviders,
    passwordPolicy,
    bruteForceConfig,
    securityHeaders,
    loading,
    error,
    fetchRealm,
    updateRealm,
    fetchFeatures,
    setFeature,
    fetchLoginSettings,
    updateLoginSettings,
    fetchKeys,
    fetchKeyProviders,
    addKeyProvider,
    deleteKeyProvider,
    fetchPasswordPolicy,
    updatePasswordPolicy,
    fetchBruteForceConfig,
    updateBruteForceConfig,
    fetchSecurityHeaders,
    updateSecurityHeaders,
    fetchSessionConfig,
    updateSessionConfig,
    fetchTokenConfig,
    updateTokenConfig,
    emailSettings,
    localizationSettings,
    translationOverrides,
    fetchEmailSettings,
    updateEmailSettings,
    testEmailConnection,
    fetchLocalizationSettings,
    updateLocalizationSettings,
    fetchTranslationOverrides,
    setTranslationOverride,
    deleteTranslationOverride,
    exportRealm,
    importRealm,
    previewImport,
  };
});
