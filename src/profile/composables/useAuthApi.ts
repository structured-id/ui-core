/**
 * Profile auth API composable.
 *
 * Covers: OPAQUE, MFA, step-up, WebAuthn, magic link, OAuth2, CIBA, captcha, terms.
 *
 * Two surfaces: sign-in ceremonies go to SID's sign-in surface
 * (`getTransport`), where the IdP session lives; managing the signed-in
 * user's factors from the account pages is the account API
 * (`getAccountTransport`), through the BFF.
 *
 * OPAQUE gRPC calls are here (like all other auth RPCs). The password
 * ceremonies over them (client-side crypto, proofs) live in useAuth.ts,
 * behind the injected ZkppClientApi: no dependency on the client package.
 */
import { getTransport, getAccountTransport } from "../../index";
import { AuthServiceClient } from "@structured-id/proto/sid/v1/authn/auth.client";
import {
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
  type ExecutePasswordResetResponse,
  type OpaqueZkppRegistrationStartResponse,
  type OpaqueZkppRegistrationFinishResponse,
  type PasswordChangeChallengeResponse,
  type PasswordChangeExecuteResponse,
  type PasswordChangeFinishResponse,
} from "@structured-id/proto/sid/v1/authn/auth";
import type {
  PasswordHistoryContext,
  PasswordHistoryEvaluation,
  PasswordRegistrationProof,
} from "@structured-id/proto/sid/v1/authn/password_history";
import { PasswordHistoryEvaluatorServiceClient } from "@structured-id/proto/sid/v1/authn/password_history.client";
import { authMeta } from "../auth";

/** The history evaluator: in CE served beside the credential service. */
function evaluator(): PasswordHistoryEvaluatorServiceClient {
  return new PasswordHistoryEvaluatorServiceClient(getTransport());
}

/** The wire form of an operation id (16 UUIDv7 bytes). */
function operation(id: Uint8Array): { value: Uint8Array } {
  return { value: id };
}

/** The sign-in surface: ceremonies and the IdP session. */
function client(): AuthServiceClient {
  return new AuthServiceClient(getTransport());
}

/** The account API: the signed-in user managing their own factors. */
function account(): AuthServiceClient {
  return new AuthServiceClient(getAccountTransport());
}

// ── MFA TOTP ──

export async function startTotpEnrollment(): Promise<TotpEnrollmentChallenge> {
  const { response } = await account().startTotpEnrollment(
    {},
    { meta: authMeta() },
  );
  return response;
}

