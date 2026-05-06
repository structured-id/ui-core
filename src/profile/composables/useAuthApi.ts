/**
 * Profile auth API composable.
 *
 * Wraps AuthServiceClient proto calls with Bearer auth.
 * Covers: OPAQUE, MFA, step-up, WebAuthn, magic link, OAuth2, CIBA, captcha, terms.
 *
 * OPAQUE gRPC calls are here (like all other auth RPCs).
 * OPAQUE client-side crypto orchestration lives in useOpaqueAuth.ts
 * (accepts OpaqueClientApi interface — no dependency on @structured-id/opaque).
 */
import {
  getTransport,
  AuthServiceClient,
  StepUpMethod,
  type OpaqueLoginStartResponse,
  type OpaqueLoginFinishResponse,
  type OpaqueRegistrationStartResponse,
  type OpaqueRegistrationFinishResponse,
  type MfaVerifyResponse,
  type TotpEnrollmentChallenge,
  type FinishTotpEnrollmentResponse,
  type ResendSmsMfaResponse,
  type GenerateRecoveryCodesResponse,
  type VerifyOtpResponse,
  type ResendOtpResponse,
  type VerifyPhoneResponse,
  type ConfirmIdpLinkResponse,
  type ListUserOrganizationsResponse,
  type SelectOrganizationResponse,
  type GetTermsResponse,
  type AcceptTermsResponse,
  type CibaConsentResponse,
  type VerifyCaptchaResponse,
  type DynamicPrompt,
  type SubmitDynamicPromptResponse,
  type StepUpChallenge,
  type CompleteStepUpResponse,
  type DeleteMfaCredentialResponse,
  type ConfirmAccountDeletionResponse,
  type SubmitDeviceUserCodeResponse,
  type WebAuthnAuthenticationStartResponse,
  type WebAuthnAuthenticationFinishResponse,
  type WebAuthnRegistrationStartResponse,
  type WebAuthnRegistrationFinishResponse,
  type RequestMagicLinkResponse,
  type VerifyMagicLinkResponse,
  type UserOrganization,
  type RequestPasswordResetResponse,
  type VerifyPasswordResetResponse,
  type CompletePasswordResetResponse,
} from "../../index";
import { authMeta } from "../auth";

function client(): AuthServiceClient {
  return new AuthServiceClient(getTransport());
}

// ── MFA TOTP ──

export async function startTotpEnrollment(): Promise<TotpEnrollmentChallenge> {
  const { response } = await client().startTotpEnrollment(
    {},
    { meta: authMeta() },
  );
  return response;
}

export async function finishTotpEnrollment(
  code: string,
): Promise<FinishTotpEnrollmentResponse> {
  const { response } = await client().finishTotpEnrollment(
    { code },
    { meta: authMeta() },
  );
  return response;
}

export async function verifyTotp(code: string): Promise<MfaVerifyResponse> {
  const { response } = await client().verifyTotp(
    { code },
    { meta: authMeta() },
  );
  return response;
}

// ── MFA SMS ──

export async function verifySmsMfa(code: string): Promise<MfaVerifyResponse> {
  const { response } = await client().verifySmsMfa(
    { code },
    { meta: authMeta() },
  );
  return response;
}

export async function resendSmsMfa(): Promise<ResendSmsMfaResponse> {
  const { response } = await client().resendSmsMfa({}, { meta: authMeta() });
  return response;
}

// ── MFA Recovery ──

export async function generateRecoveryCodes(): Promise<GenerateRecoveryCodesResponse> {
  const { response } = await client().generateRecoveryCodes(
    {},
    { meta: authMeta() },
  );
  return response;
}

export async function verifyRecoveryCode(
  code: string,
): Promise<MfaVerifyResponse> {
  const { response } = await client().verifyRecoveryCode(
    { code },
    { meta: authMeta() },
  );
  return response;
}

// ── OTP ──

export async function verifyOtp(
  code: string,
  sessionId?: string,
): Promise<VerifyOtpResponse> {
  const { response } = await client().verifyOtp(
    { code, sessionId },
    { meta: authMeta() },
  );
  return response;
}

