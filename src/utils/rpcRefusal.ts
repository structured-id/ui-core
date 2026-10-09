/**
 * What a refused gRPC call reports, in the terms the API contract fixes: the
 * status code, the `(domain, reason)` pair of its `google.rpc.ErrorInfo` and
 * the text for people. A page branches on the reason, never on the text.
 */
import { RpcError } from "@protobuf-ts/runtime-rpc";
import { base64decode } from "@protobuf-ts/runtime";
import { Any } from "@structured-id/proto/google/protobuf/any";
import { Status } from "@structured-id/proto/google/rpc/status";
import {
  ErrorInfo,
  LocalizedMessage,
} from "@structured-id/proto/google/rpc/error_details";
import { ErrorReason } from "@structured-id/proto/sid/v1/common/errors";

export interface RpcRefusal {
  /** The gRPC status code's name (`FAILED_PRECONDITION`). */
  code: string;
  /** The domain of the reason (`structured.id`), from `ErrorInfo`; null without one. */
  domain: string | null;
  /** The stable machine reason (`PASSWORD_REUSED`), from `ErrorInfo`; null without one. */
  reason: string | null;
  /** SID's reason as the generated enum; null for another domain or a reason this client does not know. */
  reasonCode: ErrorReason | null;
  /** The reason's context from `ErrorInfo.metadata` (`continuation`, …); empty without one. */
  metadata: Record<string, string>;
  /** The status message, written for developers; gRPC percent-encodes it on the wire. */
  message: string;
  /** The server's text for people (`LocalizedMessage`), when it sent one. */
  localized: string | null;
}

/**
 * The domain of SID's reasons, the same for every installation (AIP-193: a
 * reason is defined only within its domain).
 */
export const SID_ERROR_DOMAIN = "structured.id";

/** The trailer that carries the serialized `google.rpc.Status`, base64 like every binary metadata. */
const DETAILS_KEY = "grpc-status-details-bin";

/** The refusal behind `err`, or null when `err` is not a refused call. */
export function rpcRefusal(err: unknown): RpcRefusal | null {
  if (!(err instanceof RpcError)) return null;
  const refusal: RpcRefusal = {
    code: err.code,
    domain: null,
    reason: null,
    reasonCode: null,
    metadata: {},
    message: decodeStatusMessage(err.message),
    localized: null,
  };
  for (const detail of statusDetails(err.meta[DETAILS_KEY])) {
    if (Any.contains(detail, ErrorInfo)) {
      const info = Any.unpack(detail, ErrorInfo);
      refusal.domain = info.domain;
      refusal.reason = info.reason;
      refusal.metadata = info.metadata;
      refusal.reasonCode =
        info.domain === SID_ERROR_DOMAIN ? sidReason(info.reason) : null;
    } else if (Any.contains(detail, LocalizedMessage)) {
      refusal.localized = Any.unpack(detail, LocalizedMessage).message;
    }
  }
  return refusal;
}

/**
 * The stable reason of a refused call in `domain` (SID's by default); null for
 * any other error or a reason of another domain.
 */
export function rpcReason(
  err: unknown,
  domain: string = SID_ERROR_DOMAIN,
): string | null {
  const refusal = rpcRefusal(err);
  return refusal?.domain === domain ? refusal.reason : null;
}

/**
 * What each of SID's reasons means to the user who made the call. The
 * status message is written for developers and is never shown; a reason
 * added to the proto without a text here fails the type check.
 */
export const REFUSAL_TEXTS: Readonly<
  Record<Exclude<ErrorReason, ErrorReason.ERROR_REASON_UNSPECIFIED>, string>
