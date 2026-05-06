/**
 * Profile account API composable.
 *
 * Wraps AccountServiceClient proto calls with Bearer auth.
 * Covers: consents, activity, linked accounts, app launcher, passwordless.
 */
import {
  getTransport,
  AccountServiceClient,
  type ConsentInfo,
  type ClaimConsent,
  type GetConsentDetailResponse,
  type ActivityEvent,
  type ListActivityEventsResponse,
  type LinkedAccount,
  type ListLinkedAccountsResponse,
  type LinkAccountResponse,
  type ReauthenticateLinkResponse,
  type AvailableApp,
  type LaunchAppResponse,
  type PasswordlessStatus,
  type DisablePasswordlessResponse,
  ConsentStatus,
  ClaimType,
  ClaimConsentStatus,
  ActivityEventStatus,
  LinkedAccountTrustCategory,
  LinkedAccountStatus,
  Timestamp,
} from "../../index";
import { authMeta } from "../auth";

function client(): AccountServiceClient {
  return new AccountServiceClient(getTransport());
}

// ── Consents ──

export type { ConsentInfo, ClaimConsent, GetConsentDetailResponse };

export async function listConsents(): Promise<ConsentInfo[]> {
  const { response } = await client().listConsents({}, { meta: authMeta() });
  return response.consents;
}

export async function getConsentDetail(
  siteId: string,
): Promise<GetConsentDetailResponse> {
  const { response } = await client().getConsentDetail(
    { siteId },
    { meta: authMeta() },
  );
  return response;
}

export async function updateClaimConsent(
  siteId: string,
  claimName: string,
  grant: boolean,
): Promise<void> {
  await client().updateClaimConsent(
    { siteId, claimName, grant },
    { meta: authMeta() },
  );
}

export async function disconnectSite(siteId: string): Promise<void> {
  await client().disconnectSite({ siteId }, { meta: authMeta() });
}

// ── Activity ──

export type { ActivityEvent, ListActivityEventsResponse };

export interface ActivityFilters {
  eventTypes?: string[];
  applicationId?: string;
  statusFilter?: ActivityEventStatus;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  pageSize?: number;
  pageToken?: string;
}

export async function listActivityEvents(
  filters: ActivityFilters = {},
): Promise<ListActivityEventsResponse> {
  const { response } = await client().listActivityEvents(
    {
      eventTypes: filters.eventTypes ?? [],
      applicationId: filters.applicationId,
      statusFilter: filters.statusFilter,
      dateFrom: filters.dateFrom
        ? Timestamp.fromDate(filters.dateFrom)
        : undefined,
      dateTo: filters.dateTo ? Timestamp.fromDate(filters.dateTo) : undefined,
      search: filters.search,
      pageSize: filters.pageSize ?? 20,
      pageToken: filters.pageToken ?? "",
    },
    { meta: authMeta() },
  );
  return response;
}

export async function getActivityEventDetail(
  eventId: string,
): Promise<ActivityEvent> {
  const { response } = await client().getActivityEventDetail(
    { eventId },
    { meta: authMeta() },
  );
  return response;
}

export async function reportSuspiciousEvent(
  eventId: string,
  description?: string,
): Promise<void> {
  await client().reportSuspiciousEvent(
    { eventId, description },
    { meta: authMeta() },
  );
}

// ── Linked Accounts ──

export type { LinkedAccount, ListLinkedAccountsResponse };

export async function listLinkedAccounts(): Promise<ListLinkedAccountsResponse> {
  const { response } = await client().listLinkedAccounts({}, { meta: authMeta() });
  return response;
}

export async function linkAccount(
  providerId: string,
  redirectUri: string,
): Promise<LinkAccountResponse> {
  const { response } = await client().linkAccount(
    { providerId, redirectUri },
    { meta: authMeta() },
  );
  return response;
}

export async function unlinkAccount(linkedAccountId: string): Promise<void> {
  await client().unlinkAccount({ linkedAccountId }, { meta: authMeta() });
}

export async function reauthenticateLink(
  linkedAccountId: string,
  redirectUri: string,
): Promise<ReauthenticateLinkResponse> {
  const { response } = await client().reauthenticateLink(
    { linkedAccountId, redirectUri },
    { meta: authMeta() },
  );
  return response;
}

// ── App Launcher ──

export type { AvailableApp, PasswordlessStatus, DisablePasswordlessResponse };

export async function listAvailableApps(): Promise<AvailableApp[]> {
  const { response } = await client().listAvailableApps({}, { meta: authMeta() });
  return response.apps;
}

export async function launchApp(appId: string): Promise<LaunchAppResponse> {
  const { response } = await client().launchApp({ appId }, { meta: authMeta() });
  return response;
}

// ── Passwordless ──

export async function getPasswordlessStatus(): Promise<PasswordlessStatus> {
  const { response } = await client().getPasswordlessStatus(
    {},
    { meta: authMeta() },
  );
  return response;
}

export async function enablePasswordless(): Promise<void> {
  await client().enablePasswordless({}, { meta: authMeta() });
}

export async function disablePasswordless(): Promise<DisablePasswordlessResponse> {
  const { response } = await client().disablePasswordless({}, { meta: authMeta() });
  return response;
}

// Re-export enums
export {
  ConsentStatus,
  ClaimType,
  ClaimConsentStatus,
  ActivityEventStatus,
  LinkedAccountTrustCategory,
  LinkedAccountStatus,
};
