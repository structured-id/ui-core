/**
 * Centralized enum → label/color/icon mappings.
 *
 * Uses `humanize()` to auto-derive labels from TypeScript reverse mapping
 * (EnumType[value] → "SNAKE_CASE" → "Title Case"). Explicit override maps
 * exist ONLY when the humanized name is wrong (e.g., OPAQUE → "Password").
 *
 * Colors and icons always require explicit maps (cannot be derived).
 */

import { ProfileStatus } from "@structured-id/proto/sid/v1/identity/identity";
import { CredentialType } from "@structured-id/proto/sid/v1/identity/identity";
import { PrincipalType } from "@structured-id/proto/sid/v1/identity/identity";
import {
  ApplicationType,
  TokenEndpointAuthMethod,
  SubjectType,
  ResourceState,
} from "@structured-id/proto/sid/v1/projects/projects";
import {
  UpstreamProtocol,
  TrustCategory,
} from "@structured-id/proto/sid/v1/federation/upstream";
import {
  MachineUserType,
  MachineUserStatus,
  MachineCredentialType,
  MachineCredentialStatus,
} from "@structured-id/proto/sid/v1/machine/machine_user";
import { PatStatus } from "@structured-id/proto/sid/v1/machine/pat";
import {
  KeyStatus,
  KeyUse,
  KeyProviderType,
} from "@structured-id/proto/sid/v1/admin/keys";
import {
  PasswordPolicyRuleType,
  BruteForceLockoutMode,
  AnomalyRuleType,
  CaptchaProvider,
  CaptchaTrigger,
} from "@structured-id/proto/sid/v1/admin/security";
import { RequiredAction } from "@structured-id/proto/sid/v1/admin/settings";
import {
  FlowPurpose,
  StepRequirement,
  ActionHookPoint,
  ActionType,
} from "@structured-id/proto/sid/v1/authn/flows";
import {
  EventType,
  AdminEventType,
} from "@structured-id/proto/sid/v1/admin/events";
import {
  ScopeType,
  ClaimSource,
} from "@structured-id/proto/sid/v1/admin/scopes";
import {
  BrandingStatus,
  ButtonStyle,
  WcagLevel,
} from "@structured-id/proto/sid/v1/admin/branding";
import { SessionAuthMethod } from "@structured-id/proto/sid/v1/admin/sessions";
import {
  EndpointStatus,
  DeliveryStatus,
  SubscriptionMode,
} from "@structured-id/proto/sid/v1/admin/webhooks";
import { NotificationChannel } from "@structured-id/proto/sid/v1/admin/notifications";
import {
  AdminRoleScope,
  AssignmentType,
  AdminPrincipalType,
  AssuranceLevel,
  RequiredMfaMethod,
} from "@structured-id/proto/sid/v1/admin/admin_roles";
import {
  FlagStatus,
  DependencyStatus,
  ProbeStatus,
  ChannelType,
  ChannelHealth,
  SmtpEncryption,
} from "@structured-id/proto/sid/v1/admin/operations";
import {
  MigrationSource,
  MigrationState,
  ImportAction,
  LegacyHashAlgorithm,
  ConflictResolution,
} from "@structured-id/proto/sid/v1/admin/migration";
import {
  AnalyticsPeriod,
  MetricTrend,
} from "@structured-id/proto/sid/v1/admin/analytics";
import {
  SmtpEncryptionType,
  SmtpAuthType,
  ImportConflictStrategy,
} from "@structured-id/proto/sid/v1/admin/settings";
import {
  AttributeDataType,
  AttributePermission,
} from "@structured-id/proto/sid/v1/admin/user_profile";

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

const ACRONYMS = new Set([
  "MFA",
  "OIDC",
  "JWT",
  "TOTP",
  "SPA",
  "API",
  "OTP",
  "IP",
  "CSP",
  "HSTS",
  "SAML",
  "CEL",
]);