> = {
  [ErrorReason.PROFILE_NOT_FOUND]: "This account does not exist.",
  [ErrorReason.APPLICATION_NOT_FOUND]: "This application does not exist.",
  [ErrorReason.SESSION_NOT_FOUND]: "This session has ended.",
  [ErrorReason.CREDENTIAL_NOT_FOUND]: "This credential does not exist.",
  [ErrorReason.ROLE_NOT_FOUND]: "This role does not exist.",
  [ErrorReason.PROJECT_NOT_FOUND]: "This project does not exist.",
  [ErrorReason.OIDC_ISSUER_NOT_FOUND]: "This issuer does not exist.",
  [ErrorReason.RESOURCE_NOT_FOUND]: "This protected resource does not exist.",
  [ErrorReason.FORWARD_AUTH_APPLICATION_NOT_FOUND]:
    "No protected application is configured for this address.",
  [ErrorReason.INITIAL_ACCESS_TOKEN_NOT_FOUND]:
    "This initial access token does not exist.",
  [ErrorReason.UPSTREAM_PROVIDER_NOT_FOUND]:
    "This identity provider does not exist.",
  [ErrorReason.MACHINE_USER_NOT_FOUND]: "This service account does not exist.",
  [ErrorReason.CONSENT_NOT_FOUND]: "You have not given consent to this site.",
  [ErrorReason.PHONE_NOT_FOUND]: "This phone number is not on your account.",
  [ErrorReason.EMAIL_NOT_FOUND]: "This email address is not on your account.",
  [ErrorReason.DEVICE_NOT_FOUND]: "This device does not exist.",
  [ErrorReason.AUTHENTICATION_FAILED]: "Sign-in failed.",
  [ErrorReason.TOKEN_EXPIRED]: "Your session has expired; sign in again.",
  [ErrorReason.TOKEN_INVALID]: "Your session is not valid; sign in again.",
  [ErrorReason.INSUFFICIENT_PERMISSIONS]:
    "You do not have permission to do this.",
  [ErrorReason.SCOPE_NOT_GRANTED]: "This access was not granted.",
  [ErrorReason.SIGN_IN_REFUSED]: "Sign-in is not allowed here.",
  [ErrorReason.REGISTRATION_RESTRICTED]:
    "Registration is restricted on this site.",
  [ErrorReason.PROFILE_ALREADY_EXISTS]: "This account already exists.",
  [ErrorReason.EMAIL_ALREADY_REGISTERED]:
    "This email address is already registered.",
  [ErrorReason.USERNAME_ALREADY_TAKEN]: "This username is taken.",
  [ErrorReason.OPERATION_KEY_CONFLICT]:
    "This request conflicts with an earlier one; start it again.",
  [ErrorReason.APPLICATION_ROLE_EXISTS]:
    "The application already has a role of this kind.",
  [ErrorReason.RESOURCE_INDICATOR_TAKEN]:
    "This resource indicator is already in use.",
  [ErrorReason.PHONE_ALREADY_REGISTERED]:
    "This phone number is already registered.",
  [ErrorReason.ROLE_ALREADY_EXISTS]:
    "A role with this key or name already exists.",
  [ErrorReason.UPSTREAM_PROVIDER_ALREADY_EXISTS]:
    "An identity provider with this name already exists.",
  [ErrorReason.PRINCIPAL_ALREADY_HELD]:
    "This sign-in handle belongs to another account.",
  [ErrorReason.INVALID_FIELD_VALUE]: "Some of the values are not valid.",
  [ErrorReason.REQUIRED_FIELD_MISSING]: "A required value is missing.",
  [ErrorReason.PASSWORD_PROOF_INVALID]:
    "The password could not be proven to the server; try again.",
  [ErrorReason.MFA_REQUIRED]: "Set up a second factor first.",
  [ErrorReason.ACCOUNT_SUSPENDED]: "This account is suspended.",
  [ErrorReason.ACCOUNT_LOCKED]:
    "This account is locked after too many attempts; try again later.",
  [ErrorReason.CONSENT_REQUIRED]: "Your consent is required first.",
  [ErrorReason.CREDENTIAL_REVOKED]: "This credential was revoked.",
  [ErrorReason.ACCOUNT_CLOSED]: "This account is closed.",
  [ErrorReason.OPERATION_RESULT_UNAVAILABLE]:
    "This operation completed, but its result is no longer available.",
  [ErrorReason.OPERATION_EXPIRED]: "This request has expired; start it again.",
  [ErrorReason.RESOURCE_RETIRED]: "This protected resource is retired.",
  [ErrorReason.ISSUER_MISMATCH]:
    "The application and the resource belong to different issuers.",
  [ErrorReason.SYSTEM_INTEGRATION_UNAVAILABLE]:
    "The installation's own integration is not available.",
  [ErrorReason.SYSTEM_MANAGED]:
    "This is managed by the installation and cannot be changed by hand.",
  [ErrorReason.PASSWORD_REUSED]:
    "This password was used on this account before; choose another.",
  [ErrorReason.STEP_UP_REQUIRED]: "Confirm your identity again to continue.",
  [ErrorReason.CAPTCHA_REQUIRED]: "Complete the challenge to continue.",
  [ErrorReason.LEGACY_MIGRATION_REQUIRED]:
    "Your password needs to be updated before you continue.",
  [ErrorReason.INVALID_STATE]: "This cannot be done in its current state.",
  [ErrorReason.FEATURE_NOT_CONFIGURED]:
    "This feature is not configured; an administrator can enable it.",
  [ErrorReason.RATE_LIMIT_EXCEEDED]: "Too many attempts; try again later.",
  [ErrorReason.QUOTA_EXCEEDED]: "A limit is reached; remove something first.",
  [ErrorReason.CONCURRENT_MODIFICATION]:
    "This was changed by someone else; reload and try again.",
  [ErrorReason.OPERATION_IN_PROGRESS]:
    "This operation is still running; try again shortly.",
  [ErrorReason.PASSWORD_HISTORY_UNAVAILABLE]:
    "The password history cannot be checked right now; try again later.",
  [ErrorReason.SERVICE_MAINTENANCE]:
    "The service is in maintenance; try again later.",
  [ErrorReason.DEPENDENCY_UNAVAILABLE]:
    "The service is temporarily unavailable; try again later.",
  [ErrorReason.PRINCIPAL_NOT_FOUND]:
    "This sign-in handle is not on your account.",
  [ErrorReason.EXPORT_NOT_FOUND]: "There is no data export for your account.",
  [ErrorReason.CLOSURE_REQUEST_NOT_FOUND]:
    "There is no closure request to cancel.",
  [ErrorReason.GROUP_NOT_FOUND]: "This group does not exist.",
  [ErrorReason.POLICY_NOT_FOUND]: "This policy does not exist.",
  [ErrorReason.ACCESS_REQUEST_NOT_FOUND]: "This access request does not exist.",
  [ErrorReason.TEMPLATE_NOT_FOUND]: "This template does not exist.",
  [ErrorReason.ATTESTATION_NOT_FOUND]: "This device has no registered key.",
  [ErrorReason.PROFILE_METADATA_NOT_FOUND]:
    "This metadata entry does not exist.",
  [ErrorReason.BRANDING_NOT_FOUND]: "This branding does not exist.",
  [ErrorReason.FLOW_CONFIG_NOT_FOUND]: "This flow has no saved configuration.",
  [ErrorReason.FLOW_ACTION_NOT_FOUND]: "This flow action does not exist.",
  [ErrorReason.INVITE_NOT_FOUND]: "This invite does not exist.",
  [ErrorReason.ORGANIZATION_NOT_FOUND]:
    "This organization does not exist or you are not a member.",
  [ErrorReason.PROVISIONING_CONNECTOR_NOT_FOUND]:
    "This provisioning connector does not exist.",
  [ErrorReason.GROUP_ALREADY_EXISTS]: "A group with this name already exists.",
  [ErrorReason.POLICY_ALREADY_EXISTS]:
    "A policy with this name already exists.",
  [ErrorReason.ATTESTATION_ALREADY_EXISTS]:
    "This device already has a registered key; rotate it instead.",
  [ErrorReason.OPERATION_OUTCOME_UNKNOWN]:
    "The outcome is not known yet; try the same request again.",
  [ErrorReason.FEATURE_NOT_AVAILABLE]:
    "This feature is not part of this edition.",
  [ErrorReason.INTERNAL_ERROR]: "Something went wrong on the server.",
};

