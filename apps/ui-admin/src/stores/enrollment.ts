import { defineStore } from "pinia";
import { ref } from "vue";

// ── Enums (mirrors proto sid.v1.admin enrollment.proto) ──

export enum EnrollmentMode {
  UNSPECIFIED = 0,
  OPEN = 1,
  INVITE_ONLY = 2,
  ADMIN_ONLY = 3,
  DOMAIN_RESTRICTED = 4,
}

export enum RegistrationSourceType {
  UNSPECIFIED = 0,
  SELF_SIGNUP = 1,
  INVITE = 2,
  ADMIN_CREATED = 3,
  SCIM_PROVISIONED = 4,
  FEDERATION = 5,
  IDENTITY_BROKERED = 6,
}

export enum InviteStatus {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  CONSUMED = 2,
  REVOKED = 3,
  EXPIRED = 4,
}

// ── Interfaces ──

export interface InviteConfig {
  defaultMaxUses: number;
  defaultExpiryHours: number;
}

export interface EnrollmentPolicy {
  mode: EnrollmentMode;
  invite: InviteConfig | null;
  allowedDomains: string[];
  trackSource: boolean;
}

export interface Invite {
  id: string;
  code: string;
  createdBy: string;
  createdByName: string;
  metadata: Record<string, string>;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  active: boolean;
  status: InviteStatus;
  createdAt: string;
}

export interface SourceBreakdown {
  sourceType: RegistrationSourceType;
  count: number;
  percentage: number;
}

export interface ReferrerEntry {
  profileId: string;
  displayName: string;
  referralCount: number;
}

export interface RegistrationStats {
  total: number;
  bySource: SourceBreakdown[];
  topReferrers: ReferrerEntry[];
  totalReferrals: number;
  uniqueReferrers: number;
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
      // TODO: connect to gRPC EnrollmentService.GetEnrollmentPolicy
      policy.value = {
        mode: EnrollmentMode.OPEN,
        invite: { defaultMaxUses: 1, defaultExpiryHours: 0 },
        allowedDomains: [],
        trackSource: true,
      };
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load enrollment policy";
    } finally {
      loading.value = false;
    }
  }

  async function updatePolicy(updated: EnrollmentPolicy) {
    loading.value = true;
    error.value = null;
    try {
      // TODO: connect to gRPC EnrollmentService.UpdateEnrollmentPolicy
      policy.value = { ...updated };
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to update enrollment policy";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ── Invites ──

  async function fetchInvites(statusFilter?: InviteStatus, search?: string) {
    loading.value = true;
    error.value = null;
    try {
      // TODO: connect to gRPC EnrollmentService.ListInvites
      invites.value = [];
      invitesTotalCount.value = 0;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load invites";
    } finally {
      loading.value = false;
    }
  }

  async function createInvite(
    maxUses: number,
    expiresAt: string | null,
    metadata: Record<string, string>,
  ): Promise<Invite | null> {
    loading.value = true;
    error.value = null;
    try {
      // TODO: connect to gRPC EnrollmentService.CreateInvite
      const invite: Invite = {
        id: crypto.randomUUID(),
        code: Math.random().toString(36).substring(2, 10).toUpperCase(),
        createdBy: "",
        createdByName: "Admin",
        metadata,
        maxUses,
        useCount: 0,
        expiresAt,
        active: true,
        status: InviteStatus.ACTIVE,
        createdAt: new Date().toISOString(),
      };
      invites.value.unshift(invite);
      return invite;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to create invite";
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function revokeInvite(inviteId: string) {
    loading.value = true;
    error.value = null;
    try {
      // TODO: connect to gRPC EnrollmentService.RevokeInvite
      const idx = invites.value.findIndex((i) => i.id === inviteId);
      if (idx !== -1) {
        invites.value[idx].active = false;
        invites.value[idx].status = InviteStatus.REVOKED;
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to revoke invite";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function bulkCreateInvites(
    count: number,
    maxUses: number,
    expiresAt: string | null,
    metadata: Record<string, string>,
  ): Promise<Invite[]> {
    loading.value = true;
    error.value = null;
    try {
      // TODO: connect to gRPC EnrollmentService.BulkCreateInvites
      const created: Invite[] = [];
      for (let i = 0; i < count; i++) {
        const invite: Invite = {
          id: crypto.randomUUID(),
          code: Math.random().toString(36).substring(2, 10).toUpperCase(),
          createdBy: "",
          createdByName: "Admin",
          metadata,
          maxUses,
          useCount: 0,
          expiresAt,
          active: true,
          status: InviteStatus.ACTIVE,
          createdAt: new Date().toISOString(),
        };
        created.push(invite);
      }
      invites.value.unshift(...created);
      return created;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to bulk create invites";
      return [];
    } finally {
      loading.value = false;
    }
  }

  // ── Registration Stats ──

  async function fetchRegistrationStats(periodDays: number = 30) {
    loading.value = true;
    error.value = null;
    try {
      // TODO: connect to gRPC EnrollmentService.GetRegistrationStats
      stats.value = {
        total: 0,
        bySource: [],
        topReferrers: [],
        totalReferrals: 0,
        uniqueReferrers: 0,
      };
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load registration stats";
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
