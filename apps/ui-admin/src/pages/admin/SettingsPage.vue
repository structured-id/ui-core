<template>
  <q-page padding>
    <div class="text-h4 q-mb-md">Settings</div>

    <q-tabs v-model="tab" dense align="left" class="q-mb-lg" narrow-indicator>
      <q-tab name="general" label="General" />
      <q-tab name="login" label="Login" />
      <q-tab name="email" label="Email" />
      <q-tab name="branding" label="Branding" />
      <q-tab name="localization" label="Localization" />
      <q-tab name="keys" label="Keys" />
      <q-tab name="security" label="Security" />
      <q-tab name="sessions" label="Sessions & Tokens" />
      <q-tab name="import-export" label="Import / Export" />
    </q-tabs>

    <q-linear-progress
      v-if="store.loading"
      indeterminate
      color="primary"
      class="q-mb-md"
    />
    <q-banner v-if="store.error" class="bg-negative text-white q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <!-- ══════════════════════════════════════════ General ══════ -->
    <q-tab-panels v-model="tab" animated>
      <q-tab-panel name="general" class="q-pa-none">
        <div class="row q-col-gutter-lg">
          <!-- Realm Settings -->
          <div class="col-12 col-md-6">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-h6">Realm Settings</div>
              </q-card-section>
              <q-separator />
              <q-card-section v-if="realmForm">
                <q-input
                  v-model="realmForm.realmName"
                  label="Realm Name"
                  hint="URL-safe identifier (readonly)"
                  readonly
                  filled
                  class="q-mb-md"
                />
                <q-input
                  v-model="realmForm.displayName"
                  label="Display Name"
                  hint="Shown in login pages"
                  filled
                  class="q-mb-md"
                />
                <q-toggle v-model="realmForm.enabled" label="Realm Enabled" />
                <q-toggle
                  v-model="realmForm.userManagedAccess"
                  label="User Managed Access"
                  class="q-ml-md"
                />
              </q-card-section>
              <q-card-actions align="right">
                <q-btn
                  label="Save"
                  color="primary"
                  :loading="store.loading"
                  @click="saveRealm"
                />
              </q-card-actions>
            </q-card>
          </div>

          <!-- Addresses -->
          <div class="col-12 col-md-6">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-h6">Addresses</div>
              </q-card-section>
              <q-separator />
              <q-card-section v-if="store.addresses">
                <q-input
                  v-model="addressForm.publicUrl"
                  label="Public URL"
                  :hint="
                    store.addresses.publicUrlOverridden
                      ? 'Set for a reverse proxy; clear to use the installation\'s own URL'
                      : 'The installation\'s own URL; set another for a reverse proxy'
                  "
                  filled
                  class="q-mb-md"
                />
                <q-input
                  v-model="addressForm.consoleUrl"
                  label="Console URL"
                  hint="Another path on the public URL, or a host of the same site; clear for /admin/"
                  filled
                />
              </q-card-section>
              <q-card-actions align="right">
                <q-btn
                  label="Save"
                  color="primary"
                  :loading="store.loading"
                  @click="saveAddresses"
                />
              </q-card-actions>
            </q-card>
          </div>

          <!-- Features -->
          <div class="col-12 col-md-6">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-h6">Features</div>
              </q-card-section>
              <q-separator />
              <q-list separator>
                <q-item v-for="f in store.features" :key="f.key">
                  <q-item-section>
                    <q-item-label>{{ f.displayName }}</q-item-label>
                    <q-item-label caption>{{ f.description }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle
                      :model-value="f.enabled"
                      @update:model-value="
                        (v: boolean) => toggleFeature(f.key, v)
                      "
                    />
                  </q-item-section>
                </q-item>
                <q-item v-if="store.features.length === 0">
                  <q-item-section class="text-grey"
                    >No features configured</q-item-section
                  >
                </q-item>
              </q-list>
            </q-card>
          </div>
        </div>
      </q-tab-panel>

      <!-- ══════════════════════════════════════════ Login ══════ -->
      <q-tab-panel name="login" class="q-pa-none">
        <q-card flat bordered v-if="loginForm">
          <q-card-section>
            <div class="text-h6">Login Configuration</div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <div class="row q-col-gutter-md">
              <div class="col-12 col-md-6">
                <div class="text-subtitle2 q-mb-sm">
                  Registration & Recovery
                </div>
                <div v-if="loginForm.selfRegistration !== undefined">
                  <q-toggle
                    v-model="loginForm.selfRegistration"
                    label="Self Registration"
                  />
                </div>
                <div v-if="loginForm.forgotPassword !== undefined">
                  <q-toggle
                    v-model="loginForm.forgotPassword"
                    label="Forgot Password"
                  />
                </div>
                <div v-if="loginForm.verifyEmail !== undefined">
                  <q-toggle
                    v-model="loginForm.verifyEmail"
                    label="Verify Email"
                  />
                </div>
              </div>
              <div class="col-12 col-md-6">
                <div class="text-subtitle2 q-mb-sm">Login Behavior</div>
                <div v-if="loginForm.rememberMe !== undefined">
                  <q-toggle
                    v-model="loginForm.rememberMe"
                    label="Remember Me"
                  />
                </div>
                <div v-if="loginForm.loginWithEmail !== undefined">
                  <q-toggle
                    v-model="loginForm.loginWithEmail"
                    label="Login with Email"
                  />
                </div>
                <div v-if="loginForm.identityFirstLogin !== undefined">
                  <q-toggle
                    v-model="loginForm.identityFirstLogin"
                    label="Identity-First Login"
                  />
                </div>
              </div>
              <div class="col-12 col-md-6">
                <div class="text-subtitle2 q-mb-sm">Default Roles</div>
                <q-input
                  v-model="defaultRolesText"
                  label="Default Roles"
                  hint="Comma-separated role names"
                  filled
                />
              </div>
              <div class="col-12 col-md-6">
                <div class="text-subtitle2 q-mb-sm">Default Groups</div>
                <q-input
                  v-model="defaultGroupsText"
                  label="Default Groups"
                  hint="Comma-separated group names"
                  filled
                />
              </div>
              <div class="col-12">
                <div class="text-subtitle2 q-mb-sm">Required Actions</div>
                <div class="row q-gutter-sm">
                  <q-checkbox
                    v-for="action in availableRequiredActions"
                    :key="action.value"
                    :model-value="
                      loginForm.requiredActions.includes(action.value)
                    "
                    :label="action.label"
                    @update:model-value="
                      (checked: boolean) =>
                        toggleRequiredAction(action.value, checked)
                    "
                  />
                </div>
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              label="Save"
              color="primary"
              :loading="store.loading"
              @click="saveLoginSettings"
            />
          </q-card-actions>
        </q-card>
      </q-tab-panel>

      <!-- ══════════════════════════════════════════ Email ══════ -->
      <q-tab-panel name="email" class="q-pa-none">
        <q-card flat bordered v-if="emailForm">
          <q-card-section>
            <div class="text-h6">SMTP Configuration</div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <div class="row q-col-gutter-md">
              <div class="col-12 col-md-8">
                <q-input
                  v-model="emailForm.smtpHost"
                  label="SMTP Host"
                  filled
                  class="q-mb-md"
                />
              </div>
              <div class="col-12 col-md-4">
                <q-input
                  v-model.number="emailForm.smtpPort"
                  label="Port"
                  type="number"
                  filled
                  class="q-mb-md"
                />
              </div>
              <div class="col-12 col-md-6">
                <q-input
                  v-model="emailForm.fromAddress"
                  label="From Address"
                  filled
                  class="q-mb-md"
                />
              </div>
              <div class="col-12 col-md-6">
                <q-input
                  v-model="emailForm.fromDisplayName"
                  label="From Display Name"
                  filled
                  class="q-mb-md"
                />
              </div>
              <div class="col-12 col-md-6">
                <q-input
                  v-model="emailForm.replyTo"
                  label="Reply-To"
                  filled
                  class="q-mb-md"
                />
              </div>
              <div class="col-12 col-md-6">
                <q-select
                  v-model="emailForm.encryption"
                  label="Encryption"
                  :options="encryptionOptions"
                  emit-value
                  map-options
                  filled
                  class="q-mb-md"
                />
              </div>
              <div class="col-12 col-md-6">
                <q-select
                  v-model="emailForm.authType"
                  label="Authentication"
                  :options="smtpAuthOptions"
                  emit-value
                  map-options
                  filled
                  class="q-mb-md"
                />
              </div>
              <template
                v-if="emailForm.authType === SmtpAuthType.USERNAME_PASSWORD"
              >
                <div class="col-12 col-md-6">
                  <q-input
                    v-model="emailForm.username"
                    label="Username"
                    filled
                    class="q-mb-md"
                  />
                </div>
                <div class="col-12 col-md-6">
                  <q-input
                    v-model="emailForm.password"
                    label="Password"
                    type="password"
                    filled
                    class="q-mb-md"
                  />
                </div>
              </template>
              <template v-if="emailForm.authType === SmtpAuthType.XOAUTH2">
                <div class="col-12 col-md-6">
                  <q-select
                    v-model="emailForm.xoauth2Provider"
                    label="OAuth2 provider"
                    :options="xoauth2ProviderOptions"
                    emit-value
                    map-options
                    filled
                    class="q-mb-md"
                  />
                </div>
                <div class="col-12 col-md-6">
                  <q-input
                    v-model="emailForm.username"
                    label="Sending mailbox"
                    filled
                    class="q-mb-md"
                  />
                </div>
                <div class="col-12 col-md-6">
                  <q-input
                    v-model="emailForm.xoauth2ClientId"
                    :label="
                      emailForm.xoauth2Provider === XOAUTH2_GOOGLE
                        ? 'Service account email'
                        : 'Client ID'
                    "
                    filled
                    class="q-mb-md"
                  />
                </div>
                <template v-if="emailForm.xoauth2Provider === XOAUTH2_M365">
                  <div class="col-12 col-md-6">
                    <q-input
                      v-model="emailForm.xoauth2TenantId"
                      label="Tenant ID"
                      filled
                      class="q-mb-md"
                    />
                  </div>
                  <div class="col-12 col-md-6">
                    <q-input
                      v-model="emailForm.xoauth2ClientSecret"
                      label="Client secret"
                      type="password"
                      filled
                      class="q-mb-md"
                    />
                  </div>
                </template>
                <div
                  v-if="emailForm.xoauth2Provider === XOAUTH2_GOOGLE"
                  class="col-12"
                >
                  <q-input
                    v-model="emailForm.xoauth2ServiceAccountKey"
                    label="Service account key (JSON)"
                    type="textarea"
                    autogrow
                    filled
                    class="q-mb-md"
                  />
                </div>
                <div class="col-12">
                  <q-input
                    v-model="emailForm.xoauth2TokenEndpoint"
                    label="Token endpoint (optional)"
                    hint="Left empty, the provider's standard endpoint is used"
                    filled
                    class="q-mb-md"
                  />
                </div>
              </template>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              outline
              label="Test Connection"
              icon="sym_o_send"
              :loading="testingEmail"
              @click="testEmail"
            />
            <q-btn
              label="Save"
              color="primary"
              :loading="store.loading"
              @click="saveEmailSettings"
            />
          </q-card-actions>
        </q-card>
      </q-tab-panel>

      <!-- ══════════════════════════════════════════ Branding ══════ -->
      <q-tab-panel name="branding" class="q-pa-none">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6">Branding</div>
            <p class="text-body2 text-grey-7 q-mt-sm">
              Full branding editor is available on the dedicated Branding page.
            </p>
          </q-card-section>
          <q-card-actions>
            <q-btn
              outline
              no-caps
              icon="sym_o_palette"
              label="Go to Branding Editor"
              to="/branding"
            />
          </q-card-actions>
        </q-card>
      </q-tab-panel>

      <!-- ══════════════════════════════════════════ Localization ══════ -->
      <q-tab-panel name="localization" class="q-pa-none">
        <div class="row q-col-gutter-lg">
          <div class="col-12 col-md-5">
            <q-card flat bordered v-if="localeForm">
              <q-card-section>
                <div class="text-h6">Internationalization</div>
              </q-card-section>
              <q-separator />
              <q-card-section>
                <q-toggle
                  v-model="localeForm.enabled"
                  label="Enabled"
                  class="q-mb-md"
                />
                <q-input
                  v-model="localeForm.defaultLocale"
                  label="Default Locale"
                  filled
                  hint="e.g., en, de, fr"
                  class="q-mb-md"
                />
                <q-input
                  v-model="supportedLocalesText"
                  label="Supported Locales"
                  filled
                  hint="Comma-separated: en, de, fr, uk"
                />
              </q-card-section>
              <q-card-actions align="right">
                <q-btn
                  label="Save"
                  color="primary"
                  :loading="store.loading"
                  @click="saveLocalization"
                />
              </q-card-actions>
            </q-card>
          </div>

          <div class="col-12 col-md-7">
            <q-card flat bordered>
              <q-card-section class="row items-center">
                <div class="text-h6">Translation Overrides</div>
                <q-space />
                <q-input
                  v-model="overrideLocale"
                  label="Locale"
                  outlined
                  dense
                  style="width: 100px"
                  class="q-mr-sm"
                />
                <q-input
                  v-model="overrideSearch"
                  label="Search"
                  outlined
                  dense
                  style="width: 200px"
                  class="q-mr-sm"
                />
                <q-btn flat dense icon="sym_o_search" @click="loadOverrides" />
              </q-card-section>
              <q-separator />
              <q-table
                :rows="store.translationOverrides"
                :columns="overrideColumns"
                row-key="key"
                flat
                dense
                :pagination="{ rowsPerPage: 10 }"
              >
                <template #body-cell-overrideValue="props">
                  <q-td :props="props">
                    <q-input
                      v-model="props.row.overrideValue"
                      dense
                      borderless
                      @blur="saveOverride(props.row)"
                    />
                  </q-td>
                </template>
                <template #body-cell-actions="props">
                  <q-td :props="props">
                    <q-btn
                      flat
                      dense
                      icon="sym_o_delete"
                      size="sm"
                      color="negative"
                      @click="removeOverride(props.row)"
                    />
                  </q-td>
                </template>
              </q-table>
            </q-card>
          </div>
        </div>
      </q-tab-panel>

      <!-- ══════════════════════════════════════════ Keys ══════ -->
      <q-tab-panel name="keys" class="q-pa-none">
        <div class="row q-col-gutter-lg">
          <!-- Active Keys -->
          <div class="col-12">
            <q-card flat bordered>
              <q-card-section class="row items-center">
                <div class="text-h6">Active Keys</div>
              </q-card-section>
              <q-separator />
              <q-table
                :rows="store.keys"
                :columns="keyColumns"
                row-key="kid"
                flat
                :pagination="{ rowsPerPage: 10 }"
              >
                <template #body-cell-status="props">
                  <q-td :props="props">
                    <q-badge
                      :label="keyStatusLabel(props.row.status)"
                      :color="keyStatusColor(props.row.status)"
                    />
                  </q-td>
                </template>
                <template #body-cell-use="props">
                  <q-td :props="props">
                    {{ keyUseLabel(props.row.use) }}
                  </q-td>
                </template>
              </q-table>
            </q-card>
          </div>

          <!-- Key Providers -->
          <div class="col-12">
            <q-card flat bordered>
              <q-card-section class="row items-center">
                <div class="text-h6">Key Providers</div>
                <q-space />
                <q-btn
                  label="Add Provider"
                  color="primary"
                  icon="sym_o_add"
                  @click="addProviderDialog = true"
                />
              </q-card-section>
              <q-separator />
              <q-table
                :rows="store.keyProviders"
                :columns="providerColumns"
                row-key="id"
                flat
                :pagination="{ rowsPerPage: 10 }"
              >
                <template #body-cell-providerType="props">
                  <q-td :props="props">
                    <q-icon
                      :name="keyProviderTypeIcon(props.row.providerType)"
                      class="q-mr-xs"
                    />
                    {{ keyProviderTypeLabel(props.row.providerType) }}
                  </q-td>
                </template>
                <template #body-cell-active="props">
                  <q-td :props="props">
                    <q-badge
                      :label="props.row.active ? 'Active' : 'Inactive'"
                      :color="props.row.active ? 'positive' : 'grey'"
                    />
                  </q-td>
                </template>
                <template #body-cell-actions="props">
                  <q-td :props="props">
                    <q-btn
                      flat
                      round
                      dense
                      icon="sym_o_delete"
                      color="negative"
                      @click="confirmDeleteProvider(props.row)"
                    />
                  </q-td>
                </template>
              </q-table>
            </q-card>
          </div>
        </div>

        <!-- Add Provider Dialog -->
        <q-dialog v-model="addProviderDialog">
          <q-card style="min-width: 450px">
            <q-card-section>
              <div class="text-h6">Add Key Provider</div>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <q-input
                v-model="providerForm.name"
                label="Name"
                filled
                class="q-mb-md"
              />
              <q-select
                v-model="providerForm.providerType"
                label="Provider Type"
                :options="providerTypeOptions"
                emit-value
                map-options
                filled
                class="q-mb-md"
              />
              <q-input
                v-model.number="providerForm.priority"
                label="Priority"
                type="number"
                filled
                class="q-mb-md"
              />
              <q-select
                v-model="providerForm.algorithm"
                label="Algorithm"
                :options="[
                  'RS256',
                  'RS384',
                  'RS512',
                  'ES256',
                  'ES384',
                  'ES512',
                  'PS256',
                  'PS384',
                  'PS512',
                  'EdDSA',
                ]"
                filled
                class="q-mb-md"
              />
              <q-input
                v-model.number="providerForm.keySize"
                label="Key Size (bits)"
                type="number"
                filled
                hint="RSA: 2048/4096, EC: 256/384"
              />
            </q-card-section>
            <q-card-actions align="right">
              <q-btn flat label="Cancel" v-close-popup />
              <q-btn
                label="Add"
                color="primary"
                :loading="store.loading"
                @click="executeAddProvider"
              />
            </q-card-actions>
          </q-card>
        </q-dialog>
      </q-tab-panel>

      <!-- ══════════════════════════════════════════ Security ══════ -->
      <q-tab-panel name="security" class="q-pa-none">
        <div class="row q-col-gutter-lg">
          <!-- Password Policy -->
          <div class="col-12 col-md-6">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-h6">Password Policy</div>
              </q-card-section>
              <q-separator />
              <q-list separator v-if="store.passwordPolicy">
                <q-item
                  v-for="(rule, idx) in store.passwordPolicy.rules ?? []"
                  :key="idx"
                >
                  <q-item-section>
                    <q-item-label>{{
                      passwordPolicyRuleTypeLabel(rule.type)
                    }}</q-item-label>
                    <q-item-label caption v-if="rule.value">
                      Value: {{ rule.value }}
                    </q-item-label>
                    <q-item-label caption v-if="rule.pattern">
                      Pattern: {{ rule.pattern }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
                <q-item v-if="(store.passwordPolicy.rules ?? []).length === 0">
                  <q-item-section class="text-grey"
                    >No password policy rules</q-item-section
                  >
                </q-item>
              </q-list>
            </q-card>
          </div>

          <!-- Brute Force Protection -->
          <div class="col-12 col-md-6">
            <q-card flat bordered v-if="bruteForceForm">
              <q-card-section>
                <div class="text-h6">Brute Force Protection</div>
              </q-card-section>
              <q-separator />
              <q-card-section>
                <q-toggle
                  v-model="bruteForceForm.enabled"
                  label="Enabled"
                  class="q-mb-md"
                />
                <q-select
                  v-model="bruteForceForm.mode"
                  label="Lockout Mode"
                  :options="lockoutModeOptions"
                  emit-value
                  map-options
                  filled
                  class="q-mb-md"
                  :disable="!bruteForceForm.enabled"
                />
                <q-input
                  v-model.number="bruteForceForm.maxLoginFailures"
                  label="Max Login Failures"
                  type="number"
                  filled
                  class="q-mb-md"
                  :disable="!bruteForceForm.enabled"
                />
                <q-input
                  v-model.number="bruteForceForm.lockoutDurationSeconds"
                  label="Lockout Duration (seconds)"
                  type="number"
                  filled
                  class="q-mb-md"
                  :disable="!bruteForceForm.enabled"
                />
                <q-input
                  v-model.number="bruteForceForm.failureResetSeconds"
                  label="Failure Reset (seconds)"
                  type="number"
                  filled
                  :disable="!bruteForceForm.enabled"
                />
              </q-card-section>
              <q-card-actions align="right">
                <q-btn
                  label="Save"
                  color="primary"
                  :loading="store.loading"
                  @click="saveBruteForce"
                />
              </q-card-actions>
            </q-card>
          </div>

          <!-- Security Headers -->
          <div class="col-12">
            <q-card flat bordered v-if="headersForm">
              <q-card-section>
                <div class="text-h6">Security Headers</div>
              </q-card-section>
              <q-separator />
              <q-card-section>
                <div class="row q-col-gutter-md">
                  <div class="col-12 col-md-6">
                    <q-select
                      v-model="headersForm.xFrameOptions"
                      label="X-Frame-Options"
                      :options="['DENY', 'SAMEORIGIN']"
                      filled
                      class="q-mb-md"
                    />
                    <q-input
                      v-model="headersForm.contentSecurityPolicy"
                      label="Content-Security-Policy"
                      filled
                      type="textarea"
                      autogrow
                      class="q-mb-md"
                    />
                    <q-input
                      v-model="headersForm.referrerPolicy"
                      label="Referrer-Policy"
                      filled
                    />
                  </div>
                  <div class="col-12 col-md-6">
                    <q-toggle
                      v-model="headersForm.xContentTypeOptionsNosniff"
                      label="X-Content-Type-Options: nosniff"
                      class="q-mb-sm"
                    />
                    <br />
                    <q-toggle
                      v-model="headersForm.xXssProtection"
                      label="X-XSS-Protection"
                      class="q-mb-sm"
                    />
                    <br />
                    <q-input
                      v-model.number="headersForm.hstsMaxAge"
                      label="HSTS Max Age (seconds)"
                      type="number"
                      filled
                      class="q-mb-md"
                    />
                    <q-toggle
                      v-model="headersForm.hstsIncludeSubdomains"
                      label="HSTS Include Subdomains"
                      class="q-mb-sm"
                    />
                    <br />
                    <q-toggle
                      v-model="headersForm.hstsPreload"
                      label="HSTS Preload"
                    />
                  </div>
                </div>
              </q-card-section>
              <q-card-actions align="right">
                <q-btn
                  label="Save"
                  color="primary"
                  :loading="store.loading"
                  @click="saveSecurityHeaders"
                />
              </q-card-actions>
            </q-card>
          </div>
        </div>
      </q-tab-panel>

      <!-- ══════════════════════════════════════════ Sessions & Tokens ══════ -->
      <q-tab-panel name="sessions" class="q-pa-none">
        <div class="row q-col-gutter-lg">
          <!-- Session Config -->
          <div class="col-12 col-md-6">
            <q-card flat bordered v-if="sessionForm">
              <q-card-section>
                <div class="text-h6">Session Configuration</div>
              </q-card-section>
              <q-separator />
              <q-card-section>
                <div class="text-subtitle2 q-mb-sm">SSO Sessions</div>
                <q-input
                  v-model.number="sessionForm.ssoSessionIdleSeconds"
                  label="SSO Session Idle Timeout (seconds)"
                  type="number"
                  filled
                  class="q-mb-md"
                />
                <q-input
                  v-model.number="sessionForm.ssoSessionMaxSeconds"
                  label="SSO Session Max Lifespan (seconds)"
                  type="number"
                  filled
                  class="q-mb-lg"
                />
                <div class="text-subtitle2 q-mb-sm">Client Sessions</div>
                <q-input
                  v-model.number="sessionForm.clientSessionIdleSeconds"
                  label="Client Session Idle Timeout (seconds)"
                  type="number"
                  filled
                  class="q-mb-md"
                />
                <q-input
                  v-model.number="sessionForm.clientSessionMaxSeconds"
                  label="Client Session Max Lifespan (seconds)"
                  type="number"
                  filled
                  class="q-mb-lg"
                />
                <div class="text-subtitle2 q-mb-sm">Offline Sessions</div>
                <q-toggle
                  v-model="sessionForm.offlineSessionEnabled"
                  label="Offline Sessions Enabled"
                  class="q-mb-md"
                />
                <q-input
                  v-model.number="sessionForm.offlineSessionIdleSeconds"
                  label="Offline Session Idle Timeout (seconds)"
                  type="number"
                  filled
                  class="q-mb-md"
                  :disable="!sessionForm.offlineSessionEnabled"
                />
                <q-toggle
                  v-model="sessionForm.offlineSessionMaxLimited"
                  label="Limit Offline Session Max"
                  class="q-mb-md"
                  :disable="!sessionForm.offlineSessionEnabled"
                />
                <q-input
                  v-model.number="sessionForm.offlineSessionMaxSeconds"
                  label="Offline Session Max Lifespan (seconds)"
                  type="number"
                  filled
                  :disable="
                    !sessionForm.offlineSessionEnabled ||
                    !sessionForm.offlineSessionMaxLimited
                  "
                />
              </q-card-section>
              <q-card-actions align="right">
                <q-btn
                  label="Save"
                  color="primary"
                  :loading="store.loading"
                  @click="saveSessionConfig"
                />
              </q-card-actions>
            </q-card>
          </div>

          <!-- Token Config -->
          <div class="col-12 col-md-6">
            <q-card flat bordered v-if="tokenForm">
              <q-card-section>
                <div class="text-h6">Token Configuration</div>
              </q-card-section>
              <q-separator />
              <q-card-section>
                <q-select
                  v-model="tokenForm.defaultSigningAlgorithm"
                  label="Default Signing Algorithm"
                  :options="[
                    'RS256',
                    'RS384',
                    'RS512',
                    'ES256',
                    'ES384',
                    'ES512',
                    'PS256',
                    'EdDSA',
                  ]"
                  filled
                  class="q-mb-md"
                />
                <q-input
                  v-model.number="tokenForm.accessTokenLifespanSeconds"
                  label="Access Token Lifespan (seconds)"
                  type="number"
                  filled
                  class="q-mb-md"
                />
                <q-input
                  v-model.number="tokenForm.accessTokenLifespanImplicitSeconds"
                  label="Access Token Lifespan — Implicit (seconds)"
                  type="number"
                  filled
                  class="q-mb-md"
                />
                <q-input
                  v-model.number="tokenForm.clientLoginTimeoutSeconds"
                  label="Client Login Timeout (seconds)"
                  type="number"
                  filled
                  class="q-mb-md"
                />
                <q-separator class="q-my-md" />
                <q-toggle
                  v-model="tokenForm.revokeRefreshTokenOnUse"
                  label="Revoke Refresh Token on Use"
                  class="q-mb-md"
                />
                <q-input
                  v-model.number="tokenForm.refreshTokenMaxReuse"
                  label="Refresh Token Max Reuse"
                  type="number"
                  filled
                  class="q-mb-md"
                  :disable="tokenForm.revokeRefreshTokenOnUse"
                />
                <q-input
                  v-model.number="tokenForm.refreshTokenLifespanSeconds"
                  label="Refresh Token Lifespan (seconds)"
                  type="number"
                  filled
                  class="q-mb-md"
                />
                <q-input
                  v-model.number="tokenForm.idTokenLifespanSeconds"
                  label="ID Token Lifespan (seconds)"
                  type="number"
                  filled
                />
              </q-card-section>
              <q-card-actions align="right">
                <q-btn
                  label="Save"
                  color="primary"
                  :loading="store.loading"
                  @click="saveTokenConfig"
                />
              </q-card-actions>
            </q-card>
          </div>
        </div>
      </q-tab-panel>

      <!-- ══════════════════════════════════════════ Import / Export ══════ -->
      <q-tab-panel name="import-export" class="q-pa-none">
        <div class="row q-col-gutter-lg">
          <!-- Export -->
          <div class="col-12 col-md-6">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-h6">Export Realm</div>
              </q-card-section>
              <q-separator />
              <q-card-section>
                <q-toggle
                  v-model="exportOpts.includeUsers"
                  label="Include Users"
                  class="q-mb-sm"
                />
                <br />
                <q-toggle
                  v-model="exportOpts.includeClients"
                  label="Include Clients"
                  class="q-mb-sm"
                />
                <br />
                <q-toggle
                  v-model="exportOpts.includeRoles"
                  label="Include Roles"
                  class="q-mb-sm"
                />
                <br />
                <q-toggle
                  v-model="exportOpts.includeGroups"
                  label="Include Groups"
                />
              </q-card-section>
              <q-card-actions align="right">
                <q-btn
                  label="Export"
                  color="primary"
                  icon="sym_o_download"
                  :loading="store.loading"
                  @click="doExport"
                />
              </q-card-actions>
            </q-card>
          </div>

          <!-- Import -->
          <div class="col-12 col-md-6">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-h6">Import Realm</div>
              </q-card-section>
              <q-separator />
              <q-card-section>
                <q-file
                  v-model="importFile"
                  label="Select JSON file"
                  filled
                  accept=".json"
                  class="q-mb-md"
                />
                <q-select
                  v-model="importOpts.conflictStrategy"
                  label="Conflict Strategy"
                  :options="conflictOptions"
                  emit-value
                  map-options
                  filled
                  class="q-mb-md"
                />
                <q-toggle
                  v-model="importOpts.includeUsers"
                  label="Include Users"
                  class="q-mb-sm"
                />
                <br />
                <q-toggle
                  v-model="importOpts.includeClients"
                  label="Include Clients"
                  class="q-mb-sm"
                />
                <br />
                <q-toggle
                  v-model="importOpts.includeRoles"
                  label="Include Roles"
                  class="q-mb-sm"
                />
                <br />
                <q-toggle
                  v-model="importOpts.includeGroups"
                  label="Include Groups"
                />

                <!-- Preview results -->
                <template v-if="importPreview">
                  <q-separator class="q-my-md" />
                  <div class="text-subtitle2 q-mb-sm">Import Preview</div>
                  <div class="row q-col-gutter-sm">
                    <div class="col-3">
                      <div class="text-caption text-grey">Users</div>
                      <div class="text-h6">{{ importPreview.usersCount }}</div>
                    </div>
                    <div class="col-3">
                      <div class="text-caption text-grey">Clients</div>
                      <div class="text-h6">
                        {{ importPreview.clientsCount }}
                      </div>
                    </div>
                    <div class="col-3">
                      <div class="text-caption text-grey">Roles</div>
                      <div class="text-h6">{{ importPreview.rolesCount }}</div>
                    </div>
                    <div class="col-3">
                      <div class="text-caption text-grey">Groups</div>
                      <div class="text-h6">{{ importPreview.groupsCount }}</div>
                    </div>
                  </div>
                  <q-list
                    v-if="importPreview.conflicts.length"
                    dense
                    class="q-mt-sm"
                  >
                    <q-item v-for="(c, i) in importPreview.conflicts" :key="i">
                      <q-item-section avatar>
                        <q-icon name="sym_o_warning" color="warning" />
                      </q-item-section>
                      <q-item-section>{{ c }}</q-item-section>
                    </q-item>
                  </q-list>
                </template>
              </q-card-section>
              <q-card-actions align="right">
                <q-btn
                  outline
                  label="Preview"
                  icon="sym_o_preview"
                  :loading="store.loading"
                  :disable="!importFile"
                  @click="doPreview"
                />
                <q-btn
                  label="Import"
                  color="primary"
                  icon="sym_o_upload"
                  :loading="store.loading"
                  :disable="!importFile"
                  @click="doImport"
                />
              </q-card-actions>
            </q-card>
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useQuasar } from "quasar";
import { useSettingsStore } from "#admin/stores/settings";
import { KeyProviderType } from "@structured-id/proto/sid/v1/admin/keys";
import { BruteForceLockoutMode } from "@structured-id/proto/sid/v1/admin/security";
import {
  RequiredAction,
  SmtpAuthType,
  SmtpEncryptionType,
  ImportConflictStrategy,
  XOAuth2ProviderType,
} from "@structured-id/proto/sid/v1/admin/settings";
import type {
  EmailSettings,
  ImportPreviewResponse,
} from "@structured-id/proto/sid/v1/admin/settings";
import type { KeyProvider } from "@structured-id/proto/sid/v1/admin/keys";
import {
  keyStatusLabel,
  keyStatusColor,
  keyUseLabel,
  keyProviderTypeLabel,
  keyProviderTypeIcon,
  passwordPolicyRuleTypeLabel,
  bruteForceLockoutModeLabel,
  requiredActionLabel,
  smtpEncryptionTypeLabel,
  smtpAuthTypeLabel,
  importConflictStrategyLabel,
} from "#admin/composables/useEnumLabels";

