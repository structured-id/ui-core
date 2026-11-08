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
import {
  CredentialId,
  MagicLinkId,
  OpaqueLoginId,
  OtpSessionId,
  ResetSessionId,
  SessionId,
  StepUpChallengeId,
  optional,
  required,
} from "@structured-id/ids";
import { AuthServiceClient } from "@structured-id/proto/sid/v1/authn/auth.client";
import {
  StepUpMethod,
  type OpaqueLoginStartResponse,
  type OpaqueLoginFinishResponse,
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
  type GetZkppPolicyResponse,
} from "@structured-id/proto/sid/v1/authn/auth";
import type {
  PasswordHistoryContext,
  PasswordHistoryEvaluation,
  PasswordRegistrationProof,
} from "@structured-id/proto/sid/v1/authn/password_history";
import { PasswordHistoryEvaluatorServiceClient } from "@structured-id/proto/sid/v1/authn/password_history.client";
import { authMeta } from "../auth";
import {
  endPendingSignIn,
  holdPendingSignIn,
  pendingSignInMeta,
  type PendingSignIn,
} from "../pendingSignIn";

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

/**
 * An answer with its identifier field `K` read into the typed identifier
 * `V`. Reading validates it: a malformed or missing reference the answer
 * owes fails here, not on a page.
 */
export type WithId<T, K extends keyof T, V> = Omit<T, K> & { [P in K]: V };

// ── MFA TOTP ──

/**
 * Who enrolls a factor: the signed-in user from the account pages, or the
 * pending sign-in enrolling its first factor on the sign-in surface.
 */
export type Enrolling = "account" | "sign-in";

function enrollmentClient(by: Enrolling): {
  client: AuthServiceClient;
  meta: Record<string, string>;
} {
  return by === "sign-in"
    ? { client: client(), meta: signInMeta() }
    : { client: account(), meta: authMeta() };
}

export async function startTotpEnrollment(
  by: Enrolling = "account",
): Promise<TotpEnrollmentChallenge> {
  const { client: enroller, meta } = enrollmentClient(by);
  const { response } = await enroller.startTotpEnrollment({}, { meta });
  return response;
}

export type TotpEnrollmentResult = WithId<
  FinishTotpEnrollmentResponse,
  "credentialId",
  CredentialId
>;

/**
 * Finish the TOTP enrollment with its first code. A sign-in that enrolled
 * its first factor then completes with a fresh code ({@link verifyTotp}).
 */
export async function finishTotpEnrollment(
  code: string,
  by: Enrolling = "account",
): Promise<TotpEnrollmentResult> {
  const { client: enroller, meta } = enrollmentClient(by);
  const { response } = await enroller.finishTotpEnrollment({ code }, { meta });
  return {
    ...response,
    credentialId: required(CredentialId, response.credentialId),
  };
}

/** A second factor's answer: the session once the last required step passed. */
export type MfaVerifyResult = WithId<
  MfaVerifyResponse,
  "sessionId",
  SessionId | undefined
>;

/**
 * A verification's answer. The session it names ends the pending sign-in
 * the verification completed; any failure keeps it, so the same completion
 * can be repeated.
 */
function mfaVerified(response: MfaVerifyResponse): MfaVerifyResult {
  const sessionId = optional(SessionId, response.sessionId);
  if (sessionId) endPendingSignIn();
  return { ...response, sessionId };
}

/** Metadata of a call that completes the pending sign-in, if this tab has one. */
function signInMeta(): Record<string, string> {
  return { ...authMeta(), ...pendingSignInMeta() };
}

export async function verifyTotp(code: string): Promise<MfaVerifyResult> {
  const { response } = await client().verifyTotp(
    { code },
    { meta: signInMeta() },
  );
  return mfaVerified(response);
}

// ── MFA SMS ──

export async function verifySmsMfa(code: string): Promise<MfaVerifyResult> {
  const { response } = await client().verifySmsMfa(
    { code },
    { meta: signInMeta() },
  );
  return mfaVerified(response);
}

export async function resendSmsMfa(): Promise<ResendSmsMfaResponse> {
  const { response } = await client().resendSmsMfa({}, { meta: signInMeta() });
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
): Promise<MfaVerifyResult> {
  const { response } = await client().verifyRecoveryCode(
    { code },
    { meta: signInMeta() },
  );
  return mfaVerified(response);
}

// ── OTP ──

/** A verified code's answer: the provisional session, set only when verified. */
export type VerifyOtpResult = WithId<
  VerifyOtpResponse,
  "sessionId",
  SessionId | undefined
>;

