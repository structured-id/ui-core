import { defineStore } from "pinia";
import { ref } from "vue";
import { EnrollmentServiceClient } from "@structured-id/proto/sid/v1/admin/enrollment.client";
import {
  EnrollmentMode,
  EnrollmentPolicy,
  InviteStatus,
  RegistrationSourceType,
  type Invite,
  type InviteConfig,
  type RegistrationStats,
} from "@structured-id/proto/sid/v1/admin/enrollment";
import { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import { Empty } from "@structured-id/proto/google/protobuf/empty";
import { getAccountTransport } from "@structured-id/ui-core";
import type { InviteId } from "@structured-id/ids";
import { names } from "#admin/ids";

export { EnrollmentMode, InviteStatus, RegistrationSourceType };
export type { Invite, InviteConfig, RegistrationStats };

function getClient() {
  return new EnrollmentServiceClient(getAccountTransport());
}

/** The policy an administrator edits: the stored policy's own fields. */
export interface PolicyEdit {
  mode: EnrollmentMode;
  /** Kept in every mode; the installation refuses a policy without it. */
  invite: InviteConfig;
  allowedDomains: string[];
  trackSource: boolean;
}

/** How a new invite is limited, as the administrator set it in the form. */
export interface InviteLimits {
  /** Uses allowed; 0 is no limit. */
  maxUses: number;
  /** When it expires; none follows the policy's default expiry. */
  expiresAt: Date | null;
}

/**
 * The request fields for `limits`: no use limit is `unlimited_uses`, since a
 * zero `max_uses` means the policy's default count.
 */
function limitFields(limits: InviteLimits) {
  return {
    maxUses: limits.maxUses,
    unlimitedUses: limits.maxUses === 0,
    expiresAt: limits.expiresAt
      ? Timestamp.fromDate(limits.expiresAt)
      : undefined,
    neverExpires: false,
  };
}

// ── Label / Color / Icon helpers ──

const ENROLLMENT_MODE_LABELS: Record<EnrollmentMode, string> = {
  [EnrollmentMode.UNSPECIFIED]: "Unspecified",
  [EnrollmentMode.OPEN]: "Open",
  [EnrollmentMode.INVITE_ONLY]: "Invite Only",
  [EnrollmentMode.ADMIN_ONLY]: "Admin Only",
  [EnrollmentMode.DOMAIN_RESTRICTED]: "Domain Restricted",
};

const ENROLLMENT_MODE_COLORS: Record<EnrollmentMode, string> = {
  [EnrollmentMode.UNSPECIFIED]: "grey",
  [EnrollmentMode.OPEN]: "positive",
  [EnrollmentMode.INVITE_ONLY]: "info",
  [EnrollmentMode.ADMIN_ONLY]: "negative",
  [EnrollmentMode.DOMAIN_RESTRICTED]: "warning",
};

const ENROLLMENT_MODE_ICONS: Record<EnrollmentMode, string> = {
  [EnrollmentMode.UNSPECIFIED]: "sym_o_help",
  [EnrollmentMode.OPEN]: "sym_o_public",
  [EnrollmentMode.INVITE_ONLY]: "sym_o_mail",
  [EnrollmentMode.ADMIN_ONLY]: "sym_o_admin_panel_settings",
  [EnrollmentMode.DOMAIN_RESTRICTED]: "sym_o_domain",
};

const ENROLLMENT_MODE_DESCRIPTIONS: Record<EnrollmentMode, string> = {
  [EnrollmentMode.UNSPECIFIED]: "",
  [EnrollmentMode.OPEN]:
    "Anyone can register. No restrictions on self-registration.",
  [EnrollmentMode.INVITE_ONLY]:
    "Registration requires a valid invite code from an admin.",
  [EnrollmentMode.ADMIN_ONLY]:
    "Only administrators can create profiles. Self-registration is disabled.",
  [EnrollmentMode.DOMAIN_RESTRICTED]:
    "Only users with email in allowed domains can self-register.",
};

const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  [InviteStatus.UNSPECIFIED]: "Unknown",
  [InviteStatus.ACTIVE]: "Active",
  [InviteStatus.CONSUMED]: "Consumed",
  [InviteStatus.REVOKED]: "Revoked",
  [InviteStatus.EXPIRED]: "Expired",
};

const INVITE_STATUS_COLORS: Record<InviteStatus, string> = {
  [InviteStatus.UNSPECIFIED]: "grey",
  [InviteStatus.ACTIVE]: "positive",
  [InviteStatus.CONSUMED]: "info",
  [InviteStatus.REVOKED]: "negative",
  [InviteStatus.EXPIRED]: "warning",
};

const SOURCE_TYPE_LABELS: Record<RegistrationSourceType, string> = {
  [RegistrationSourceType.UNSPECIFIED]: "Unknown",
  [RegistrationSourceType.SELF_SIGNUP]: "Self-signup",
  [RegistrationSourceType.INVITE]: "Invite",
  [RegistrationSourceType.ADMIN_CREATED]: "Admin created",
  [RegistrationSourceType.SCIM_PROVISIONED]: "SCIM",
  [RegistrationSourceType.FEDERATION]: "Federation",
  [RegistrationSourceType.IDENTITY_BROKERED]: "Identity broker",
};