/**
 * The text to show for a failed call: the server's text for people, else the
 * client's text for SID's reason, else `fallback`, the caller's context. A
 * client-side `Error` (no call refused) keeps its own message.
 */
export function refusalMessage(
  err: unknown,
  fallback = "Request failed",
): string {
  const refusal = rpcRefusal(err);
  if (refusal) {
    if (refusal.localized) return refusal.localized;
    if (
      refusal.reasonCode !== null &&
      refusal.reasonCode !== ErrorReason.ERROR_REASON_UNSPECIFIED
    ) {
      return REFUSAL_TEXTS[refusal.reasonCode];
    }
    return fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

/** The generated member named `reason`; null for a name this client does not know. */
function sidReason(reason: string): ErrorReason | null {
  const code = (ErrorReason as unknown as Record<string, unknown>)[reason];
  return typeof code === "number" ? (code as ErrorReason) : null;
}

/** The transport hands the status message over as the wire carries it: percent-encoded. */
function decodeStatusMessage(message: string): string {
  try {
    return decodeURIComponent(message);
  } catch {
    return message;
  }
}

/** The details of the status in the trailer; none when the trailer is missing or unreadable. */
function statusDetails(value: string | string[] | undefined): Any[] {
  const encoded = Array.isArray(value) ? value[0] : value;
  if (!encoded) return [];
  try {
    return Status.fromBinary(base64decode(encoded)).details;
  } catch {
    return [];
  }
}