/** Verify `code` of the request `otpSessionId` (RequestOtpResponse). */
export async function verifyOtp(
  code: string,
  otpSessionId: OtpSessionId,
): Promise<VerifyOtpResult> {
  const { response } = await client().verifyOtp(
    { code, otpSessionId: otpSessionId.toWire() },
    { meta: authMeta() },
  );
  return { ...response, sessionId: optional(SessionId, response.sessionId) };
}

export async function resendOtp(
  otpSessionId: OtpSessionId,
): Promise<ResendOtpResponse> {
  const { response } = await client().resendOtp(
    { otpSessionId: otpSessionId.toWire() },
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

export type PasskeySignInResult = WithId<
  WebAuthnAuthenticationFinishResponse,
  "sessionId",
  SessionId
> & { pending: PendingSignIn | null };

/**
 * Finish a passkey sign-in with the assertion; the server finds the ceremony
 * by the challenge the assertion signs. `pending` is the second factor the
 * sign-in still owes, kept for its completion.
 */
export async function webAuthnAuthenticationFinish(
  credential: Uint8Array,
  principal?: string,
): Promise<PasskeySignInResult> {
  const { response } = await client().webAuthnAuthenticationFinish(
    { credential, principal: principal ?? "" },
    { meta: authMeta() },
  );
  return {
    ...response,
    sessionId: required(SessionId, response.sessionId),
    pending: holdPendingSignIn(response),
  };
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

export type PasskeyRegistrationResult = WithId<
  WebAuthnRegistrationFinishResponse,
  "credentialId",
  CredentialId
>;

export async function webAuthnRegistrationFinish(
  credential: Uint8Array,
  label?: string,
): Promise<PasskeyRegistrationResult> {
  const { response } = await account().webAuthnRegistrationFinish(
    { credential, label },
    { meta: authMeta() },
  );
  return {
    ...response,
    credentialId: required(CredentialId, response.credentialId),
  };
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

export type MagicLinkRequest = WithId<
  RequestMagicLinkResponse,
  "magicLinkId",
  MagicLinkId
>;

export async function requestMagicLink(
  principal: string,
  clientId: string,
  redirectUri: string,
): Promise<MagicLinkRequest> {
  const { response } = await client().requestMagicLink(
    { principal, clientId, redirectUri },
    { meta: authMeta() },
  );
  return {
    ...response,
    magicLinkId: required(MagicLinkId, response.magicLinkId),
  };
}

export type MagicLinkSignInResult = WithId<
  VerifyMagicLinkResponse,
  "sessionId",
  SessionId
>;

/**
 * Verify the magic link `magicLinkId` with its `token`; the page reads both
 * from the link (`MagicLinkId.parse` of its text form).
 */
export async function verifyMagicLink(
  magicLinkId: MagicLinkId,
  token: string,
): Promise<MagicLinkSignInResult> {
  const { response } = await client().verifyMagicLink(
    { magicLinkId: magicLinkId.toWire(), token },
    { meta: authMeta() },
  );
  return { ...response, sessionId: required(SessionId, response.sessionId) };
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

/** A step-up challenge; `challengeId` is absent for a 1-phase method. */
export type StepUpChallengeResult = WithId<
  StepUpChallenge,
  "challengeId",
  StepUpChallengeId | undefined
>;

/** Request a step-up challenge for the session the bearer token holds. */
export async function requestStepUp(
  method: StepUpMethod,
): Promise<StepUpChallengeResult> {
  const { response } = await client().requestStepUp(
    { method },
    { meta: authMeta() },
  );
  return {
    ...response,
    challengeId: optional(StepUpChallengeId, response.challengeId),
  };
}

/**
 * Elevate the bearer token's session with `proof`; `challengeId` is the
 * challenge's (absent for a 1-phase method).
 */
export async function completeStepUp(
  method: StepUpMethod,
  challengeId: StepUpChallengeId | undefined,
  proof: {
    totpCode?: string;
    webauthnAssertion?: Uint8Array;
    recoveryCode?: string;
  },
): Promise<CompleteStepUpResponse> {
  const { response } = await client().completeStepUp(
    {
      method,
      challengeId: challengeId?.toWire(),
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
  credentialId: CredentialId,
): Promise<DeleteMfaCredentialResponse> {
  const { response } = await account().deleteMfaCredential(
    { credentialId: credentialId.toWire() },
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

/**
 * Verify the reset `resetSessionId` with its `token`; the page reads both
 * from the emailed link (`ResetSessionId.parse` of its text form). Later
 * steps name the reset by the operation in the answer's `history`.
 */
export async function verifyPasswordReset(
  resetSessionId: ResetSessionId,
  token: string,
): Promise<VerifyPasswordResetResponse> {
  const { response } = await client().verifyPasswordReset({
    resetSessionId: resetSessionId.toWire(),
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

/** A completed reset: the session it signed in, absent when it signed in none. */
export type PasswordResetResult = WithId<
  CompletePasswordResetResponse,
  "sessionId",
  SessionId | undefined
>;

/**
 * Complete the reset with the replacement password's record and, when the
 * client proved it, the proof; without a proof the password installs
 * policy-unverified. The operation carries the verified reset's authority.
 */
export async function completePasswordReset(
  operationId: Uint8Array,
  registrationRecord: Uint8Array,
  proof?: PasswordRegistrationProof,
): Promise<PasswordResetResult> {
  const { response } = await client().completePasswordReset({
    operationId: operation(operationId),
    registrationRecord,
    proof,
  });
  return { ...response, sessionId: optional(SessionId, response.sessionId) };
}

/** The password policy the server's proof checks a new password against. */
export async function getPasswordPolicy(): Promise<GetZkppPolicyResponse> {
  const { response } = await client().getZkppPolicy({});
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

export type RegistrationFinishResult = WithId<
  OpaqueZkppRegistrationFinishResponse,
  "credentialId",
  CredentialId
>;

/** Finish a registration with the record and, when the client proved, the proof. */
export async function opaqueZkppRegistrationFinish(
  operationId: Uint8Array,
  registrationRecord: Uint8Array,
  proof?: PasswordRegistrationProof,
): Promise<RegistrationFinishResult> {
  const { response } = await client().opaqueZkppRegistrationFinish({
    operationId: operation(operationId),
    registrationRecord,
    proof,
  });
  return {
    ...response,
    credentialId: required(CredentialId, response.credentialId),
  };
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
  credentialId: CredentialId,
  registrationRequest: Uint8Array,
  credentialRequest: Uint8Array = new Uint8Array(),
): Promise<PasswordChangeChallengeResponse> {
  const { response } = await account().passwordChangeChallenge(
    {
      credentialId: credentialId.toWire(),
      credentialRequest,
      registrationRequest,
    },
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
  credentialId: CredentialId,
  credentialFinalization: Uint8Array = new Uint8Array(),
): Promise<PasswordChangeExecuteResponse> {
  const { response } = await account().passwordChangeExecute(
    {
      operationId: operation(operationId),
      credentialId: credentialId.toWire(),
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
  const { response: left } = await account().getPasswordChangeRequirement(
    {},
    { meta: authMeta() },
  );
  return Number(left.seconds) * 1000 + Math.floor(left.nanos / 1_000_000);
}

/** Finish the change with the new password's record and, when proved, the proof. */
export async function passwordChangeFinish(
  operationId: Uint8Array,
  credentialId: CredentialId,
  registrationRecord: Uint8Array,
  proof?: PasswordRegistrationProof,
): Promise<void> {
  await account().passwordChangeFinish(
    {
      operationId: operation(operationId),
      credentialId: credentialId.toWire(),
      registrationRecord,
      proof,
    },
    { meta: authMeta() },
  );
}

// ── OPAQUE ──

/** The login the start began, for its finish to name. */
export type LoginStartResult = WithId<
  OpaqueLoginStartResponse,
  "loginId",
  OpaqueLoginId
>;

export async function opaqueLoginStart(
  principal: string,
  credentialRequest: Uint8Array,
): Promise<LoginStartResult> {
  const { response } = await client().opaqueLoginStart({
    principal,
    credentialRequest,
  });
  return { ...response, loginId: required(OpaqueLoginId, response.loginId) };
}

export type LoginFinishResult = WithId<
  OpaqueLoginFinishResponse,
  "sessionId",
  SessionId
> & { pending: PendingSignIn | null };

/**
 * Finish the login `loginId` (from its start) with the client's KE3.
 * `pending` is the second factor the sign-in still owes, kept for its
 * completion.
 */
export async function opaqueLoginFinish(
  principal: string,
  credentialFinalization: Uint8Array,
  loginId: OpaqueLoginId,
): Promise<LoginFinishResult> {
  const { response } = await client().opaqueLoginFinish({
    principal,
    credentialFinalization,
    loginId: loginId.toWire(),
  });
  return {
    ...response,
    sessionId: required(SessionId, response.sessionId),
    pending: holdPendingSignIn(response),
  };
}

// Re-export types for convenience
export { StepUpMethod };
export type {
  OpaqueLoginStartResponse,
  OpaqueLoginFinishResponse,
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
  PasswordHistoryContext,
  PasswordHistoryEvaluation,
  PasswordRegistrationProof,
};
