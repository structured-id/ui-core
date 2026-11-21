import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { PasswordPolicyRuleType } from "@structured-id/proto/sid/v1/admin/security";

// Hoisted mocks — settings uses 4 different gRPC clients
const realmMocks = vi.hoisted(() => ({
  getRealm: vi.fn().mockResolvedValue({
    response: {
      realmName: "master",
      displayName: "Master Realm",
      frontendUrl: "https://sid.example.com",
      enabled: true,
      userManagedAccess: false,
    },
  }),
  updateRealm: vi.fn().mockResolvedValue({ response: {} }),
  getLoginSettings: vi.fn().mockResolvedValue({
    response: {
      registrationEnabled: true,
      forgotPasswordEnabled: true,
      emailVerificationRequired: false,
      rememberMeEnabled: true,
      loginWithEmail: true,
      identityFirstEnabled: false,
      defaultRoles: [],
      defaultGroups: [],
      requiredActions: [],
    },
  }),
  updateLoginSettings: vi.fn().mockResolvedValue({ response: {} }),
  getEmailSettings: vi.fn().mockResolvedValue({ response: {} }),
  updateEmailSettings: vi.fn().mockResolvedValue({ response: {} }),
  testEmailConnection: vi.fn().mockResolvedValue({ response: {} }),
  getLocalizationSettings: vi.fn().mockResolvedValue({
    response: { defaultLocale: "en", supportedLocales: ["en"] },
  }),
  updateLocalizationSettings: vi.fn().mockResolvedValue({ response: {} }),
  listTranslationOverrides: vi.fn().mockResolvedValue({
    response: { overrides: [] },
  }),
  setTranslationOverride: vi.fn().mockResolvedValue({ response: {} }),
  deleteTranslationOverride: vi.fn().mockResolvedValue({ response: {} }),
  exportRealm: vi.fn(),
  importRealm: vi.fn(),
  previewImport: vi.fn(),
  getSessionConfig: vi.fn().mockResolvedValue({
    response: {
      sessionIdleTimeout: 1800,
      sessionMaxLifetime: 36000,
      ssoSessionIdleTimeout: 1800,
      ssoSessionMaxLifetime: 36000,
    },
  }),
  updateSessionConfig: vi.fn().mockResolvedValue({ response: {} }),
  getTokenConfig: vi.fn().mockResolvedValue({
    response: {
      accessTokenLifetime: 300,
      refreshTokenLifetime: 1800,
      idTokenLifetime: 300,
    },
  }),
  updateTokenConfig: vi.fn().mockResolvedValue({ response: {} }),
}));

const featureMocks = vi.hoisted(() => ({
  listFeatures: vi.fn().mockResolvedValue({
    response: { features: [] },
  }),
  setFeature: vi.fn().mockResolvedValue({ response: {} }),
}));

const keyMocks = vi.hoisted(() => ({
  listKeys: vi.fn().mockResolvedValue({ response: { keys: [] } }),
  listKeyProviders: vi.fn().mockResolvedValue({
    response: { providers: [] },
  }),
  addKeyProvider: vi.fn(),
  deleteKeyProvider: vi.fn(),
}));

// Hoisted above the imports, so the enums come in through a dynamic import.
const securityMocks = await vi.hoisted(async () => {
  const { BruteForceLockoutMode, PasswordPolicyRuleType } =
    await import("@structured-id/proto/sid/v1/admin/security");
  return {
    getPasswordPolicy: vi.fn().mockResolvedValue({
      response: {
        rules: [
          { type: PasswordPolicyRuleType.MIN_LENGTH, value: 8, pattern: "" },
          { type: PasswordPolicyRuleType.UPPERCASE, value: 1, pattern: "" },
        ],
      },
    }),
    updatePasswordPolicy: vi.fn().mockResolvedValue({ response: {} }),
    getBruteForceConfig: vi.fn().mockResolvedValue({
      response: {
        enabled: true,
        mode: BruteForceLockoutMode.TEMPORARY,
        maxLoginFailures: 5,
        lockoutDurationSeconds: 300,
        maxLockoutDurationSeconds: 3600,
        failureResetSeconds: 900,
        quickLoginCheckMs: 1000,
      },
    }),
    updateBruteForceConfig: vi.fn().mockResolvedValue({ response: {} }),
    getSecurityHeaders: vi.fn().mockResolvedValue({
      response: {
        xFrameOptions: "SAMEORIGIN",
        contentSecurityPolicy: "",
        strictTransportSecurity: "max-age=31536000",
      },
    }),
    updateSecurityHeaders: vi.fn().mockResolvedValue({ response: {} }),
  };
});