const store = useSettingsStore();
const $q = useQuasar();
const tab = ref("general");

// ── Realm form ──
const realmForm = ref<{
  realmName: string;
  displayName: string;
  enabled: boolean;
  userManagedAccess: boolean;
} | null>(null);

// ── Addresses form ──
const addressForm = ref({ publicUrl: "", consoleUrl: "" });

watch(
  () => store.addresses,
  (a) => {
    if (a) {
      addressForm.value = {
        // An override is shown as set; the installation's own URL as empty.
        publicUrl: a.publicUrlOverridden ? a.publicUrl : "",
        consoleUrl: a.consoleUrl,
      };
    }
  },
);

// Saving a new console address moves the console there: the browser follows
// it, since this page is no longer served where it is.
async function saveAddresses() {
  const before = store.addresses?.consoleUrl;
  try {
    const saved = await store.updateAddresses({
      publicUrl: addressForm.value.publicUrl.trim(),
      consoleUrl: addressForm.value.consoleUrl.trim(),
    });
    $q.notify({ type: "positive", message: "Addresses saved" });
    if (saved.consoleUrl !== before) window.location.assign(saved.consoleUrl);
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed to save" });
  }
}

watch(
  () => store.realm,
  (r) => {
    if (r) {
      realmForm.value = { ...r };
    }
  },
);