export async function resendOtp(
  sessionId?: string,
): Promise<ResendOtpResponse> {
  const { response } = await client().resendOtp(
    { sessionId },
    { meta: authMeta() },
  );
  return response;
}

// ── Email/Phone verification ──

export async function resendEmailVerification(
  email?: string,
): Promise<{ maskedEmail: string; expiresIn: number }> {
  const { response } = await client().resendEmailVerification(
    { email },
    { meta: authMeta() },
  );
  return response;
}

export async function verifyPhone(code: string): Promise<VerifyPhoneResponse> {
  const { response } = await client().verifyPhone(
    { code },
    { meta: authMeta() },
  );
  return response;
}

export async function resendPhoneVerification(): Promise<{
  maskedPhone: string;
  expiresIn: number;
}> {
  const { response } = await client().resendPhoneVerification(
    {},
    { meta: authMeta() },
  );
  return response;
}

// ── WebAuthn ──

export async function webAuthnAuthenticationStart(
  principal?: string,
): Promise<WebAuthnAuthenticationStartResponse> {
  const { response } = await client().webAuthnAuthenticationStart(
    { principal: principal ?? "" },
    { meta: authMeta() },
  );
  return response;
}

export async function webAuthnAuthenticationFinish(
  credential: Uint8Array,
  principal?: string,
  stateKey?: string,
): Promise<WebAuthnAuthenticationFinishResponse> {
  const { response } = await client().webAuthnAuthenticationFinish(
    { credential, principal: principal ?? "", stateKey },
    { meta: authMeta() },
  );
  return response;
}

export async function webAuthnRegistrationStart(
  label?: string,
): Promise<WebAuthnRegistrationStartResponse> {
  const { response } = await client().webAuthnRegistrationStart(
    { label },
    { meta: authMeta() },
  );
  return response;
}

export async function webAuthnRegistrationFinish(
  credential: Uint8Array,
  label?: string,
): Promise<WebAuthnRegistrationFinishResponse> {
  const { response } = await client().webAuthnRegistrationFinish(
    { credential, label },
    { meta: authMeta() },
  );
  return response;
}

// ── Device Authorization (RFC 8628) ──

export async function submitDeviceUserCode(
  userCode: string,
  approve: boolean,
): Promise<SubmitDeviceUserCodeResponse> {
  const { response } = await client().submitDeviceUserCode(
    { userCode, approve },
    { meta: authMeta() },
  );
  return response;
}

// ── OAuth2 Consent ──

export async function oauth2Authorize(params: {
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope?: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  nonce?: string;
}): Promise<{ authorizationCode?: string; error?: string; state?: string }> {
  const { response } = await client().oAuth2Authorize(
    {
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      responseType: params.responseType,
      scope: params.scope,
      state: params.state,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod,
      nonce: params.nonce,
    },
    { meta: authMeta() },
  );
  const result = response.result;
  return {
    authorizationCode:
      result.oneofKind === "authorizationCode"
        ? result.authorizationCode
        : undefined,
    error: result.oneofKind === "error" ? result.error : undefined,
    state: response.state,
  };
}

// ── Magic Link ──

export async function requestMagicLink(
  principal: string,
  clientId: string,
  redirectUri: string,
): Promise<RequestMagicLinkResponse> {
  const { response } = await client().requestMagicLink(
    { principal, clientId, redirectUri },
    { meta: authMeta() },
  );
  return response;
}

export async function verifyMagicLink(
  sessionId: string,
  token: string,
): Promise<VerifyMagicLinkResponse> {
  const { response } = await client().verifyMagicLink(
    { sessionId, token },
    { meta: authMeta() },
  );
  return response;
}

// ── IdP Link ──

export async function confirmIdpLink(
  linkToken: string,
  confirm: boolean,
): Promise<ConfirmIdpLinkResponse> {
  const { response } = await client().confirmIdpLink(
    { linkToken, confirm },
    { meta: authMeta() },
  );
  return response;
}

