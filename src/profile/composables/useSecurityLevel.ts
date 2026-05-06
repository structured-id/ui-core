/**
 * Security level and recoverability assessment composable.
 *
 * Pure computation — no API calls, no auth dependency.
 * Analyzes credentials and principals to determine account security posture.
 */
import { computed, type Ref } from "vue";
import {
  type Credential,
  type Principal,
  CredentialType,
  AuthenticatorAttachment,
  PrincipalType,
} from "../../index";

// ── Security Level ──

export enum SecurityLevel {
  MINIMAL = 1,
  BASIC = 2,
  STANDARD = 3,
  STRONG = 4,
  MAXIMUM = 5,
}

const SECURITY_LEVEL_LABELS: Record<SecurityLevel, string> = {
  [SecurityLevel.MINIMAL]: "Minimal",
  [SecurityLevel.BASIC]: "Basic",
  [SecurityLevel.STANDARD]: "Standard",
  [SecurityLevel.STRONG]: "Strong",
  [SecurityLevel.MAXIMUM]: "Maximum",
};

const SECURITY_LEVEL_COLORS: Record<SecurityLevel, string> = {
  [SecurityLevel.MINIMAL]: "negative",
  [SecurityLevel.BASIC]: "warning",
  [SecurityLevel.STANDARD]: "info",
  [SecurityLevel.STRONG]: "positive",
  [SecurityLevel.MAXIMUM]: "positive",
};

// ── Recoverability Level ──

export enum RecoverabilityLevel {
  NONE = 0,
  FRAGILE = 1,
  STANDARD = 2,
  ROBUST = 3,
}

const RECOVERABILITY_LABELS: Record<RecoverabilityLevel, string> = {
  [RecoverabilityLevel.NONE]: "None",
  [RecoverabilityLevel.FRAGILE]: "Fragile",
  [RecoverabilityLevel.STANDARD]: "Standard",
  [RecoverabilityLevel.ROBUST]: "Robust",
};

const RECOVERABILITY_COLORS: Record<RecoverabilityLevel, string> = {
  [RecoverabilityLevel.NONE]: "negative",
  [RecoverabilityLevel.FRAGILE]: "warning",
  [RecoverabilityLevel.STANDARD]: "info",
  [RecoverabilityLevel.ROBUST]: "positive",
};

// ── Factor Categories ──

export type FactorCategory = "knowledge" | "possession" | "inherence";

function getCategory(cred: Credential): FactorCategory | null {
  switch (cred.type) {
    case CredentialType.OPAQUE:
    case CredentialType.LEGACY_HASH:
      return "knowledge";
    case CredentialType.TOTP:
      return "possession";
    case CredentialType.WEBAUTHN: {
      if (cred.info.oneofKind === "webauthnInfo") {
        return cred.info.webauthnInfo.attachment ===
          AuthenticatorAttachment.PLATFORM
          ? "inherence"
          : "possession";
      }
      return "possession";
    }
    case CredentialType.RECOVERY:
      return null; // recovery codes are not an auth factor
    default:
      return null;
  }
}

function isHardwareKey(cred: Credential): boolean {
  return (
    cred.type === CredentialType.WEBAUTHN &&
    cred.info.oneofKind === "webauthnInfo" &&
    cred.info.webauthnInfo.attachment === AuthenticatorAttachment.CROSS_PLATFORM
  );
}

// ── Action Nudge ──

export interface ActionNudge {
  id: string;
  icon: string;
  label: string;
  description: string;
  color: string;
  priority: number;
  to?: string;
  action?: string;
}

// ── Composable ──