export async function finishTotpEnrollment(
  code: string,
): Promise<FinishTotpEnrollmentResponse> {
  const { response } = await account().finishTotpEnrollment(
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
  const { response } = await account().generateRecoveryCodes(
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
  const { response } = await account().webAuthnRegistrationStart(
    { label },
    { meta: authMeta() },
  );
  return response;
}

export async function webAuthnRegistrationFinish(
  credential: Uint8Array,
  label?: string,
): Promise<WebAuthnRegistrationFinishResponse> {
  const { response } = await account().webAuthnRegistrationFinish(
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
  /** Issuer of the authorization request being completed (`/i/<handle>/oauth2/authorize`). */
  issuerHandle: string;
  /** RFC 8707 resource indicators of the request; empty selects the client's default. */
  resource?: string[];
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
      issuerHandle: params.issuerHandle,
      resource: params.resource ?? [],
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
  const { response } = await account().deleteMfaCredential(
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

/**
 * The OPAQUE start of the replacement password under the reset's operation
 * (from `VerifyPasswordResetResponse.history`).
 */
export async function executePasswordReset(
  operationId: Uint8Array,
  registrationRequest: Uint8Array,
): Promise<ExecutePasswordResetResponse> {
  const { response } = await client().executePasswordReset({
    operationId: operation(operationId),
    registrationRequest,
  });
  return response;
}

/**
 * Complete the reset with the replacement password's record and, when the
 * client proved it, the proof; without a proof the password installs
 * policy-unverified.
 */
export async function completePasswordReset(
  resetSessionId: string,
  operationId: Uint8Array,
  registrationRecord: Uint8Array,
  proof?: PasswordRegistrationProof,
): Promise<CompletePasswordResetResponse> {
  const { response } = await client().completePasswordReset({
    resetSessionId,
    operationId: operation(operationId),
    registrationRecord,
    proof,
  });
  return response;
}

// Recovery shard RPCs (downloadRecoveryShard, uploadRecoveryShard, getRecoveryInfo)
// are EE/SaaS-only — defined in proto-ee, not in CE proto.

// ── Password operations (OPAQUE-ZKPP) ──
//
// Registration, password change and reset install a password in one
// server-side operation: the preparing RPC returns the operation's history
// context, the evaluator answers the client's blinded history input, the
// client proves, and the finish carries the record with the proof.

/**
 * Start a registration: the operation is prepared for the new account and its
 * OPAQUE request answered. `claimToken` claims an installation that has no
 * administrator yet.
 */
export async function opaqueZkppRegistrationStart(
  principal: string,
  registrationRequest: Uint8Array,
  claimToken?: string,
): Promise<OpaqueZkppRegistrationStartResponse> {
  const { response } = await client().opaqueZkppRegistrationStart({
    principal,
    registrationRequest,
    claimToken,
  });
  return response;
}

/** Finish a registration with the record and, when the client proved, the proof. */
export async function opaqueZkppRegistrationFinish(
  operationId: Uint8Array,
  registrationRecord: Uint8Array,
  proof?: PasswordRegistrationProof,
): Promise<OpaqueZkppRegistrationFinishResponse> {
  const { response } = await client().opaqueZkppRegistrationFinish({
    operationId: operation(operationId),
    registrationRecord,
    proof,
  });
  return response;
}

/**
 * The evaluator's answers to the blinded history input of the operation:
 * one per comparison domain of its context, in that order.
 */
export async function evaluatePasswordHistory(
  operationId: Uint8Array,
  blindedInput: Uint8Array,
): Promise<PasswordHistoryEvaluation[]> {
  const { response } = await evaluator().evaluatePasswordHistory({
    operationId: operation(operationId),
    blindedInput,
  });
  return response.evaluations;
}

/**
 * Prepare a change of the signed-in user's own password `credentialId`:
 * `registrationRequest` is the new password's OPAQUE start, which the
 * operation fixes; `credentialRequest` (KE1) begins the sign-in that proves
 * the current password, empty when the change does not prove it.
 */
export async function passwordChangeChallenge(
  credentialId: string,
  registrationRequest: Uint8Array,
  credentialRequest: Uint8Array = new Uint8Array(),
): Promise<PasswordChangeChallengeResponse> {
  const { response } = await account().passwordChangeChallenge(
    { credentialId, credentialRequest, registrationRequest },
    { meta: authMeta() },
  );
  return response;
}

/**
 * The server's answer to the registration request the challenge fixed, with
 * the KE3 of the current-password sign-in the challenge began (empty when
 * it began none).
 */
export async function passwordChangeExecute(
  operationId: Uint8Array,
  credentialId: string,
  credentialFinalization: Uint8Array = new Uint8Array(),
): Promise<PasswordChangeExecuteResponse> {
  const { response } = await account().passwordChangeExecute(
    {
      operationId: operation(operationId),
      credentialId,
      credentialFinalization,
    },
    { meta: authMeta() },
  );
  return response;
}

/**
 * How long, in milliseconds from the server's answer, the signed-in session
 * may still change its password without the current password; 0 when it
 * needs it now.
 */
export async function passwordChangeRequirementMs(): Promise<number> {
  const { response } = await account().getPasswordChangeRequirement(
    {},
    { meta: authMeta() },
  );
  const left = response.currentPasswordRequiredIn;
  if (!left) return 0;
  return Number(left.seconds) * 1000 + Math.floor(left.nanos / 1_000_000);
}

/** Finish the change with the new password's record and, when proved, the proof. */
export async function passwordChangeFinish(
  operationId: Uint8Array,
  credentialId: string,
  registrationRecord: Uint8Array,
  proof?: PasswordRegistrationProof,
): Promise<PasswordChangeFinishResponse> {
  const { response } = await account().passwordChangeFinish(
    {
      operationId: operation(operationId),
      credentialId,
      registrationRecord,
      proof,
    },
    { meta: authMeta() },
  );
  return response;
}

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

/**
 * `claimToken`: the instance claim token (`sidclaim_...`) from the service log.
 * Required while the installation has no administrator; the new profile then
 * becomes its first administrator.
 */
export async function opaqueRegistrationStart(
  principal: string,
  registrationRequest: Uint8Array,
  claimToken?: string,
): Promise<OpaqueRegistrationStartResponse> {
  const { response } = await client().opaqueRegistrationStart({
    principal,
    registrationRequest,
    claimToken,
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
  ExecutePasswordResetResponse,
  CompletePasswordResetResponse,
  OpaqueZkppRegistrationStartResponse,
  OpaqueZkppRegistrationFinishResponse,
  PasswordChangeChallengeResponse,
  PasswordChangeExecuteResponse,
  PasswordChangeFinishResponse,
  PasswordHistoryContext,
  PasswordHistoryEvaluation,
  PasswordRegistrationProof,
};