// ── Organization Selector ──

export async function listUserOrganizations(): Promise<ListUserOrganizationsResponse> {
  const { response } = await client().listUserOrganizations(
    {},
    { meta: authMeta() },
  );
  return response;
}

export async function selectOrganization(
  organizationId: string,
): Promise<SelectOrganizationResponse> {
  const { response } = await client().selectOrganization(
    { organizationId },
    { meta: authMeta() },
  );
  return response;
}

// ── Terms ──

export async function getTerms(
  version?: string,
  locale?: string,
): Promise<GetTermsResponse> {
  const { response } = await client().getTerms(
    { version, locale },
    { meta: authMeta() },
  );
  return response;
}

export async function acceptTerms(
  version: string,
): Promise<AcceptTermsResponse> {
  const { response } = await client().acceptTerms(
    { version },
    { meta: authMeta() },
  );
  return response;
}

// ── CIBA ──

export async function approveCiba(
  authReqId: string,
): Promise<CibaConsentResponse> {
  const { response } = await client().approveCiba(
    { authReqId },
    { meta: authMeta() },
  );
  return response;
}

export async function denyCiba(
  authReqId: string,
  reason?: string,
): Promise<CibaConsentResponse> {
  const { response } = await client().denyCiba(
    { authReqId, reason },
    { meta: authMeta() },
  );
  return response;
}

// ── Captcha ──

export async function verifyCaptcha(
  challengeId: string,
  token: string,
): Promise<VerifyCaptchaResponse> {
  const { response } = await client().verifyCaptcha(
    { challengeId, token },
    { meta: authMeta() },
  );
  return response;
}

// ── Dynamic Prompt ──

export async function getDynamicPrompt(
  promptId: string,
): Promise<DynamicPrompt> {
  const { response } = await client().getDynamicPrompt(
    { promptId },
    { meta: authMeta() },
  );
  return response;
}

export async function submitDynamicPrompt(
  promptId: string,
  values: Record<string, string>,
): Promise<SubmitDynamicPromptResponse> {
  const { response } = await client().submitDynamicPrompt(
    { promptId, values },
    { meta: authMeta() },
  );
  return response;
}

// ── Step-Up Auth ──

export async function requestStepUp(
  sessionId: string,
  method: StepUpMethod,
): Promise<StepUpChallenge> {
  const { response } = await client().requestStepUp(
    { sessionId, method },
    { meta: authMeta() },
  );
  return response;
}

export async function completeStepUp(
  sessionId: string,
  method: StepUpMethod,
  challengeId: string,
  proof: {
    totpCode?: string;
    webauthnAssertion?: Uint8Array;
    recoveryCode?: string;
  },
): Promise<CompleteStepUpResponse> {
  const { response } = await client().completeStepUp(
    {
      sessionId,
      method,
      challengeId,
      proof: proof.totpCode
        ? { oneofKind: "totpCode", totpCode: proof.totpCode }
        : proof.webauthnAssertion
          ? {
              oneofKind: "webauthnAssertion",
              webauthnAssertion: proof.webauthnAssertion,
            }
          : proof.recoveryCode
            ? { oneofKind: "recoveryCode", recoveryCode: proof.recoveryCode }
            : { oneofKind: undefined },
    },
    { meta: authMeta() },
  );
  return response;
}

// ── MFA Credential Management ──

export async function deleteMfaCredential(
  credentialId: string,
): Promise<DeleteMfaCredentialResponse> {
  const { response } = await client().deleteMfaCredential(
    { credentialId },
    { meta: authMeta() },
  );
  return response;
}

// ── Account Deletion ──

export async function confirmAccountDeletion(
  confirmationText: string,
): Promise<ConfirmAccountDeletionResponse> {
  const { response } = await client().confirmAccountDeletion(
    { confirmationText },
    { meta: authMeta() },
  );
  return response;
}

// ── Password Reset ──