/** Converts UPPER_SNAKE_CASE → Title Case, preserving known acronyms. */
function humanize(s: string): string {
  return s
    .split("_")
    .map((w) => (ACRONYMS.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

/** Generic label: override map first, then humanize reverse-mapped enum name. */
function label<E extends number>(
  enumObj: Record<number, string>,
  value: E,
  overrides?: Partial<Record<number, string>>,
  fallback = "Unknown",
): string {
  if (overrides?.[value]) return overrides[value];
  const name = enumObj[value];
  return name ? humanize(name) : fallback;
}

// ══════════════════════════════════════════════════════════════════════════
// ProfileStatus
// ══════════════════════════════════════════════════════════════════════════

const PROFILE_STATUS_COLORS: Partial<Record<ProfileStatus, string>> = {
  [ProfileStatus.ACTIVE]: "positive",
  [ProfileStatus.SUSPENDED]: "warning",
  [ProfileStatus.CLOSED]: "negative",
  [ProfileStatus.PROVISIONED]: "info",
};

export const profileStatusLabel = (s: ProfileStatus): string =>
  label(ProfileStatus, s);

export const profileStatusColor = (s: ProfileStatus): string =>
  PROFILE_STATUS_COLORS[s] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// CredentialType — labels genuinely differ from enum names
// ══════════════════════════════════════════════════════════════════════════

const CREDENTIAL_TYPE_OVERRIDES: Partial<Record<CredentialType, string>> = {
  [CredentialType.OPAQUE]: "Password",
  [CredentialType.WEBAUTHN]: "Passkey",
  [CredentialType.RECOVERY]: "Recovery Codes",
  [CredentialType.LEGACY_HASH]: "Legacy Password",
};

const CREDENTIAL_TYPE_ICONS: Partial<Record<CredentialType, string>> = {
  [CredentialType.OPAQUE]: "sym_o_password",
  [CredentialType.WEBAUTHN]: "sym_o_passkey",
  [CredentialType.TOTP]: "sym_o_pin",
  [CredentialType.RECOVERY]: "sym_o_key",
};

export const credentialTypeLabel = (t: CredentialType): string =>
  label(CredentialType, t, CREDENTIAL_TYPE_OVERRIDES);

export const credentialTypeIcon = (t: CredentialType): string =>
  CREDENTIAL_TYPE_ICONS[t] ?? "sym_o_lock";

// ══════════════════════════════════════════════════════════════════════════
// PrincipalType
// ══════════════════════════════════════════════════════════════════════════

export const principalTypeLabel = (t: PrincipalType): string =>
  label(PrincipalType, t, undefined, "Other");

// ══════════════════════════════════════════════════════════════════════════
// ApplicationType — API → "M2M" is a genuine override
// ══════════════════════════════════════════════════════════════════════════

const APPLICATION_TYPE_OVERRIDES: Partial<Record<ApplicationType, string>> = {
  [ApplicationType.API]: "M2M",
};

const APPLICATION_TYPE_COLORS: Partial<Record<ApplicationType, string>> = {
  [ApplicationType.WEB]: "blue",
  [ApplicationType.SPA]: "teal",
  [ApplicationType.NATIVE]: "purple",
  [ApplicationType.API]: "orange",
};

export const applicationTypeLabel = (t: ApplicationType): string =>
  label(ApplicationType, t, APPLICATION_TYPE_OVERRIDES);

export const applicationTypeColor = (t: ApplicationType): string =>
  APPLICATION_TYPE_COLORS[t] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// TokenEndpointAuthMethod — expand abbreviations
// ══════════════════════════════════════════════════════════════════════════

const TOKEN_AUTH_METHOD_OVERRIDES: Partial<
  Record<TokenEndpointAuthMethod, string>
> = {
  [TokenEndpointAuthMethod.CLIENT_SECRET_BASIC]: "Client Secret (Basic)",
  [TokenEndpointAuthMethod.CLIENT_SECRET_POST]: "Client Secret (POST)",
  [TokenEndpointAuthMethod.PRIVATE_KEY_JWT]: "Private Key JWT",
  [TokenEndpointAuthMethod.NONE]: "None (Public)",
};

export const tokenAuthMethodLabel = (m: TokenEndpointAuthMethod): string =>
  label(TokenEndpointAuthMethod, m, TOKEN_AUTH_METHOD_OVERRIDES);

// ══════════════════════════════════════════════════════════════════════════
// SubjectType
// ══════════════════════════════════════════════════════════════════════════

export const subjectTypeLabel = (t: SubjectType): string =>
  label(SubjectType, t);

// ══════════════════════════════════════════════════════════════════════════
// ResourceState
// ══════════════════════════════════════════════════════════════════════════

const RESOURCE_STATE_COLORS: Partial<Record<ResourceState, string>> = {
  [ResourceState.ACTIVE]: "positive",
  [ResourceState.INACTIVE]: "warning",
  [ResourceState.RETIRED]: "grey",
};

export const resourceStateLabel = (s: ResourceState): string =>
  label(ResourceState, s);

export const resourceStateColor = (s: ResourceState): string =>
  RESOURCE_STATE_COLORS[s] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// UpstreamProtocol — abbreviation formatting overrides
// ══════════════════════════════════════════════════════════════════════════

const UPSTREAM_PROTOCOL_OVERRIDES: Partial<Record<UpstreamProtocol, string>> = {
  [UpstreamProtocol.OIDC]: "OIDC",
  [UpstreamProtocol.OAUTH2]: "OAuth2",
};

export const upstreamProtocolLabel = (
  p: UpstreamProtocol | undefined,
): string =>
  p !== undefined
    ? label(UpstreamProtocol, p, UPSTREAM_PROTOCOL_OVERRIDES)
    : "Unknown";

// ══════════════════════════════════════════════════════════════════════════
// TrustCategory
// ══════════════════════════════════════════════════════════════════════════

const TRUST_CATEGORY_COLORS: Partial<Record<TrustCategory, string>> = {
  [TrustCategory.SOCIAL]: "blue",
  [TrustCategory.CORPORATE]: "purple",
  [TrustCategory.GOVERNMENT]: "green",
  [TrustCategory.FINANCIAL]: "orange",
};

export const trustCategoryLabel = (t: TrustCategory | undefined): string =>
  t !== undefined ? label(TrustCategory, t) : "Unknown";

export const trustCategoryColor = (t: TrustCategory | undefined): string =>
  t !== undefined ? (TRUST_CATEGORY_COLORS[t] ?? "grey") : "grey";

// ══════════════════════════════════════════════════════════════════════════
// MachineUserType
// ══════════════════════════════════════════════════════════════════════════

export const machineUserTypeLabel = (t: MachineUserType | undefined): string =>
  t !== undefined
    ? label(MachineUserType, t, undefined, "Machine User")
    : "Machine User";

// ══════════════════════════════════════════════════════════════════════════
// MachineUserStatus
// ══════════════════════════════════════════════════════════════════════════

const MACHINE_USER_STATUS_COLORS: Partial<Record<MachineUserStatus, string>> = {
  [MachineUserStatus.ACTIVE]: "positive",
  [MachineUserStatus.SUSPENDED]: "warning",
  [MachineUserStatus.EXPIRED]: "grey",
  [MachineUserStatus.DELETED]: "negative",
};

export const machineUserStatusLabel = (s: MachineUserStatus): string =>
  label(MachineUserStatus, s);

export const machineUserStatusColor = (s: MachineUserStatus): string =>
  MACHINE_USER_STATUS_COLORS[s] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// MachineCredentialType — mTLS needs override (lowercase m)
// ══════════════════════════════════════════════════════════════════════════

const MACHINE_CREDENTIAL_TYPE_OVERRIDES: Partial<
  Record<MachineCredentialType, string>
> = {
  [MachineCredentialType.MTLS]: "mTLS",
};

const MACHINE_CREDENTIAL_TYPE_ICONS: Partial<
  Record<MachineCredentialType, string>
> = {
  [MachineCredentialType.CLIENT_SECRET]: "sym_o_key",
  [MachineCredentialType.PRIVATE_KEY_JWT]: "sym_o_description",
  [MachineCredentialType.MTLS]: "sym_o_lock",
  [MachineCredentialType.WORKLOAD_IDENTITY]: "sym_o_cloud",
};

export const machineCredentialTypeLabel = (t: MachineCredentialType): string =>
  label(MachineCredentialType, t, MACHINE_CREDENTIAL_TYPE_OVERRIDES);

export const machineCredentialTypeIcon = (t: MachineCredentialType): string =>
  MACHINE_CREDENTIAL_TYPE_ICONS[t] ?? "sym_o_help";

// ══════════════════════════════════════════════════════════════════════════
// MachineCredentialStatus
// ══════════════════════════════════════════════════════════════════════════

const MACHINE_CREDENTIAL_STATUS_COLORS: Partial<
  Record<MachineCredentialStatus, string>
> = {
  [MachineCredentialStatus.ACTIVE]: "positive",
  [MachineCredentialStatus.GRACE_PERIOD]: "warning",
  [MachineCredentialStatus.EXPIRED]: "grey",
  [MachineCredentialStatus.REVOKED]: "negative",
};

export const machineCredentialStatusLabel = (
  s: MachineCredentialStatus,
): string => label(MachineCredentialStatus, s);

export const machineCredentialStatusColor = (
  s: MachineCredentialStatus,
): string => MACHINE_CREDENTIAL_STATUS_COLORS[s] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// PatStatus
// ══════════════════════════════════════════════════════════════════════════

const PAT_STATUS_COLORS: Partial<Record<PatStatus, string>> = {
  [PatStatus.ACTIVE]: "positive",
  [PatStatus.REVOKED]: "negative",
  [PatStatus.EXPIRED]: "grey",
};

export const patStatusLabel = (s: PatStatus): string => label(PatStatus, s);

export const patStatusColor = (s: PatStatus): string =>
  PAT_STATUS_COLORS[s] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// KeyStatus
// ══════════════════════════════════════════════════════════════════════════

const KEY_STATUS_COLORS: Partial<Record<KeyStatus, string>> = {
  [KeyStatus.ACTIVE]: "positive",
  [KeyStatus.PASSIVE]: "warning",
  [KeyStatus.DISABLED]: "grey",
};

export const keyStatusLabel = (s: KeyStatus): string => label(KeyStatus, s);

export const keyStatusColor = (s: KeyStatus): string =>
  KEY_STATUS_COLORS[s] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// KeyUse — abbreviation expansion overrides
// ══════════════════════════════════════════════════════════════════════════

const KEY_USE_OVERRIDES: Partial<Record<KeyUse, string>> = {
  [KeyUse.SIG]: "Signing",
  [KeyUse.ENC]: "Encryption",
};

export const keyUseLabel = (u: KeyUse): string =>
  label(KeyUse, u, KEY_USE_OVERRIDES);

// ══════════════════════════════════════════════════════════════════════════
// KeyProviderType
// ══════════════════════════════════════════════════════════════════════════

const KEY_PROVIDER_TYPE_ICONS: Partial<Record<KeyProviderType, string>> = {
  [KeyProviderType.GENERATED]: "sym_o_auto_fix",
  [KeyProviderType.JAVA_KEYSTORE]: "sym_o_file_present",
  [KeyProviderType.VAULT]: "sym_o_lock",
};

export const keyProviderTypeLabel = (t: KeyProviderType): string =>
  label(KeyProviderType, t);

export const keyProviderTypeIcon = (t: KeyProviderType): string =>
  KEY_PROVIDER_TYPE_ICONS[t] ?? "sym_o_key";

// ══════════════════════════════════════════════════════════════════════════
// PasswordPolicyRuleType — several labels expand abbreviations
// ══════════════════════════════════════════════════════════════════════════

const PASSWORD_POLICY_RULE_TYPE_OVERRIDES: Partial<
  Record<PasswordPolicyRuleType, string>
> = {
  [PasswordPolicyRuleType.MIN_LENGTH]: "Minimum Length",
  [PasswordPolicyRuleType.UPPERCASE]: "Uppercase Letters",
  [PasswordPolicyRuleType.LOWERCASE]: "Lowercase Letters",
  [PasswordPolicyRuleType.SPECIAL_CHARS]: "Special Characters",
  [PasswordPolicyRuleType.REGEX]: "Regex Pattern",
  [PasswordPolicyRuleType.MAX_AGE_DAYS]: "Max Age (Days)",
};

export const passwordPolicyRuleTypeLabel = (
  t: PasswordPolicyRuleType,
): string =>
  label(PasswordPolicyRuleType, t, PASSWORD_POLICY_RULE_TYPE_OVERRIDES);

// ══════════════════════════════════════════════════════════════════════════
// BruteForceLockoutMode
// ══════════════════════════════════════════════════════════════════════════

export const bruteForceLockoutModeLabel = (m: BruteForceLockoutMode): string =>
  label(BruteForceLockoutMode, m);

// ══════════════════════════════════════════════════════════════════════════
// RequiredAction
// ══════════════════════════════════════════════════════════════════════════

export const requiredActionLabel = (a: RequiredAction): string =>
  label(RequiredAction, a);

// ══════════════════════════════════════════════════════════════════════════
// FlowPurpose
// ══════════════════════════════════════════════════════════════════════════

const FLOW_PURPOSE_COLORS: Partial<Record<FlowPurpose, string>> = {
  [FlowPurpose.LOGIN]: "primary",
  [FlowPurpose.REGISTRATION]: "teal",
  [FlowPurpose.RESET_CREDENTIALS]: "orange",
  [FlowPurpose.FIRST_BROKER_LOGIN]: "purple",
  [FlowPurpose.POST_BROKER_LOGIN]: "deep-purple",
  [FlowPurpose.DOCKER_AUTH]: "blue-grey",
};

export const flowPurposeLabel = (p: FlowPurpose): string =>
  label(FlowPurpose, p);

export const flowPurposeColor = (p: FlowPurpose): string =>
  FLOW_PURPOSE_COLORS[p] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// StepRequirement
// ══════════════════════════════════════════════════════════════════════════

const STEP_REQUIREMENT_COLORS: Partial<Record<StepRequirement, string>> = {
  [StepRequirement.REQUIRED]: "negative",
  [StepRequirement.ALTERNATIVE]: "warning",
  [StepRequirement.OPTIONAL]: "info",
  [StepRequirement.CONDITIONAL]: "purple",
  [StepRequirement.DISABLED]: "grey",
};

export const stepRequirementLabel = (r: StepRequirement): string =>
  label(StepRequirement, r);

export const stepRequirementColor = (r: StepRequirement): string =>
  STEP_REQUIREMENT_COLORS[r] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// ActionHookPoint
// ══════════════════════════════════════════════════════════════════════════

export const actionHookPointLabel = (h: ActionHookPoint): string =>
  label(ActionHookPoint, h);

// ══════════════════════════════════════════════════════════════════════════
// ActionType
// ══════════════════════════════════════════════════════════════════════════

const ACTION_TYPE_ICONS: Partial<Record<ActionType, string>> = {
  [ActionType.WEBHOOK]: "sym_o_webhook",
  [ActionType.LOG]: "sym_o_description",
  [ActionType.ASSIGN_ROLE]: "sym_o_badge",
  [ActionType.ADD_CLAIM]: "sym_o_label",
  [ActionType.SEND_EMAIL]: "sym_o_mail",
  [ActionType.DENY]: "sym_o_block",
  [ActionType.REDIRECT]: "sym_o_directions",
};

export const actionTypeLabel = (t: ActionType): string => label(ActionType, t);

export const actionTypeIcon = (t: ActionType): string =>
  ACTION_TYPE_ICONS[t] ?? "sym_o_bolt";

// ══════════════════════════════════════════════════════════════════════════
// EventType
// ══════════════════════════════════════════════════════════════════════════

const EVENT_TYPE_COLORS: Partial<Record<EventType, string>> = {
  [EventType.LOGIN]: "positive",
  [EventType.LOGIN_ERROR]: "negative",
  [EventType.LOGOUT]: "grey",
  [EventType.REGISTER]: "teal",
  [EventType.UPDATE_PASSWORD]: "orange",
  [EventType.RESET_PASSWORD]: "orange",
  [EventType.VERIFY_EMAIL]: "info",
  [EventType.MFA_ENROLL]: "purple",
  [EventType.MFA_VERIFY]: "purple",
  [EventType.MFA_REMOVE]: "deep-orange",
  [EventType.TOKEN_ISSUED]: "blue",
  [EventType.TOKEN_REFRESHED]: "blue",
  [EventType.TOKEN_REVOKED]: "red",
  [EventType.CONSENT_GRANTED]: "green",
  [EventType.CONSENT_REVOKED]: "red",
  [EventType.UPDATE_PROFILE]: "cyan",
  [EventType.DELETE_ACCOUNT]: "negative",
  [EventType.IMPERSONATION]: "amber",
};

export const eventTypeLabel = (t: EventType): string => label(EventType, t);

export const eventTypeColor = (t: EventType): string =>
  EVENT_TYPE_COLORS[t] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// AdminEventType
// ══════════════════════════════════════════════════════════════════════════

const ADMIN_EVENT_TYPE_COLORS: Partial<Record<AdminEventType, string>> = {
  [AdminEventType.CREATE]: "positive",
  [AdminEventType.UPDATE]: "info",
  [AdminEventType.DELETE]: "negative",
  [AdminEventType.ACTION]: "warning",
};

export const adminEventTypeLabel = (t: AdminEventType): string =>
  label(AdminEventType, t);

export const adminEventTypeColor = (t: AdminEventType): string =>
  ADMIN_EVENT_TYPE_COLORS[t] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// ScopeType — OPENID → "OIDC" is a genuine override
// ══════════════════════════════════════════════════════════════════════════

const SCOPE_TYPE_OVERRIDES: Partial<Record<ScopeType, string>> = {
  [ScopeType.OPENID]: "OIDC",
};

const SCOPE_TYPE_COLORS: Partial<Record<ScopeType, string>> = {
  [ScopeType.OPENID]: "blue",
  [ScopeType.CUSTOM]: "teal",
};

export const scopeTypeLabel = (t: ScopeType): string =>
  label(ScopeType, t, SCOPE_TYPE_OVERRIDES);

export const scopeTypeColor = (t: ScopeType): string =>
  SCOPE_TYPE_COLORS[t] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// ClaimSource
// ══════════════════════════════════════════════════════════════════════════

const CLAIM_SOURCE_ICONS: Partial<Record<ClaimSource, string>> = {
  [ClaimSource.PROFILE]: "sym_o_person",
  [ClaimSource.METADATA]: "sym_o_data_object",
  [ClaimSource.ROLES]: "sym_o_badge",
  [ClaimSource.GROUPS]: "sym_o_workspaces",
  [ClaimSource.STATIC]: "sym_o_pin",
  [ClaimSource.EXPRESSION]: "sym_o_code",
};

export const claimSourceLabel = (s: ClaimSource): string =>
  label(ClaimSource, s);

export const claimSourceIcon = (s: ClaimSource): string =>
  CLAIM_SOURCE_ICONS[s] ?? "sym_o_help";

// ══════════════════════════════════════════════════════════════════════════
// AnomalyRuleType
// ══════════════════════════════════════════════════════════════════════════

const ANOMALY_RULE_TYPE_ICONS: Partial<Record<AnomalyRuleType, string>> = {
  [AnomalyRuleType.IMPOSSIBLE_TRAVEL]: "sym_o_flight",
  [AnomalyRuleType.NEW_DEVICE]: "sym_o_devices",
  [AnomalyRuleType.NEW_COUNTRY]: "sym_o_public",
  [AnomalyRuleType.CREDENTIAL_STUFFING]: "sym_o_password",
  [AnomalyRuleType.BRUTE_FORCE]: "sym_o_block",
  [AnomalyRuleType.TOKEN_ABUSE]: "sym_o_token",
  [AnomalyRuleType.SESSION_ANOMALY]: "sym_o_warning",
  [AnomalyRuleType.CUSTOM]: "sym_o_tune",
};

export const anomalyRuleTypeLabel = (t: AnomalyRuleType): string =>
  label(AnomalyRuleType, t);

export const anomalyRuleTypeIcon = (t: AnomalyRuleType): string =>
  ANOMALY_RULE_TYPE_ICONS[t] ?? "sym_o_shield";

// ══════════════════════════════════════════════════════════════════════════
// CaptchaProvider — friendly names
// ══════════════════════════════════════════════════════════════════════════

const CAPTCHA_PROVIDER_OVERRIDES: Partial<Record<CaptchaProvider, string>> = {
  [CaptchaProvider.RECAPTCHA_V2]: "reCAPTCHA v2",
  [CaptchaProvider.RECAPTCHA_V3]: "reCAPTCHA v3",
  [CaptchaProvider.HCAPTCHA]: "hCaptcha",
  [CaptchaProvider.TURNSTILE]: "Cloudflare Turnstile",
};

export const captchaProviderLabel = (p: CaptchaProvider): string =>
  label(CaptchaProvider, p, CAPTCHA_PROVIDER_OVERRIDES);

// ══════════════════════════════════════════════════════════════════════════
// CaptchaTrigger
// ══════════════════════════════════════════════════════════════════════════

const CAPTCHA_TRIGGER_OVERRIDES: Partial<Record<CaptchaTrigger, string>> = {
  [CaptchaTrigger.AFTER_FAILURES]: "After Login Failures",
  [CaptchaTrigger.PASSWORD_RESET]: "Password Reset",
};

export const captchaTriggerLabel = (t: CaptchaTrigger): string =>
  label(CaptchaTrigger, t, CAPTCHA_TRIGGER_OVERRIDES);

// ══════════════════════════════════════════════════════════════════════════
// BrandingStatus
// ══════════════════════════════════════════════════════════════════════════

const BRANDING_STATUS_COLORS: Partial<Record<BrandingStatus, string>> = {
  [BrandingStatus.DRAFT]: "warning",
  [BrandingStatus.PUBLISHED]: "positive",
  [BrandingStatus.ARCHIVED]: "grey",
};

export const brandingStatusLabel = (s: BrandingStatus): string =>
  label(BrandingStatus, s);

export const brandingStatusColor = (s: BrandingStatus): string =>
  BRANDING_STATUS_COLORS[s] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// ButtonStyle
// ══════════════════════════════════════════════════════════════════════════

export const buttonStyleLabel = (s: ButtonStyle): string =>
  label(ButtonStyle, s);

// ══════════════════════════════════════════════════════════════════════════
// WcagLevel
// ══════════════════════════════════════════════════════════════════════════

const WCAG_LEVEL_OVERRIDES: Partial<Record<WcagLevel, string>> = {
  [WcagLevel.AA_NORMAL]: "AA (Normal Text)",
  [WcagLevel.AA_LARGE_ONLY]: "AA (Large Text Only)",
  [WcagLevel.FAIL]: "Fail",
};

const WCAG_LEVEL_COLORS: Partial<Record<WcagLevel, string>> = {
  [WcagLevel.AA_NORMAL]: "positive",
  [WcagLevel.AA_LARGE_ONLY]: "warning",
  [WcagLevel.FAIL]: "negative",
};

export const wcagLevelLabel = (l: WcagLevel): string =>
  label(WcagLevel, l, WCAG_LEVEL_OVERRIDES);

export const wcagLevelColor = (l: WcagLevel): string =>
  WCAG_LEVEL_COLORS[l] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// SessionAuthMethod
// ══════════════════════════════════════════════════════════════════════════

const SESSION_AUTH_METHOD_OVERRIDES: Partial<
  Record<SessionAuthMethod, string>
> = {
  [SessionAuthMethod.MFA]: "MFA",
  [SessionAuthMethod.SSO]: "SSO",
  [SessionAuthMethod.MAGIC_LINK]: "Magic Link",
};

const SESSION_AUTH_METHOD_ICONS: Partial<Record<SessionAuthMethod, string>> = {
  [SessionAuthMethod.PASSWORD]: "sym_o_password",
  [SessionAuthMethod.MFA]: "sym_o_security",
  [SessionAuthMethod.SSO]: "sym_o_login",
  [SessionAuthMethod.PASSKEY]: "sym_o_passkey",
  [SessionAuthMethod.MAGIC_LINK]: "sym_o_link",
};

export const sessionAuthMethodLabel = (m: SessionAuthMethod): string =>
  label(SessionAuthMethod, m, SESSION_AUTH_METHOD_OVERRIDES);

export const sessionAuthMethodIcon = (m: SessionAuthMethod): string =>
  SESSION_AUTH_METHOD_ICONS[m] ?? "sym_o_key";

// ══════════════════════════════════════════════════════════════════════════
// EndpointStatus
// ══════════════════════════════════════════════════════════════════════════

const ENDPOINT_STATUS_COLORS: Partial<Record<EndpointStatus, string>> = {
  [EndpointStatus.ACTIVE]: "positive",
  [EndpointStatus.PAUSED]: "warning",
  [EndpointStatus.FAILING]: "deep-orange",
  [EndpointStatus.DISABLED]: "grey",
};

const ENDPOINT_STATUS_ICONS: Partial<Record<EndpointStatus, string>> = {
  [EndpointStatus.ACTIVE]: "sym_o_check_circle",
  [EndpointStatus.PAUSED]: "sym_o_pause_circle",
  [EndpointStatus.FAILING]: "sym_o_error",
  [EndpointStatus.DISABLED]: "sym_o_cancel",
};

export const endpointStatusLabel = (s: EndpointStatus): string =>
  label(EndpointStatus, s);

export const endpointStatusColor = (s: EndpointStatus): string =>
  ENDPOINT_STATUS_COLORS[s] ?? "grey";

export const endpointStatusIcon = (s: EndpointStatus): string =>
  ENDPOINT_STATUS_ICONS[s] ?? "sym_o_help";

// ══════════════════════════════════════════════════════════════════════════
// DeliveryStatus
// ══════════════════════════════════════════════════════════════════════════

const DELIVERY_STATUS_COLORS: Partial<Record<DeliveryStatus, string>> = {
  [DeliveryStatus.DELIVERED]: "positive",
  [DeliveryStatus.FAILED]: "negative",
  [DeliveryStatus.TIMEOUT]: "deep-orange",
  [DeliveryStatus.RETRYING]: "warning",
  [DeliveryStatus.DLQ]: "purple",
};

const DELIVERY_STATUS_OVERRIDES: Partial<Record<DeliveryStatus, string>> = {
  [DeliveryStatus.DLQ]: "Dead Letter Queue",
};

export const deliveryStatusLabel = (s: DeliveryStatus): string =>
  label(DeliveryStatus, s, DELIVERY_STATUS_OVERRIDES);

export const deliveryStatusColor = (s: DeliveryStatus): string =>
  DELIVERY_STATUS_COLORS[s] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// SubscriptionMode
// ══════════════════════════════════════════════════════════════════════════

const SUBSCRIPTION_MODE_OVERRIDES: Partial<Record<SubscriptionMode, string>> = {
  [SubscriptionMode.ALL]: "All Events",
  [SubscriptionMode.SELECTED]: "Selected Types",
  [SubscriptionMode.PATTERN]: "Pattern Match",
};

export const subscriptionModeLabel = (m: SubscriptionMode): string =>
  label(SubscriptionMode, m, SUBSCRIPTION_MODE_OVERRIDES);

// ══════════════════════════════════════════════════════════════════════════
// NotificationChannel
// ══════════════════════════════════════════════════════════════════════════

const NOTIFICATION_CHANNEL_ICONS: Partial<Record<NotificationChannel, string>> =
  {
    [NotificationChannel.EMAIL]: "sym_o_mail",
    [NotificationChannel.SMS]: "sym_o_sms",
    [NotificationChannel.PUSH]: "sym_o_notifications",
  };

export const notificationChannelLabel = (c: NotificationChannel): string =>
  label(NotificationChannel, c);

export const notificationChannelIcon = (c: NotificationChannel): string =>
  NOTIFICATION_CHANNEL_ICONS[c] ?? "sym_o_send";

// ══════════════════════════════════════════════════════════════════════════
// AdminRoleScope
// ══════════════════════════════════════════════════════════════════════════

const ADMIN_ROLE_SCOPE_COLORS: Partial<Record<AdminRoleScope, string>> = {
  [AdminRoleScope.INSTANCE]: "deep-purple",
  [AdminRoleScope.SITE]: "primary",
  [AdminRoleScope.ORGANIZATION]: "teal",
  [AdminRoleScope.PROFILE]: "grey",
};

export const adminRoleScopeLabel = (s: AdminRoleScope): string =>
  label(AdminRoleScope, s);

export const adminRoleScopeColor = (s: AdminRoleScope): string =>
  ADMIN_ROLE_SCOPE_COLORS[s] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// AssignmentType
// ══════════════════════════════════════════════════════════════════════════

export const assignmentTypeLabel = (t: AssignmentType): string =>
  label(AssignmentType, t);

// ══════════════════════════════════════════════════════════════════════════
// AdminPrincipalType
// ══════════════════════════════════════════════════════════════════════════

const ADMIN_PRINCIPAL_TYPE_OVERRIDES: Partial<
  Record<AdminPrincipalType, string>
> = {
  [AdminPrincipalType.MACHINE_USER]: "Service Account",
};

const ADMIN_PRINCIPAL_TYPE_ICONS: Partial<Record<AdminPrincipalType, string>> =
  {
    [AdminPrincipalType.USER]: "sym_o_person",
    [AdminPrincipalType.GROUP]: "sym_o_workspaces",
    [AdminPrincipalType.MACHINE_USER]: "sym_o_smart_toy",
  };

export const adminPrincipalTypeLabel = (t: AdminPrincipalType): string =>
  label(AdminPrincipalType, t, ADMIN_PRINCIPAL_TYPE_OVERRIDES);

export const adminPrincipalTypeIcon = (t: AdminPrincipalType): string =>
  ADMIN_PRINCIPAL_TYPE_ICONS[t] ?? "sym_o_person";

// ══════════════════════════════════════════════════════════════════════════
// AssuranceLevel
// ══════════════════════════════════════════════════════════════════════════

const ASSURANCE_LEVEL_COLORS: Partial<Record<AssuranceLevel, string>> = {
  [AssuranceLevel.BASIC]: "grey",
  [AssuranceLevel.STANDARD]: "info",
  [AssuranceLevel.ELEVATED]: "warning",
  [AssuranceLevel.CRITICAL]: "negative",
};

export const assuranceLevelLabel = (l: AssuranceLevel): string =>
  label(AssuranceLevel, l);

export const assuranceLevelColor = (l: AssuranceLevel): string =>
  ASSURANCE_LEVEL_COLORS[l] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// RequiredMfaMethod
// ══════════════════════════════════════════════════════════════════════════

const REQUIRED_MFA_METHOD_OVERRIDES: Partial<
  Record<RequiredMfaMethod, string>
> = {
  [RequiredMfaMethod.ANY_MFA]: "Any MFA",
  [RequiredMfaMethod.WEBAUTHN]: "WebAuthn",
  [RequiredMfaMethod.HARDWARE_KEY_ONLY]: "Hardware Key Only",
};

export const requiredMfaMethodLabel = (m: RequiredMfaMethod): string =>
  label(RequiredMfaMethod, m, REQUIRED_MFA_METHOD_OVERRIDES);

// ══════════════════════════════════════════════════════════════════════════
// FlagStatus
// ══════════════════════════════════════════════════════════════════════════

const FLAG_STATUS_COLORS: Partial<Record<FlagStatus, string>> = {
  [FlagStatus.ON]: "positive",
  [FlagStatus.OFF]: "negative",
  [FlagStatus.DEFAULT]: "grey",
};

const FLAG_STATUS_ICONS: Partial<Record<FlagStatus, string>> = {
  [FlagStatus.ON]: "sym_o_toggle_on",
  [FlagStatus.OFF]: "sym_o_toggle_off",
  [FlagStatus.DEFAULT]: "sym_o_radio_button_unchecked",
};

export const flagStatusLabel = (s: FlagStatus): string => label(FlagStatus, s);

export const flagStatusColor = (s: FlagStatus): string =>
  FLAG_STATUS_COLORS[s] ?? "grey";

export const flagStatusIcon = (s: FlagStatus): string =>
  FLAG_STATUS_ICONS[s] ?? "sym_o_help";

// ══════════════════════════════════════════════════════════════════════════
// DependencyStatus
// ══════════════════════════════════════════════════════════════════════════

const DEPENDENCY_STATUS_COLORS: Partial<Record<DependencyStatus, string>> = {
  [DependencyStatus.UP]: "positive",
  [DependencyStatus.DEGRADED]: "warning",
  [DependencyStatus.DOWN]: "negative",
};

export const dependencyStatusLabel = (s: DependencyStatus): string =>
  label(DependencyStatus, s);

export const dependencyStatusColor = (s: DependencyStatus): string =>
  DEPENDENCY_STATUS_COLORS[s] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// ProbeStatus
// ══════════════════════════════════════════════════════════════════════════

const PROBE_STATUS_COLORS: Partial<Record<ProbeStatus, string>> = {
  [ProbeStatus.OK]: "positive",
  [ProbeStatus.FAIL]: "negative",
};

export const probeStatusLabel = (s: ProbeStatus): string =>
  label(ProbeStatus, s);

export const probeStatusColor = (s: ProbeStatus): string =>
  PROBE_STATUS_COLORS[s] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// ChannelType
// ══════════════════════════════════════════════════════════════════════════

const CHANNEL_TYPE_OVERRIDES: Partial<Record<ChannelType, string>> = {
  [ChannelType.EMAIL]: "Email (SMTP)",
  [ChannelType.SMS]: "SMS",
  [ChannelType.WEB_PUSH]: "Web Push",
  [ChannelType.MOBILE_PUSH]: "Mobile Push",
};

const CHANNEL_TYPE_ICONS: Partial<Record<ChannelType, string>> = {
  [ChannelType.EMAIL]: "sym_o_mail",
  [ChannelType.SMS]: "sym_o_sms",
  [ChannelType.WEB_PUSH]: "sym_o_notifications",
  [ChannelType.MOBILE_PUSH]: "sym_o_phone_android",
};

export const channelTypeLabel = (t: ChannelType): string =>
  label(ChannelType, t, CHANNEL_TYPE_OVERRIDES);

export const channelTypeIcon = (t: ChannelType): string =>
  CHANNEL_TYPE_ICONS[t] ?? "sym_o_send";

// ══════════════════════════════════════════════════════════════════════════
// ChannelHealth
// ══════════════════════════════════════════════════════════════════════════

const CHANNEL_HEALTH_COLORS: Partial<Record<ChannelHealth, string>> = {
  [ChannelHealth.HEALTHY]: "positive",
  [ChannelHealth.DEGRADED]: "warning",
  [ChannelHealth.DOWN]: "negative",
  [ChannelHealth.NOT_CONFIGURED]: "grey",
};

const CHANNEL_HEALTH_OVERRIDES: Partial<Record<ChannelHealth, string>> = {
  [ChannelHealth.NOT_CONFIGURED]: "Not Configured",
};

export const channelHealthLabel = (h: ChannelHealth): string =>
  label(ChannelHealth, h, CHANNEL_HEALTH_OVERRIDES);

export const channelHealthColor = (h: ChannelHealth): string =>
  CHANNEL_HEALTH_COLORS[h] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// SmtpEncryption
// ══════════════════════════════════════════════════════════════════════════

const SMTP_ENCRYPTION_OVERRIDES: Partial<Record<SmtpEncryption, string>> = {
  [SmtpEncryption.STARTTLS]: "STARTTLS",
  [SmtpEncryption.IMPLICIT_TLS]: "Implicit TLS",
};

export const smtpEncryptionLabel = (e: SmtpEncryption): string =>
  label(SmtpEncryption, e, SMTP_ENCRYPTION_OVERRIDES);

// ══════════════════════════════════════════════════════════════════════════
// MigrationSource
// ══════════════════════════════════════════════════════════════════════════

const MIGRATION_SOURCE_OVERRIDES: Partial<Record<MigrationSource, string>> = {
  [MigrationSource.AUTH0]: "Auth0",
  [MigrationSource.LDAP]: "LDAP/AD",
  [MigrationSource.SCIM]: "SCIM 2.0",
  [MigrationSource.CSV]: "Custom CSV",
};

const MIGRATION_SOURCE_ICONS: Partial<Record<MigrationSource, string>> = {
  [MigrationSource.KEYCLOAK]: "sym_o_key",
  [MigrationSource.AUTH0]: "sym_o_lock",
  [MigrationSource.OKTA]: "sym_o_shield",
  [MigrationSource.ZITADEL]: "sym_o_security",
  [MigrationSource.AUTHENTIK]: "sym_o_verified_user",
  [MigrationSource.LDAP]: "sym_o_folder_shared",
  [MigrationSource.SCIM]: "sym_o_sync",
  [MigrationSource.CSV]: "sym_o_table",
};

export const migrationSourceLabel = (s: MigrationSource): string =>
  label(MigrationSource, s, MIGRATION_SOURCE_OVERRIDES);

export const migrationSourceIcon = (s: MigrationSource): string =>
  MIGRATION_SOURCE_ICONS[s] ?? "sym_o_input";

// ══════════════════════════════════════════════════════════════════════════
// MigrationState
// ══════════════════════════════════════════════════════════════════════════

const MIGRATION_STATE_COLORS: Partial<Record<MigrationState, string>> = {
  [MigrationState.PENDING]: "grey",
  [MigrationState.RUNNING]: "info",
  [MigrationState.COMPLETED]: "positive",
  [MigrationState.FAILED]: "negative",
};

export const migrationStateLabel = (s: MigrationState): string =>
  label(MigrationState, s);

export const migrationStateColor = (s: MigrationState): string =>
  MIGRATION_STATE_COLORS[s] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// ImportAction
// ══════════════════════════════════════════════════════════════════════════

const IMPORT_ACTION_COLORS: Partial<Record<ImportAction, string>> = {
  [ImportAction.CREATE]: "positive",
  [ImportAction.UPDATE]: "warning",
  [ImportAction.CONFLICT]: "negative",
  [ImportAction.SKIP]: "grey",
};

export const importActionLabel = (a: ImportAction): string =>
  label(ImportAction, a);

export const importActionColor = (a: ImportAction): string =>
  IMPORT_ACTION_COLORS[a] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// LegacyHashAlgorithm
// ══════════════════════════════════════════════════════════════════════════

const LEGACY_HASH_OVERRIDES: Partial<Record<LegacyHashAlgorithm, string>> = {
  [LegacyHashAlgorithm.PBKDF2_SHA256]: "PBKDF2-SHA256",
  [LegacyHashAlgorithm.ARGON2ID]: "Argon2id",
};

export const legacyHashAlgorithmLabel = (a: LegacyHashAlgorithm): string =>
  label(LegacyHashAlgorithm, a, LEGACY_HASH_OVERRIDES);

// ══════════════════════════════════════════════════════════════════════════
// ConflictResolution
// ══════════════════════════════════════════════════════════════════════════

export const conflictResolutionLabel = (r: ConflictResolution): string =>
  label(ConflictResolution, r);

// ══════════════════════════════════════════════════════════════════════════
// AnalyticsPeriod
// ══════════════════════════════════════════════════════════════════════════

const ANALYTICS_PERIOD_OVERRIDES: Partial<Record<AnalyticsPeriod, string>> = {
  [AnalyticsPeriod.ANALYTICS_PERIOD_24H]: "24 Hours",
  [AnalyticsPeriod.ANALYTICS_PERIOD_7D]: "7 Days",
  [AnalyticsPeriod.ANALYTICS_PERIOD_30D]: "30 Days",
  [AnalyticsPeriod.ANALYTICS_PERIOD_90D]: "90 Days",
};

export const analyticsPeriodLabel = (p: AnalyticsPeriod): string =>
  label(AnalyticsPeriod, p, ANALYTICS_PERIOD_OVERRIDES);

// ══════════════════════════════════════════════════════════════════════════
// MetricTrend
// ══════════════════════════════════════════════════════════════════════════

const METRIC_TREND_COLORS: Partial<Record<MetricTrend, string>> = {
  [MetricTrend.UP]: "positive",
  [MetricTrend.DOWN]: "negative",
  [MetricTrend.FLAT]: "grey",
};

const METRIC_TREND_ICONS: Partial<Record<MetricTrend, string>> = {
  [MetricTrend.UP]: "sym_o_trending_up",
  [MetricTrend.DOWN]: "sym_o_trending_down",
  [MetricTrend.FLAT]: "sym_o_trending_flat",
};

export const metricTrendLabel = (t: MetricTrend): string =>
  label(MetricTrend, t);

export const metricTrendColor = (t: MetricTrend): string =>
  METRIC_TREND_COLORS[t] ?? "grey";

export const metricTrendIcon = (t: MetricTrend): string =>
  METRIC_TREND_ICONS[t] ?? "sym_o_trending_flat";

// ══════════════════════════════════════════════════════════════════════════
// AttributeDataType
// ══════════════════════════════════════════════════════════════════════════

const ATTRIBUTE_DATA_TYPE_ICONS: Partial<Record<AttributeDataType, string>> = {
  [AttributeDataType.STRING]: "sym_o_text_fields",
  [AttributeDataType.NUMBER]: "sym_o_tag",
  [AttributeDataType.BOOLEAN]: "sym_o_toggle_on",
  [AttributeDataType.DATE]: "sym_o_calendar_today",
  [AttributeDataType.ENUM]: "sym_o_list",
  [AttributeDataType.ARRAY]: "sym_o_data_array",
};

export const attributeDataTypeLabel = (t: AttributeDataType): string =>
  label(AttributeDataType, t);

export const attributeDataTypeIcon = (t: AttributeDataType): string =>
  ATTRIBUTE_DATA_TYPE_ICONS[t] ?? "sym_o_help";

// ══════════════════════════════════════════════════════════════════════════
// AttributePermission
// ══════════════════════════════════════════════════════════════════════════

const ATTRIBUTE_PERMISSION_OVERRIDES: Partial<
  Record<AttributePermission, string>
> = {
  [AttributePermission.ADMIN_ONLY]: "Admin Only",
  [AttributePermission.USER_READ_ONLY]: "User Read-Only",
  [AttributePermission.USER_READ_WRITE]: "User Read-Write",
};

const ATTRIBUTE_PERMISSION_COLORS: Partial<
  Record<AttributePermission, string>
> = {
  [AttributePermission.ADMIN_ONLY]: "negative",
  [AttributePermission.USER_READ_ONLY]: "warning",
  [AttributePermission.USER_READ_WRITE]: "positive",
};

export const attributePermissionLabel = (p: AttributePermission): string =>
  label(AttributePermission, p, ATTRIBUTE_PERMISSION_OVERRIDES);

export const attributePermissionColor = (p: AttributePermission): string =>
  ATTRIBUTE_PERMISSION_COLORS[p] ?? "grey";

// ══════════════════════════════════════════════════════════════════════════
// SmtpEncryptionType
// ══════════════════════════════════════════════════════════════════════════

const SMTP_ENCRYPTION_TYPE_OVERRIDES: Partial<
  Record<SmtpEncryptionType, string>
> = {
  [SmtpEncryptionType.SSL_TLS]: "SSL/TLS",
  [SmtpEncryptionType.STARTTLS]: "StartTLS",
};

export const smtpEncryptionTypeLabel = (e: SmtpEncryptionType): string =>
  label(SmtpEncryptionType, e, SMTP_ENCRYPTION_TYPE_OVERRIDES);

// ══════════════════════════════════════════════════════════════════════════
// SmtpAuthType
// ══════════════════════════════════════════════════════════════════════════

const SMTP_AUTH_OVERRIDES: Partial<Record<SmtpAuthType, string>> = {
  [SmtpAuthType.USERNAME_PASSWORD]: "Username & Password",
};

export const smtpAuthTypeLabel = (a: SmtpAuthType): string =>
  label(SmtpAuthType, a, SMTP_AUTH_OVERRIDES);

// ══════════════════════════════════════════════════════════════════════════
// ImportConflictStrategy
// ══════════════════════════════════════════════════════════════════════════

export const importConflictStrategyLabel = (
  s: ImportConflictStrategy,
): string => label(ImportConflictStrategy, s);