vi.mock("@structured-id/ui-core", () => ({
  getTransport: () => ({}),
}));

vi.mock("@structured-id/proto/google/protobuf/empty", () => ({
  Empty: { create: () => ({}) },
}));

vi.mock("@structured-id/proto/sid/v1/admin/settings.client", () => ({
  RealmServiceClient: class {
    getRealm = realmMocks.getRealm;
    updateRealm = realmMocks.updateRealm;
    getLoginSettings = realmMocks.getLoginSettings;
    updateLoginSettings = realmMocks.updateLoginSettings;
    getEmailSettings = realmMocks.getEmailSettings;
    updateEmailSettings = realmMocks.updateEmailSettings;
    testEmailConnection = realmMocks.testEmailConnection;
    getLocalizationSettings = realmMocks.getLocalizationSettings;
    updateLocalizationSettings = realmMocks.updateLocalizationSettings;
    listTranslationOverrides = realmMocks.listTranslationOverrides;
    setTranslationOverride = realmMocks.setTranslationOverride;
    deleteTranslationOverride = realmMocks.deleteTranslationOverride;
    exportRealm = realmMocks.exportRealm;
    importRealm = realmMocks.importRealm;
    previewImport = realmMocks.previewImport;
    getSessionConfig = realmMocks.getSessionConfig;
    updateSessionConfig = realmMocks.updateSessionConfig;
    getTokenConfig = realmMocks.getTokenConfig;
    updateTokenConfig = realmMocks.updateTokenConfig;
  },
  FeatureServiceClient: class {
    listFeatures = featureMocks.listFeatures;
    setFeature = featureMocks.setFeature;
  },
}));

vi.mock("@structured-id/proto/sid/v1/admin/keys.client", () => ({
  KeyServiceClient: class {
    listKeys = keyMocks.listKeys;
    listKeyProviders = keyMocks.listKeyProviders;
    addKeyProvider = keyMocks.addKeyProvider;
    deleteKeyProvider = keyMocks.deleteKeyProvider;
  },
}));

vi.mock("@structured-id/proto/sid/v1/admin/security.client", () => ({
  SecurityServiceClient: class {
    getPasswordPolicy = securityMocks.getPasswordPolicy;
    updatePasswordPolicy = securityMocks.updatePasswordPolicy;
    getBruteForceConfig = securityMocks.getBruteForceConfig;
    updateBruteForceConfig = securityMocks.updateBruteForceConfig;
    getSecurityHeaders = securityMocks.getSecurityHeaders;
    updateSecurityHeaders = securityMocks.updateSecurityHeaders;
  },
}));

vi.mock("quasar", () => ({
  useQuasar: () => ({ notify: vi.fn() }),
}));

import SettingsPage from "./SettingsPage.vue";
import { useSettingsStore } from "src/stores/settings";
import { quasarStubs } from "src/test-utils/quasar-stubs";

function mountPage() {
  return mount(SettingsPage, {
    global: {
      plugins: [createPinia()],
      stubs: quasarStubs,
    },
  });
}

