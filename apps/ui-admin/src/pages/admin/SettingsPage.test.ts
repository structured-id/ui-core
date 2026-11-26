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
      enabled: true,
      userManagedAccess: false,
    },
  }),
  updateRealm: vi.fn().mockResolvedValue({ response: {} }),
  getInstallationAddresses: vi.fn().mockResolvedValue({
    response: {
      publicUrl: "https://sid.example.com/",
      publicUrlOverridden: false,
      consoleUrl: "https://sid.example.com/admin/",
    },
  }),
  updateInstallationAddresses: vi.fn(),
  // SessionCookieDomain: THIS_HOST 1, ALL_SUBDOMAINS 2, SELECTED_SUBDOMAINS 3.
  getSessionCookieScope: vi.fn().mockResolvedValue({
    response: {
      domain: 1,
      baseDomain: "sid.example.com",
      subdomains: [],
      subdomainPattern: "",
      revision: 0n,
    },
  }),
  updateSessionCookieScope: vi.fn(),
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
  getAccountTransport: () => ({}),
  refusalMessage: (_err: unknown, fallback: string) => fallback,
}));

vi.mock("@structured-id/proto/google/protobuf/empty", () => ({
  Empty: { create: () => ({}) },
}));

vi.mock("@structured-id/proto/sid/v1/admin/settings.client", () => ({
  RealmServiceClient: class {
    getRealm = realmMocks.getRealm;
    updateRealm = realmMocks.updateRealm;
    getInstallationAddresses = realmMocks.getInstallationAddresses;
    updateInstallationAddresses = realmMocks.updateInstallationAddresses;
    getSessionCookieScope = realmMocks.getSessionCookieScope;
    updateSessionCookieScope = realmMocks.updateSessionCookieScope;
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
import { useSettingsStore } from "#admin/stores/settings";
import { quasarStubs } from "#admin/test-utils/quasar-stubs";

function mountPage(pinia = createPinia()) {
  return mount(SettingsPage, {
    global: {
      plugins: [pinia],
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

  // The addresses load with the page; the installation's own URL is shown
  // as no override, and an emptied console address is sent as the empty
  // string that restores /admin/, not left out.
  it("loads the addresses and sends an emptied console address", async () => {
    realmMocks.updateInstallationAddresses.mockResolvedValue({
      response: {
        publicUrl: "https://sid.example.com/",
        publicUrlOverridden: false,
        consoleUrl: "https://sid.example.com/admin/",
      },
    });
    mountPage();
    await flushPromises();
    const store = useSettingsStore();
    expect(store.addresses?.consoleUrl).toBe("https://sid.example.com/admin/");

    await store.updateAddresses({ publicUrl: "", consoleUrl: "" });
    expect(realmMocks.updateInstallationAddresses).toHaveBeenCalledWith({
      publicUrl: "",
      consoleUrl: "",
    });
  });

  // Empty fields restore the defaults, so saving before the addresses were
  // read would wipe a public URL override and move the console back to
  // /admin/. Bug prevented: Save stayed live after the read failed and sent
  // the empty form.
  it("does not save addresses it has not read", async () => {
    realmMocks.getInstallationAddresses.mockRejectedValueOnce(
      new Error("unavailable"),
    );
    const wrapper = mountPage();
    await flushPromises();
    expect(useSettingsStore().addresses).toBeNull();

    const save = wrapper.find('[data-test="save-addresses"]');
    expect(save.exists()).toBe(true);
    await save.trigger("click");
    await flushPromises();
    expect(realmMocks.updateInstallationAddresses).not.toHaveBeenCalled();
  });

  // Returning to Settings shows the addresses the store already holds while
  // they refresh. Bug prevented: the new form started empty until the
  // refresh answered, so a Save meanwhile wiped the override and moved the
  // console back to /admin/.
  it("fills the address form from addresses already read", async () => {
    const pinia = createPinia();
    realmMocks.getInstallationAddresses.mockResolvedValueOnce({
      response: {
        publicUrl: "https://proxy.example.com/",
        publicUrlOverridden: true,
        consoleUrl: "https://sid.example.com/console/",
      },
    });
    mountPage(pinia).unmount();
    await flushPromises();

    realmMocks.getInstallationAddresses.mockReturnValueOnce(
      new Promise(() => {}),
    );
    realmMocks.updateInstallationAddresses.mockResolvedValueOnce({
      response: {
        publicUrl: "https://proxy.example.com/",
        publicUrlOverridden: true,
        consoleUrl: "https://sid.example.com/console/",
      },
    });
    const wrapper = mountPage(pinia);
    await flushPromises();
    await wrapper.find('[data-test="save-addresses"]').trigger("click");
    await flushPromises();
    expect(realmMocks.updateInstallationAddresses).toHaveBeenCalledWith({
      publicUrl: "https://proxy.example.com/",
      consoleUrl: "https://sid.example.com/console/",
    });
  });

  /** The session scope the installation answers, read or saved. */
  function scope(
    domain: number,
    subdomains: string[] = [],
    subdomainPattern = "",
  ) {
    return {
      response: {
        domain,
        baseDomain: "sid.example.com",
        subdomains,
        subdomainPattern,
        revision: 1n,
      },
    };
  }

  // The session domain loads with the page, with the base domain it derives
  // from, and a saved scope is the one the page shows when it is opened
  // again: a list of selected subdomains is sent as that list and no
  // expression. Bug prevented: a console with no control for the scope the
  // installation serves, or one that forgets the saved scope.
  it("saves a list of selected subdomains and shows it when reopened", async () => {
    const pinia = createPinia();
    realmMocks.getSessionCookieScope.mockResolvedValueOnce(
      scope(3, ["app.sid.example.com", "wiki.sid.example.com"]),
    );
    realmMocks.updateSessionCookieScope.mockResolvedValueOnce(
      scope(3, ["app.sid.example.com", "wiki.sid.example.com"]),
    );
    const wrapper = mountPage(pinia);
    await flushPromises();
    expect(wrapper.find('[data-test="session-base-domain"]').text()).toBe(
      "sid.example.com",
    );

    await wrapper.find('[data-test="save-session-scope"]').trigger("click");
    await flushPromises();
    expect(realmMocks.updateSessionCookieScope).toHaveBeenCalledWith({
      domain: 3,
      subdomains: ["app.sid.example.com", "wiki.sid.example.com"],
      subdomainPattern: "",
    });
    wrapper.unmount();

    // Reopened while the refresh is still on its way: the saved scope is
    // what the form holds and what a save sends.
    realmMocks.getSessionCookieScope.mockReturnValueOnce(new Promise(() => {}));
    realmMocks.updateSessionCookieScope.mockResolvedValueOnce(
      scope(3, ["app.sid.example.com", "wiki.sid.example.com"]),
    );
    const reopened = mountPage(pinia);
    await flushPromises();
    await reopened.find('[data-test="save-session-scope"]').trigger("click");
    await flushPromises();
    expect(realmMocks.updateSessionCookieScope).toHaveBeenLastCalledWith({
      domain: 3,
      subdomains: ["app.sid.example.com", "wiki.sid.example.com"],
      subdomainPattern: "",
    });
  });

  // The other way to select subdomains: a stored expression is sent as the
  // expression, with no list beside it.
  it("saves an expression of selected subdomains", async () => {
    const pattern = "^[a-z]+\\.apps\\.sid\\.example\\.com$";
    realmMocks.getSessionCookieScope.mockResolvedValueOnce(
      scope(3, [], pattern),
    );
    realmMocks.updateSessionCookieScope.mockResolvedValueOnce(
      scope(3, [], pattern),
    );
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.find('[data-test="save-session-scope"]').trigger("click");
    await flushPromises();
    expect(realmMocks.updateSessionCookieScope).toHaveBeenCalledWith({
      domain: 3,
      subdomains: [],
      subdomainPattern: pattern,
    });
  });

  // A scope that selects no subdomains sends none: all subdomains is the
  // scope alone.
  it("saves all subdomains without a selection", async () => {
    realmMocks.getSessionCookieScope.mockResolvedValueOnce(scope(2));
    realmMocks.updateSessionCookieScope.mockResolvedValueOnce(scope(2));
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.find('[data-test="save-session-scope"]').trigger("click");
    await flushPromises();
    expect(realmMocks.updateSessionCookieScope).toHaveBeenCalledWith({
      domain: 2,
      subdomains: [],
      subdomainPattern: "",
    });
  });

  // Saving before the scope was read would replace it with the form's
  // default, this domain only, and sign out the browsers that shared a wider
  // one.
  it("does not save a session domain it has not read", async () => {
    realmMocks.getSessionCookieScope.mockRejectedValueOnce(
      new Error("unavailable"),
    );
    const wrapper = mountPage();
    await flushPromises();
    expect(useSettingsStore().cookieScope).toBeNull();

    await wrapper.find('[data-test="save-session-scope"]').trigger("click");
    await flushPromises();
    expect(realmMocks.updateSessionCookieScope).not.toHaveBeenCalled();
  });

  // A scope the installation refuses stays in the form, and the stored scope
  // is not replaced by what was refused.
  it("keeps the stored scope when the installation refuses a change", async () => {
    realmMocks.getSessionCookieScope.mockResolvedValueOnce(scope(2));
    realmMocks.updateSessionCookieScope.mockRejectedValueOnce(
      new Error("refused"),
    );
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.find('[data-test="save-session-scope"]').trigger("click");
    await flushPromises();
    const store = useSettingsStore();
    expect(store.cookieScope?.domain).toBe(2);
    expect(store.error).toBe("Failed to update the session domain");
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