const SOURCE_TYPE_COLORS: Record<RegistrationSourceType, string> = {
  [RegistrationSourceType.UNSPECIFIED]: "grey",
  [RegistrationSourceType.SELF_SIGNUP]: "primary",
  [RegistrationSourceType.INVITE]: "info",
  [RegistrationSourceType.ADMIN_CREATED]: "accent",
  [RegistrationSourceType.SCIM_PROVISIONED]: "teal",
  [RegistrationSourceType.FEDERATION]: "deep-purple",
  [RegistrationSourceType.IDENTITY_BROKERED]: "indigo",
};

export function enrollmentModeLabel(mode: EnrollmentMode): string {
  return ENROLLMENT_MODE_LABELS[mode] ?? "Unknown";
}

export function enrollmentModeColor(mode: EnrollmentMode): string {
  return ENROLLMENT_MODE_COLORS[mode] ?? "grey";
}

export function enrollmentModeIcon(mode: EnrollmentMode): string {
  return ENROLLMENT_MODE_ICONS[mode] ?? "sym_o_help";
}

export function enrollmentModeDescription(mode: EnrollmentMode): string {
  return ENROLLMENT_MODE_DESCRIPTIONS[mode] ?? "";
}

export function inviteStatusLabel(status: InviteStatus): string {
  return INVITE_STATUS_LABELS[status] ?? "Unknown";
}

export function inviteStatusColor(status: InviteStatus): string {
  return INVITE_STATUS_COLORS[status] ?? "grey";
}

export function sourceTypeLabel(type: RegistrationSourceType): string {
  return SOURCE_TYPE_LABELS[type] ?? "Unknown";
}

export function sourceTypeColor(type: RegistrationSourceType): string {
  return SOURCE_TYPE_COLORS[type] ?? "grey";
}

/** The message of a failed call, or `fallback`. */
function message(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// ── Store ──

export const useEnrollmentStore = defineStore("enrollment", () => {
  const policy = ref<EnrollmentPolicy | null>(null);
  const invites = ref<Invite[]>([]);
  const invitesTotalCount = ref(0);
  const stats = ref<RegistrationStats | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ── Enrollment Policy ──

  async function fetchPolicy() {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getEnrollmentPolicy(
        Empty.create(),
      );
      policy.value = response;
    } catch (err) {
      error.value = message(err, "Failed to load enrollment policy");
    } finally {
      loading.value = false;
    }
  }

  async function updatePolicy(edit: PolicyEdit) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().updateEnrollmentPolicy({
        policy: EnrollmentPolicy.create(edit),
      });
      policy.value = response;
    } catch (err) {
      error.value = message(err, "Failed to update enrollment policy");
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Invites ──

  async function fetchInvites(status?: InviteStatus, search?: string) {
    loading.value = true;
    error.value = null;
    try {
      // Every matching invite, page by page: the table pages locally and an
      // invite past the first page must still be revocable.
      const client = getClient();
      const all: Invite[] = [];
      let pageToken = "";
      let total = 0;
      do {
        const { response } = await client.listInvites({
          pageSize: 100,
          pageToken,
          status: status ?? InviteStatus.UNSPECIFIED,
          search: search ?? "",
        });
        all.push(...response.invites);
        total = response.totalCount;
        pageToken = response.nextPageToken;
      } while (pageToken);
      invites.value = all;
      invitesTotalCount.value = total;
    } catch (err) {
      error.value = message(err, "Failed to load invites");
    } finally {
      loading.value = false;
    }
  }

  async function createInvite(
    limits: InviteLimits,
    metadata: Record<string, string>,
  ): Promise<Invite | null> {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().createInvite({
        ...limitFields(limits),
        metadata,
      });
      invites.value.unshift(response);
      invitesTotalCount.value += 1;
      return response;
    } catch (err) {
      error.value = message(err, "Failed to create invite");
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function revokeInvite(inviteId: InviteId) {
    loading.value = true;
    error.value = null;
    try {
      await getClient().revokeInvite({ inviteId: inviteId.toWire() });
      const idx = invites.value.findIndex((i) => names(i.id, inviteId));
      if (idx !== -1) {
        invites.value[idx] = {
          ...invites.value[idx],
          active: false,
          status: InviteStatus.REVOKED,
        };
      }
    } catch (err) {
      error.value = message(err, "Failed to revoke invite");
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function bulkCreateInvites(
    count: number,
    limits: InviteLimits,
    metadata: Record<string, string>,
  ): Promise<Invite[]> {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().bulkCreateInvites({
        count,
        ...limitFields(limits),
        metadata,
      });
      invites.value.unshift(...response.invites);
      invitesTotalCount.value += response.invites.length;
      return response.invites;
    } catch (err) {
      error.value = message(err, "Failed to bulk create invites");
      return [];
    } finally {
      loading.value = false;
    }
  }

  // ── Registration Stats ──

  async function fetchRegistrationStats(periodDays = 30) {
    loading.value = true;
    error.value = null;
    try {
      const { response } = await getClient().getRegistrationStats({
        periodDays,
      });
      stats.value = response;
    } catch (err) {
      error.value = message(err, "Failed to load registration stats");
    } finally {
      loading.value = false;
    }
  }

  return {
    policy,
    invites,
    invitesTotalCount,
    stats,
    loading,
    error,
    fetchPolicy,
    updatePolicy,
    fetchInvites,
    createInvite,
    revokeInvite,
    bulkCreateInvites,
    fetchRegistrationStats,
  };
});