describe("SettingsPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("renders the page heading", async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Settings");
  });

  it("fetches all settings on mount", async () => {
    mountPage();
    await flushPromises();
    expect(realmMocks.getRealm).toHaveBeenCalledOnce();
    expect(featureMocks.listFeatures).toHaveBeenCalledOnce();
    expect(realmMocks.getLoginSettings).toHaveBeenCalledOnce();
    expect(keyMocks.listKeys).toHaveBeenCalledOnce();
    expect(securityMocks.getPasswordPolicy).toHaveBeenCalledOnce();
    expect(securityMocks.getBruteForceConfig).toHaveBeenCalledOnce();
  });

  it("renders all 9 tab labels", async () => {
    const wrapper = mountPage();
    await flushPromises();
    const tabNames = [
      "General",
      "Login",
      "Email",
      "Branding",
      "Localization",
      "Keys",
      "Security",
      "Sessions & Tokens",
      "Import / Export",
    ];
    for (const tab of tabNames) {
      expect(wrapper.text()).toContain(tab);
    }
  });

  it("renders General tab content by default", async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Realm Settings");
    expect(wrapper.text()).toContain("Features");
  });

  it("populates store with realm data", async () => {
    mountPage();
    await flushPromises();
    const store = useSettingsStore();
    expect(store.realm).not.toBeNull();
    expect(store.realm?.realmName).toBe("master");
  });

  it("shows error banner when fetch fails", async () => {
    realmMocks.getRealm.mockRejectedValueOnce(new Error("Auth required"));
    const wrapper = mountPage();
    await flushPromises();
    const store = useSettingsStore();
    expect(store.error).toBeTruthy();
    expect(wrapper.find(".q-banner").exists()).toBe(true);
  });

  it("fetches session and token config on mount", async () => {
    mountPage();
    await flushPromises();
    expect(realmMocks.getSessionConfig).toHaveBeenCalledOnce();
    expect(realmMocks.getTokenConfig).toHaveBeenCalledOnce();
  });

  it("populates password policy from security client", async () => {
    mountPage();
    await flushPromises();
    const store = useSettingsStore();
    expect(store.passwordPolicy).not.toBeNull();
    expect(store.passwordPolicy?.rules[0]).toEqual({
      type: PasswordPolicyRuleType.MIN_LENGTH,
      value: 8,
      pattern: "",
    });
  });

  it("store.updateRealm calls gRPC", async () => {
    realmMocks.updateRealm.mockResolvedValue({
      response: {
        realmName: "master",
        displayName: "Updated Realm",
        frontendUrl: "https://sid.example.com",
        enabled: true,
        userManagedAccess: false,
      },
    });
    mountPage();
    await flushPromises();
    const store = useSettingsStore();

    await store.updateRealm({ displayName: "Updated Realm" });
    expect(realmMocks.updateRealm).toHaveBeenCalledOnce();
    expect(store.realm?.displayName).toBe("Updated Realm");
  });

  it("store.setFeature calls gRPC", async () => {
    featureMocks.setFeature.mockResolvedValue({ response: {} });
    mountPage();
    await flushPromises();
    const store = useSettingsStore();

    await store.setFeature("mfa", true);
    expect(featureMocks.setFeature).toHaveBeenCalledOnce();
  });

  it("store.updatePasswordPolicy calls security client", async () => {
    const policy = {
      rules: [
        { type: PasswordPolicyRuleType.MIN_LENGTH, value: 12, pattern: "" },
      ],
    };
    securityMocks.updatePasswordPolicy.mockResolvedValue({ response: policy });
    mountPage();
    await flushPromises();
    const store = useSettingsStore();

    await store.updatePasswordPolicy(policy);
    expect(securityMocks.updatePasswordPolicy).toHaveBeenCalledOnce();
    expect(store.passwordPolicy).toEqual(policy);
  });

  it("populates brute force config from security client", async () => {
    mountPage();
    await flushPromises();
    const store = useSettingsStore();
    expect(store.bruteForceConfig).not.toBeNull();
    expect(store.bruteForceConfig?.maxLoginFailures).toBe(5);
  });

  // Regression: SettingsPage.vue:628 crashes on store.passwordPolicy.rules.length
  // when API returns passwordPolicy without rules field (rules=undefined).
  it("does not crash when passwordPolicy has no rules field", async () => {
    securityMocks.getPasswordPolicy.mockResolvedValue({
      // rules intentionally missing: triggers the bug
      response: {},
    });
    const wrapper = mountPage();
    await flushPromises();
    // Should render without crash — "No password policy rules" or empty list
    expect(wrapper.text()).toContain("Settings");
  });
});