async function saveRealm() {
  if (!realmForm.value) return;
  try {
    await store.updateRealm({
      displayName: realmForm.value.displayName,
      enabled: realmForm.value.enabled,
      userManagedAccess: realmForm.value.userManagedAccess,
    });
    $q.notify({ type: "positive", message: "Realm settings saved" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed to save" });
  }
}

async function toggleFeature(key: string, enabled: boolean) {
  try {
    await store.setFeature(key, enabled);
    $q.notify({
      type: "positive",
      message: `Feature ${enabled ? "enabled" : "disabled"}`,
    });
  } catch {
    $q.notify({
      type: "negative",
      message: store.error ?? "Failed to update feature",
    });
  }
}

// ── Login form ──
// A setting the installation does not serve stays absent: its toggle is not
// shown, and saving does not send it (it would be refused).
const loginForm = ref<{
  selfRegistration?: boolean;
  forgotPassword?: boolean;
  rememberMe?: boolean;
  verifyEmail?: boolean;
  loginWithEmail?: boolean;
  identityFirstLogin?: boolean;
  requiredActions: RequiredAction[];
} | null>(null);

const defaultRolesText = ref("");
const defaultGroupsText = ref("");

const availableRequiredActions = [
  {
    value: RequiredAction.UPDATE_PROFILE,
    label: requiredActionLabel(RequiredAction.UPDATE_PROFILE),
  },
  {
    value: RequiredAction.VERIFY_EMAIL,
    label: requiredActionLabel(RequiredAction.VERIFY_EMAIL),
  },
  {
    value: RequiredAction.CONFIGURE_OTP,
    label: requiredActionLabel(RequiredAction.CONFIGURE_OTP),
  },
];

watch(
  () => store.loginSettings,
  (ls) => {
    if (ls) {
      loginForm.value = {
        selfRegistration: ls.selfRegistration,
        forgotPassword: ls.forgotPassword,
        rememberMe: ls.rememberMe,
        verifyEmail: ls.verifyEmail,
        loginWithEmail: ls.loginWithEmail,
        identityFirstLogin: ls.identityFirstLogin,
        requiredActions: [...ls.requiredActions],
      };
      defaultRolesText.value = ls.defaultRoles.join(", ");
      defaultGroupsText.value = ls.defaultGroups.join(", ");
    }
  },
);

function toggleRequiredAction(action: RequiredAction, checked: boolean) {
  if (!loginForm.value) return;
  if (checked) {
    loginForm.value.requiredActions.push(action);
  } else {
    loginForm.value.requiredActions = loginForm.value.requiredActions.filter(
      (a) => a !== action,
    );
  }
}

async function saveLoginSettings() {
  if (!loginForm.value) return;
  try {
    await store.updateLoginSettings({
      ...loginForm.value,
      defaultRoles: defaultRolesText.value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      defaultGroups: defaultGroupsText.value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    $q.notify({ type: "positive", message: "Login settings saved" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed to save" });
  }
}

// ── Keys ──
const keyColumns = [
  {
    name: "kid",
    label: "Key ID",
    field: "kid",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "algorithm",
    label: "Algorithm",
    field: "algorithm",
    align: "left" as const,
  },
  {
    name: "keyType",
    label: "Key Type",
    field: "keyType",
    align: "left" as const,
  },
  { name: "status", label: "Status", field: "status", align: "left" as const },
  { name: "use", label: "Use", field: "use", align: "left" as const },
  { name: "keySize", label: "Size", field: "keySize", align: "right" as const },
];

const providerColumns = [
  {
    name: "name",
    label: "Name",
    field: "name",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "providerType",
    label: "Type",
    field: "providerType",
    align: "left" as const,
  },
  {
    name: "algorithm",
    label: "Algorithm",
    field: "algorithm",
    align: "left" as const,
  },
  {
    name: "keySize",
    label: "Key Size",
    field: "keySize",
    align: "right" as const,
  },
  {
    name: "priority",
    label: "Priority",
    field: "priority",
    align: "right" as const,
  },
  {
    name: "active",
    label: "Status",
    field: "active",
    align: "center" as const,
  },
  { name: "actions", label: "", field: "id" },
];

const addProviderDialog = ref(false);
const providerForm = ref({
  name: "",
  providerType: KeyProviderType.GENERATED,
  priority: 0,
  algorithm: "RS256",
  keySize: 2048,
});

const providerTypeOptions = [
  {
    value: KeyProviderType.GENERATED,
    label: keyProviderTypeLabel(KeyProviderType.GENERATED),
  },
  {
    value: KeyProviderType.JAVA_KEYSTORE,
    label: keyProviderTypeLabel(KeyProviderType.JAVA_KEYSTORE),
  },
  {
    value: KeyProviderType.VAULT,
    label: keyProviderTypeLabel(KeyProviderType.VAULT),
  },
];

async function executeAddProvider() {
  try {
    await store.addKeyProvider({ ...providerForm.value });
    addProviderDialog.value = false;
    providerForm.value = {
      name: "",
      providerType: KeyProviderType.GENERATED,
      priority: 0,
      algorithm: "RS256",
      keySize: 2048,
    };
    $q.notify({ type: "positive", message: "Key provider added" });
  } catch {
    $q.notify({
      type: "negative",
      message: store.error ?? "Failed to add provider",
    });
  }
}

function confirmDeleteProvider(provider: KeyProvider) {
  $q.dialog({
    title: "Delete Key Provider",
    message: `Delete provider "${provider.name}"? This will remove all keys from this provider.`,
    cancel: true,
  }).onOk(async () => {
    try {
      await store.deleteKeyProvider(provider.id);
      $q.notify({ type: "positive", message: "Key provider deleted" });
    } catch {
      $q.notify({
        type: "negative",
        message: store.error ?? "Failed to delete",
      });
    }
  });
}

// ── Security ──
const bruteForceForm = ref<{
  enabled: boolean;
  mode: BruteForceLockoutMode;
  maxLoginFailures: number;
  lockoutDurationSeconds: number;
  maxLockoutDurationSeconds: number;
  failureResetSeconds: number;
  quickLoginCheckMs: number;
} | null>(null);

const headersForm = ref<{
  xFrameOptions: string;
  contentSecurityPolicy: string;
  xContentTypeOptionsNosniff: boolean;
  hstsMaxAge: number;
  hstsIncludeSubdomains: boolean;
  hstsPreload: boolean;
  xXssProtection: boolean;
  referrerPolicy: string;
} | null>(null);

const lockoutModeOptions = [
  {
    value: BruteForceLockoutMode.PERMANENT,
    label: bruteForceLockoutModeLabel(BruteForceLockoutMode.PERMANENT),
  },
  {
    value: BruteForceLockoutMode.TEMPORARY,
    label: bruteForceLockoutModeLabel(BruteForceLockoutMode.TEMPORARY),
  },
  {
    value: BruteForceLockoutMode.PROGRESSIVE,
    label: bruteForceLockoutModeLabel(BruteForceLockoutMode.PROGRESSIVE),
  },
];

watch(
  () => store.bruteForceConfig,
  (c) => {
    if (c) bruteForceForm.value = { ...c };
  },
);

watch(
  () => store.securityHeaders,
  (h) => {
    if (h) headersForm.value = { ...h };
  },
);

async function saveBruteForce() {
  if (!bruteForceForm.value) return;
  try {
    await store.updateBruteForceConfig(bruteForceForm.value);
    $q.notify({ type: "positive", message: "Brute force config saved" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed to save" });
  }
}

async function saveSecurityHeaders() {
  if (!headersForm.value) return;
  try {
    await store.updateSecurityHeaders(headersForm.value);
    $q.notify({ type: "positive", message: "Security headers saved" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed to save" });
  }
}

// ── Sessions & Tokens ──
const sessionForm = ref<{
  ssoSessionIdleSeconds: number;
  ssoSessionMaxSeconds: number;
  clientSessionIdleSeconds: number;
  clientSessionMaxSeconds: number;
  offlineSessionEnabled: boolean;
  offlineSessionIdleSeconds: number;
  offlineSessionMaxSeconds: number;
  offlineSessionMaxLimited: boolean;
} | null>(null);

const tokenForm = ref<{
  defaultSigningAlgorithm: string;
  accessTokenLifespanSeconds: number;
  accessTokenLifespanImplicitSeconds: number;
  clientLoginTimeoutSeconds: number;
  revokeRefreshTokenOnUse: boolean;
  refreshTokenMaxReuse: number;
  refreshTokenLifespanSeconds: number;
  idTokenLifespanSeconds: number;
} | null>(null);

watch(
  () => store.sessionConfig,
  (c) => {
    if (c) sessionForm.value = { ...c };
  },
);

watch(
  () => store.tokenConfig,
  (c) => {
    if (c) tokenForm.value = { ...c };
  },
);

async function saveSessionConfig() {
  if (!sessionForm.value) return;
  try {
    await store.updateSessionConfig(sessionForm.value);
    $q.notify({ type: "positive", message: "Session config saved" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed to save" });
  }
}

async function saveTokenConfig() {
  if (!tokenForm.value) return;
  try {
    await store.updateTokenConfig(tokenForm.value);
    $q.notify({ type: "positive", message: "Token config saved" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed to save" });
  }
}

// ── Email ──
const emailForm = ref<EmailSettings | null>(null);

const testingEmail = ref(false);

const encryptionOptions = [
  {
    value: SmtpEncryptionType.NONE,
    label: smtpEncryptionTypeLabel(SmtpEncryptionType.NONE),
  },
  {
    value: SmtpEncryptionType.SSL_TLS,
    label: smtpEncryptionTypeLabel(SmtpEncryptionType.SSL_TLS),
  },
  {
    value: SmtpEncryptionType.STARTTLS,
    label: smtpEncryptionTypeLabel(SmtpEncryptionType.STARTTLS),
  },
];

const smtpAuthOptions = [
  {
    value: SmtpAuthType.NONE,
    label: smtpAuthTypeLabel(SmtpAuthType.NONE),
  },
  {
    value: SmtpAuthType.USERNAME_PASSWORD,
    label: smtpAuthTypeLabel(SmtpAuthType.USERNAME_PASSWORD),
  },
  {
    value: SmtpAuthType.XOAUTH2,
    label: smtpAuthTypeLabel(SmtpAuthType.XOAUTH2),
  },
];

const XOAUTH2_M365 = XOAuth2ProviderType.XOAUTH2_PROVIDER_TYPE_M365;
const XOAUTH2_GOOGLE = XOAuth2ProviderType.XOAUTH2_PROVIDER_TYPE_GOOGLE;

const xoauth2ProviderOptions = [
  { value: XOAUTH2_M365, label: "Microsoft 365" },
  { value: XOAUTH2_GOOGLE, label: "Google Workspace" },
];

watch(
  () => store.emailSettings,
  (e) => {
    if (e) {
      // Credentials are write-only: the server never returns them, so the
      // form starts with them empty.
      emailForm.value = {
        ...e,
        username: "",
        password: "",
        xoauth2ClientSecret: "",
        xoauth2ServiceAccountKey: "",
      };
    }
  },
);

async function saveEmailSettings() {
  if (!emailForm.value) return;
  try {
    await store.updateEmailSettings(emailForm.value);
    $q.notify({ type: "positive", message: "Email settings saved" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed to save" });
  }
}

async function testEmail() {
  testingEmail.value = true;
  try {
    await store.testEmailConnection();
    $q.notify({ type: "positive", message: "Connection successful" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Test failed" });
  } finally {
    testingEmail.value = false;
  }
}

// ── Localization ──
const localeForm = ref<{
  enabled: boolean;
  defaultLocale: string;
} | null>(null);

const supportedLocalesText = ref("");
const overrideLocale = ref("en");
const overrideSearch = ref("");

const overrideColumns = [
  {
    name: "key",
    label: "Key",
    field: "key",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "defaultValue",
    label: "Default",
    field: "defaultValue",
    align: "left" as const,
  },
  {
    name: "overrideValue",
    label: "Override",
    field: "overrideValue",
    align: "left" as const,
  },
  { name: "actions", label: "", field: "key" },
];

watch(
  () => store.localizationSettings,
  (ls) => {
    if (ls) {
      localeForm.value = {
        enabled: ls.enabled,
        defaultLocale: ls.defaultLocale,
      };
      supportedLocalesText.value = ls.supportedLocales.join(", ");
    }
  },
);

async function saveLocalization() {
  if (!localeForm.value) return;
  try {
    await store.updateLocalizationSettings({
      ...localeForm.value,
      supportedLocales: supportedLocalesText.value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    $q.notify({ type: "positive", message: "Localization settings saved" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed to save" });
  }
}

async function loadOverrides() {
  await store.fetchTranslationOverrides(
    overrideLocale.value,
    overrideSearch.value,
  );
}

async function saveOverride(row: {
  locale: string;
  key: string;
  overrideValue: string;
}) {
  try {
    await store.setTranslationOverride(row.locale, row.key, row.overrideValue);
    $q.notify({ type: "positive", message: "Override saved" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed to save" });
  }
}

async function removeOverride(row: { locale: string; key: string }) {
  try {
    await store.deleteTranslationOverride(row.locale, row.key);
    await loadOverrides();
    $q.notify({ type: "positive", message: "Override removed" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed to delete" });
  }
}

// ── Import / Export ──
const exportOpts = ref({
  includeUsers: true,
  includeClients: true,
  includeRoles: true,
  includeGroups: true,
});

const importFile = ref<File | null>(null);
const importOpts = ref({
  conflictStrategy: ImportConflictStrategy.SKIP,
  includeUsers: true,
  includeClients: true,
  includeRoles: true,
  includeGroups: true,
});
const importPreview = ref<ImportPreviewResponse | null>(null);

const conflictOptions = [
  {
    value: ImportConflictStrategy.SKIP,
    label: importConflictStrategyLabel(ImportConflictStrategy.SKIP),
  },
  {
    value: ImportConflictStrategy.OVERWRITE,
    label: importConflictStrategyLabel(ImportConflictStrategy.OVERWRITE),
  },
  {
    value: ImportConflictStrategy.FAIL,
    label: importConflictStrategyLabel(ImportConflictStrategy.FAIL),
  },
];

async function doExport() {
  try {
    const res = await store.exportRealm(exportOpts.value);
    const blob = new Blob([res.data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "realm-export.json";
    a.click();
    URL.revokeObjectURL(url);
    $q.notify({ type: "positive", message: "Realm exported" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Export failed" });
  }
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function doPreview() {
  if (!importFile.value) return;
  try {
    const data = await readFileAsText(importFile.value);
    importPreview.value = await store.previewImport({
      data,
      ...importOpts.value,
    });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Preview failed" });
  }
}

async function doImport() {
  if (!importFile.value) return;
  $q.dialog({
    title: "Confirm Import",
    message: "This will import data into the realm. Continue?",
    cancel: true,
  }).onOk(async () => {
    try {
      const data = await readFileAsText(importFile.value!);
      const res = await store.importRealm({
        data,
        ...importOpts.value,
      });
      if (res.success) {
        const parts = [];
        if (res.usersImported) parts.push(`${res.usersImported} users`);
        if (res.clientsImported) parts.push(`${res.clientsImported} clients`);
        if (res.rolesImported) parts.push(`${res.rolesImported} roles`);
        if (res.groupsImported) parts.push(`${res.groupsImported} groups`);
        $q.notify({
          type: "positive",
          message: `Imported: ${parts.join(", ") || "no changes"}`,
        });
      }
      if (res.warnings.length) {
        res.warnings.forEach((w) => $q.notify({ type: "warning", message: w }));
      }
    } catch {
      $q.notify({ type: "negative", message: store.error ?? "Import failed" });
    }
  });
}

// ── Init ──
onMounted(async () => {
  await Promise.all([
    store.fetchRealm(),
    store.fetchAddresses(),
    store.fetchFeatures(),
    store.fetchLoginSettings(),
    store.fetchKeys(),
    store.fetchKeyProviders(),
    store.fetchPasswordPolicy(),
    store.fetchBruteForceConfig(),
    store.fetchSecurityHeaders(),
    store.fetchSessionConfig(),
    store.fetchTokenConfig(),
    store.fetchEmailSettings(),
    store.fetchLocalizationSettings(),
  ]);
});
</script>