export function useSecurityLevel(
  credentials: Ref<Credential[]>,
  identifiers: Ref<Principal[]>,
) {
  const authFactors = computed(() =>
    credentials.value.filter((c) => c.type !== CredentialType.RECOVERY),
  );

  const factorCount = computed(() => authFactors.value.length);

  const categories = computed(() => {
    const cats = new Set<FactorCategory>();
    for (const cred of authFactors.value) {
      const cat = getCategory(cred);
      if (cat) cats.add(cat);
    }
    return cats;
  });

  const hasHardwareKey = computed(() => authFactors.value.some(isHardwareKey));

  const securityLevel = computed<SecurityLevel>(() => {
    const count = factorCount.value;
    const catCount = categories.value.size;

    if (count >= 3 && catCount >= 3 && hasHardwareKey.value) {
      return SecurityLevel.MAXIMUM;
    }
    if (count >= 3 && catCount >= 2) {
      return SecurityLevel.STRONG;
    }
    if (count >= 2 && catCount >= 2) {
      return SecurityLevel.STANDARD;
    }
    if (count >= 2) {
      return SecurityLevel.BASIC;
    }
    return SecurityLevel.MINIMAL;
  });

  const securityLabel = computed(
    () => SECURITY_LEVEL_LABELS[securityLevel.value],
  );
  const securityColor = computed(
    () => SECURITY_LEVEL_COLORS[securityLevel.value],
  );
  const securityProgress = computed(() => securityLevel.value / 5);

  // ── Recoverability ──

  const recoveryMethods = computed(() => {
    const methods: string[] = [];

    if (credentials.value.some((c) => c.type === CredentialType.RECOVERY)) {
      methods.push("recovery_codes");
    }

    if (
      credentials.value.some(
        (c) =>
          c.type === CredentialType.WEBAUTHN &&
          c.info.oneofKind === "webauthnInfo" &&
          c.info.webauthnInfo.backupState,
      )
    ) {
      methods.push("synced_passkey");
    }

    const emails = identifiers.value.filter(
      (i) => i.type === PrincipalType.EMAIL && i.verified,
    );
    if (emails.length > 0) {
      methods.push("recovery_email");
    }

    const phones = identifiers.value.filter(
      (i) => i.type === PrincipalType.PHONE && i.verified,
    );
    if (phones.length > 0) {
      methods.push("recovery_phone");
    }

    return methods;
  });

  const hasDeviceIndependent = computed(() =>
    recoveryMethods.value.some((m) =>
      ["recovery_codes", "recovery_email", "recovery_phone"].includes(m),
    ),
  );

  const recoverabilityLevel = computed<RecoverabilityLevel>(() => {
    const count = recoveryMethods.value.length;
    if (count >= 3) return RecoverabilityLevel.ROBUST;
    if (count >= 2 && hasDeviceIndependent.value)
      return RecoverabilityLevel.STANDARD;
    if (count >= 1) return RecoverabilityLevel.FRAGILE;
    return RecoverabilityLevel.NONE;
  });

  const recoverabilityLabel = computed(
    () => RECOVERABILITY_LABELS[recoverabilityLevel.value],
  );
  const recoverabilityColor = computed(
    () => RECOVERABILITY_COLORS[recoverabilityLevel.value],
  );
  const recoverabilityProgress = computed(() => recoverabilityLevel.value / 3);

  // ── Action Nudges ──

  const nudges = computed<ActionNudge[]>(() => {
    const items: ActionNudge[] = [];

    const hasPasskey = credentials.value.some(
      (c) => c.type === CredentialType.WEBAUTHN,
    );
    const hasTotp = credentials.value.some(
      (c) => c.type === CredentialType.TOTP,
    );
    const hasRecovery = credentials.value.some(
      (c) => c.type === CredentialType.RECOVERY,
    );
    const verifiedEmails = identifiers.value.filter(
      (i) => i.type === PrincipalType.EMAIL && i.verified,
    );
    const unverifiedEmails = identifiers.value.filter(
      (i) => i.type === PrincipalType.EMAIL && !i.verified,
    );

    if (!hasRecovery) {
      items.push({
        id: "setup_recovery",
        icon: "sym_o_key",
        label: "Set up recovery",
        description:
          "Generate recovery codes to regain access if you lose your credentials",
        color: "negative",
        priority: 1,
        action: "generate_recovery",
      });
    }

    if (!hasPasskey && !hasTotp) {
      items.push({
        id: "setup_mfa",
        icon: "sym_o_shield",
        label: "Enable multi-factor authentication",
        description:
          "Add a second factor to protect your account from unauthorized access",
        color: "warning",
        priority: 2,
        to: "/account/security",
      });
    }

    if (unverifiedEmails.length > 0) {
      items.push({
        id: "verify_email",
        icon: "sym_o_mark_email_read",
        label: "Verify your email",
        description: "Confirm your email address for account recovery",
        color: "warning",
        priority: 3,
        to: "/account/profile",
      });
    }

    if (!hasPasskey) {
      items.push({
        id: "add_passkey",
        icon: "sym_o_passkey",
        label: "Add a passkey",
        description:
          "Passkeys provide phishing-resistant, passwordless sign-in",
        color: "info",
        priority: 4,
        to: "/auth/webauthn-enrollment",
      });
    }

    if (verifiedEmails.length < 2 && unverifiedEmails.length === 0) {
      items.push({
        id: "add_backup_email",
        icon: "sym_o_alternate_email",
        label: "Add a backup email",
        description: "A secondary email helps with account recovery",
        color: "grey",
        priority: 5,
        to: "/account/profile",
      });
    }

    return items.sort((a, b) => a.priority - b.priority);
  });

  return {
    securityLevel,
    securityLabel,
    securityColor,
    securityProgress,
    factorCount,
    categories,
    recoverabilityLevel,
    recoverabilityLabel,
    recoverabilityColor,
    recoverabilityProgress,
    recoveryMethods,
    nudges,
  };
}