export async function requestPasswordReset(
  principal: string,
  clientId: string,
  redirectUri: string,
  captchaToken?: string,
): Promise<RequestPasswordResetResponse> {
  const { response } = await client().requestPasswordReset({
    principal,
    clientId,
    redirectUri,
    captchaToken: captchaToken ?? "",
  });
  return response;
}

export async function verifyPasswordReset(
  sessionId: string,
  token: string,
): Promise<VerifyPasswordResetResponse> {
  const { response } = await client().verifyPasswordReset({
    sessionId,
    token,
  });
  return response;
}

export async function completePasswordReset(
  resetSessionId: string,
  registrationRecord: Uint8Array,
  opts?: {
    zkppProof?: Uint8Array;
    zkppInstances?: Uint8Array[];
    historyCommitment?: Uint8Array;
    commitmentSalt?: Uint8Array;
  },
): Promise<CompletePasswordResetResponse> {
  const { response } = await client().completePasswordReset({
    resetSessionId,
    registrationRecord,
    zkppProof: opts?.zkppProof ?? new Uint8Array(),
    zkppInstances: opts?.zkppInstances ?? [],
    historyCommitment: opts?.historyCommitment ?? new Uint8Array(),
    commitmentSalt: opts?.commitmentSalt ?? new Uint8Array(),
  });
  return response;
}

// Recovery shard RPCs (downloadRecoveryShard, uploadRecoveryShard, getRecoveryInfo)
// are EE/SaaS-only — defined in proto-ee, not in CE proto.

// ── OPAQUE ──

export async function opaqueLoginStart(
  principal: string,
  credentialRequest: Uint8Array,
): Promise<OpaqueLoginStartResponse> {
  const { response } = await client().opaqueLoginStart({
    principal,
    credentialRequest,
  });
  return response;
}

export async function opaqueLoginFinish(
  principal: string,
  credentialFinalization: Uint8Array,
  serverLoginState: string,
): Promise<OpaqueLoginFinishResponse> {
  const { response } = await client().opaqueLoginFinish({
    principal,
    credentialFinalization,
    serverLoginState,
  });
  return response;
}

export async function opaqueRegistrationStart(
  principal: string,
  registrationRequest: Uint8Array,
): Promise<OpaqueRegistrationStartResponse> {
  const { response } = await client().opaqueRegistrationStart({
    principal,
    registrationRequest,
  });
  return response;
}

export async function opaqueRegistrationFinish(
  principal: string,
  registrationRecord: Uint8Array,
  serverSetup: string,
): Promise<OpaqueRegistrationFinishResponse> {
  const { response } = await client().opaqueRegistrationFinish({
    principal,
    registrationRecord,
    serverSetup,
  });
  return response;
}

// Re-export types for convenience
export { StepUpMethod };
export type {
  OpaqueLoginStartResponse,
  OpaqueLoginFinishResponse,
  OpaqueRegistrationStartResponse,
  OpaqueRegistrationFinishResponse,
  UserOrganization,
  MfaVerifyResponse,
  TotpEnrollmentChallenge,
  FinishTotpEnrollmentResponse,
  ResendSmsMfaResponse,
  GenerateRecoveryCodesResponse,
  VerifyOtpResponse,
  VerifyPhoneResponse,
  ConfirmIdpLinkResponse,
  ListUserOrganizationsResponse,
  SelectOrganizationResponse,
  GetTermsResponse,
  AcceptTermsResponse,
  CibaConsentResponse,
  VerifyCaptchaResponse,
  DynamicPrompt,
  SubmitDynamicPromptResponse,
  StepUpChallenge,
  CompleteStepUpResponse,
  DeleteMfaCredentialResponse,
  ConfirmAccountDeletionResponse,
  SubmitDeviceUserCodeResponse,
  WebAuthnAuthenticationStartResponse,
  WebAuthnAuthenticationFinishResponse,
  WebAuthnRegistrationStartResponse,
  WebAuthnRegistrationFinishResponse,
  RequestMagicLinkResponse,
  VerifyMagicLinkResponse,
  RequestPasswordResetResponse,
  VerifyPasswordResetResponse,
  CompletePasswordResetResponse,
};
