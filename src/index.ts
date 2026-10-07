// Composables
export {
  useGrpc,
  initGrpc,
  getTransport,
  closeTransport,
  getTransportType,
  type TransportType,
} from "./composables/useGrpc";
export { useSession, type SessionCallbacks } from "./composables/useSession";
export {
  useBffAuth,
  initBff,
  getBffBaseUrl,
  checkBffSession,
  startBffLogin,
  bffLogout,
  bffCsrfToken,
  type BffUserInfo,
} from "./composables/useBffAuth";
export {
  initAccountApi,
  getAccountTransport,
  closeAccountTransport,
  type AccountApiConfig,
} from "./composables/useAccountTransport";

// Stores
export { useAuthStore } from "./stores/auth";

// Components — import from '@structured-id/ui-core/components' (raw .vue SFC)
// Consuming apps with their own Vue build pipeline import directly:
//   import { SidStatusBadge } from '@structured-id/ui-core/components'

// Utils
export {
  isValidEmail,
  isValidPhone,
  isValidUuid,
  isValidUsername,
  minLength,
  maxLength,
  isRequired,
  formatDate,
  formatRelativeTime,
  truncate,
  maskEmail,
} from "./utils";

export {
  detectLoginInputType,
  normalizePrincipal,
  type LoginInputType,
  type NormalizedPrincipal,
} from "./utils/normalizePrincipal";

export {
  rpcRefusal,
  rpcReason,
  refusalMessage,
  REFUSAL_TEXTS,
  SID_ERROR_DOMAIN,
  type RpcRefusal,
} from "./utils/rpcRefusal";

// Types
export type { AuthState, SessionInfo, GrpcConfig } from "./types";

// i18n key constants
export { AUTH_KEYS, COMMON_KEYS } from "./i18n";

// Generated proto clients and types
export { AuthServiceClient } from "./generated/sid/v1/authn/auth.client";
export { IdentityServiceClient } from "./generated/sid/v1/identity/identity.client";
export { AccountServiceClient } from "./generated/sid/v1/account/account.client";
export { UpstreamServiceClient } from "./generated/sid/v1/federation/upstream.client";
export { EnrollmentServiceClient } from "./generated/sid/v1/admin/enrollment.client";
export type { InstanceStatus } from "./generated/sid/v1/admin/enrollment";

// Re-export commonly used proto types
export type {
  OpaqueLoginStartRequest,
  OpaqueLoginStartResponse,
  OpaqueLoginFinishRequest,
  OpaqueLoginFinishResponse,
  OpaqueRegistrationStartRequest,
  OpaqueRegistrationStartResponse,
  OpaqueRegistrationFinishRequest,
  OpaqueRegistrationFinishResponse,
  MfaVerifyResponse,
  TotpEnrollmentChallenge,
  FinishTotpEnrollmentResponse,
  ResendSmsMfaResponse,
  GenerateRecoveryCodesResponse,
  VerifyOtpResponse,
  ResendOtpResponse,
  VerifyPhoneResponse,
  ConfirmIdpLinkResponse,
  UserOrganization,
  ListUserOrganizationsResponse,
  SelectOrganizationResponse,
  GetTermsResponse,
  AcceptTermsResponse,
  CibaConsentResponse,
  VerifyCaptchaResponse,
  DynamicPrompt,
  DynamicPromptField,
  SubmitDynamicPromptResponse,
  StepUpChallenge,
  CompleteStepUpResponse,
  DeleteMfaCredentialResponse,
  ConfirmAccountDeletionResponse,
  SubmitDeviceUserCodeResponse,
  OAuth2AuthorizeResponse,
  WebAuthnAuthenticationStartResponse,
  WebAuthnAuthenticationFinishResponse,
  WebAuthnRegistrationStartResponse,
  WebAuthnRegistrationFinishResponse,
  RequestMagicLinkResponse,
  VerifyMagicLinkResponse,
  RequestPasswordResetResponse,
  VerifyPasswordResetResponse,
  ExecutePasswordResetResponse,
  CompletePasswordResetResponse,
  OpaqueZkppRegistrationStartResponse,
  OpaqueZkppRegistrationFinishResponse,
  PasswordChangeChallengeResponse,
  PasswordChangeExecuteResponse,
  PasswordChangeFinishResponse,
} from "./generated/sid/v1/authn/auth";

// Password operations: the history evaluator and the proof the finish carries
export { PasswordHistoryEvaluatorServiceClient } from "./generated/sid/v1/authn/password_history.client";
export type {
  PasswordHistoryContext,
  PasswordHistoryDomain,
  PasswordHistoryEvaluation,
  PasswordHistoryEvaluationProof,
  PasswordRegistrationProof,
} from "./generated/sid/v1/authn/password_history";
export type { PasswordOperationId } from "./generated/sid/v1/ids/ids";

export type {
  Profile,
  Session,
  Credential,
  Principal,
} from "./generated/sid/v1/identity/identity";

export { StepUpMethod } from "./generated/sid/v1/authn/auth";

export {
  ProfileStatus,
  PrincipalType,
  CredentialType,
  AuthenticatorAttachment,
} from "./generated/sid/v1/identity/identity";

export type {
  ConsentInfo,
  ClaimConsent,
  ActivityEvent,
  ListConsentsResponse,
  GetConsentDetailResponse,
  ListActivityEventsResponse,
  LinkedAccount,
  ListLinkedAccountsResponse,
  LinkAccountResponse,
  ReauthenticateLinkResponse,
  AvailableApp,
  ListAvailableAppsResponse,
  LaunchAppResponse,
  PasswordlessStatus,
  DisablePasswordlessResponse,
} from "./generated/sid/v1/account/account";

export {
  ConsentStatus,
  ClaimType,
  ClaimConsentStatus,
  ActivityEventStatus,
  LinkedAccountTrustCategory,
  LinkedAccountStatus,
} from "./generated/sid/v1/account/account";

export type { EnabledProviderInfo } from "./generated/sid/v1/federation/upstream";

export { Timestamp } from "./generated/google/protobuf/timestamp";

// Browser VP — import from '@structured-id/ui-core/browser-vp'
// Separate entry point: WebAuthn PRF, IndexedDB, VP creation (browser-only APIs)
