import { describe, it, expect } from "vitest";
import { ref } from "vue";
import {
  useSecurityLevel,
  SecurityLevel,
  RecoverabilityLevel,
} from "./useSecurityLevel";
import {
  CredentialType,
  AuthenticatorAttachment,
  PrincipalType,
  type Credential,
  type Principal,
} from "../../index";
import { PrincipalSubjectType } from "../../generated/sid/v1/identity/identity";

// ── Helpers ──

function makeCred(
  type: CredentialType,
  opts?: { attachment?: AuthenticatorAttachment; backupState?: boolean },
): Credential {
  const cred: Credential = {
    id: "cred-1",
    profileId: "",
    type,
    data: new Uint8Array(),
    info: { oneofKind: undefined },
  };
  if (type === CredentialType.WEBAUTHN) {
    cred.info = {
      oneofKind: "webauthnInfo",
      webauthnInfo: {
        attachment: opts?.attachment ?? AuthenticatorAttachment.PLATFORM,
        backupState: opts?.backupState ?? false,
        backupEligible: false,
        userVerified: true,
        transports: [],
        attestationFormat: "",
      },
    };
  }
  return cred;
}

function makePrincipal(type: PrincipalType, verified: boolean): Principal {
  return {
    id: "p-1",
    type,
    value: "test",
    verified,
    isPrimary: false,
    subjectType: PrincipalSubjectType.PROFILE,
    subjectId: "",
  };
}

// ── Security Level ──

describe("useSecurityLevel", () => {
  it("MINIMAL with no credentials", () => {
    const { securityLevel } = useSecurityLevel(ref([]), ref([]));
    expect(securityLevel.value).toBe(SecurityLevel.MINIMAL);
  });

  it("MINIMAL with only password", () => {
    const creds = ref([makeCred(CredentialType.OPAQUE)]);
    const { securityLevel, factorCount } = useSecurityLevel(creds, ref([]));
    expect(securityLevel.value).toBe(SecurityLevel.MINIMAL);
    expect(factorCount.value).toBe(1);
  });

  it("BASIC with password + TOTP (2 factors, 2 categories)", () => {
    const creds = ref([
      makeCred(CredentialType.OPAQUE),
      makeCred(CredentialType.TOTP),
    ]);
    const { securityLevel } = useSecurityLevel(creds, ref([]));
    expect(securityLevel.value).toBe(SecurityLevel.STANDARD);
  });

  it("STRONG with 3 factors, 2 categories", () => {
    const creds = ref([
      makeCred(CredentialType.OPAQUE),
      makeCred(CredentialType.TOTP),
      makeCred(CredentialType.WEBAUTHN, {
        attachment: AuthenticatorAttachment.PLATFORM,
      }),
    ]);
    const { securityLevel } = useSecurityLevel(creds, ref([]));
    expect(securityLevel.value).toBe(SecurityLevel.STRONG);
  });

  it("MAXIMUM with 3 factors, 3 categories, hardware key", () => {
    const creds = ref([
      makeCred(CredentialType.OPAQUE), // knowledge
      makeCred(CredentialType.WEBAUTHN, {
        attachment: AuthenticatorAttachment.PLATFORM,
      }), // inherence
      makeCred(CredentialType.WEBAUTHN, {
        attachment: AuthenticatorAttachment.CROSS_PLATFORM,
      }), // possession (hardware)
    ]);
    const { securityLevel } = useSecurityLevel(creds, ref([]));
    expect(securityLevel.value).toBe(SecurityLevel.MAXIMUM);
  });

  it("recovery codes not counted as auth factor", () => {
    const creds = ref([
      makeCred(CredentialType.OPAQUE),
      makeCred(CredentialType.RECOVERY),
    ]);
    const { factorCount } = useSecurityLevel(creds, ref([]));
    expect(factorCount.value).toBe(1); // only password
  });
});

// ── Recoverability ──

describe("recoverability", () => {
  it("NONE with no recovery methods", () => {
    const { recoverabilityLevel } = useSecurityLevel(ref([]), ref([]));
    expect(recoverabilityLevel.value).toBe(RecoverabilityLevel.NONE);
  });

  it("FRAGILE with only recovery codes", () => {
    const creds = ref([makeCred(CredentialType.RECOVERY)]);
    const { recoverabilityLevel } = useSecurityLevel(creds, ref([]));
    expect(recoverabilityLevel.value).toBe(RecoverabilityLevel.FRAGILE);
  });

  it("STANDARD with recovery codes + verified email", () => {
    const creds = ref([makeCred(CredentialType.RECOVERY)]);
    const principals = ref([makePrincipal(PrincipalType.EMAIL, true)]);
    const { recoverabilityLevel } = useSecurityLevel(creds, principals);
    expect(recoverabilityLevel.value).toBe(RecoverabilityLevel.STANDARD);
  });

  it("ROBUST with codes + email + phone", () => {
    const creds = ref([makeCred(CredentialType.RECOVERY)]);
    const principals = ref([
      makePrincipal(PrincipalType.EMAIL, true),
      makePrincipal(PrincipalType.PHONE, true),
    ]);
    const { recoverabilityLevel } = useSecurityLevel(creds, principals);
    expect(recoverabilityLevel.value).toBe(RecoverabilityLevel.ROBUST);
  });

  it("synced passkey counts as recovery method", () => {
    const creds = ref([
      makeCred(CredentialType.WEBAUTHN, {
        attachment: AuthenticatorAttachment.PLATFORM,
        backupState: true,
      }),
    ]);
    const { recoveryMethods } = useSecurityLevel(creds, ref([]));
    expect(recoveryMethods.value).toContain("synced_passkey");
  });

  it("unverified email not counted", () => {
    const principals = ref([makePrincipal(PrincipalType.EMAIL, false)]);
    const { recoveryMethods } = useSecurityLevel(ref([]), principals);
    expect(recoveryMethods.value).not.toContain("recovery_email");
  });
});

// ── Nudges ──

describe("nudges", () => {
  it("suggests recovery setup when no recovery codes", () => {
    const creds = ref([makeCred(CredentialType.OPAQUE)]);
    const { nudges } = useSecurityLevel(creds, ref([]));
    expect(nudges.value.some((n) => n.id === "setup_recovery")).toBe(true);
  });

  it("suggests MFA when only password", () => {
    const creds = ref([makeCred(CredentialType.OPAQUE)]);
    const { nudges } = useSecurityLevel(creds, ref([]));
    expect(nudges.value.some((n) => n.id === "setup_mfa")).toBe(true);
  });

  it("no MFA nudge when passkey exists", () => {
    const creds = ref([
      makeCred(CredentialType.OPAQUE),
      makeCred(CredentialType.WEBAUTHN),
    ]);
    const { nudges } = useSecurityLevel(creds, ref([]));
    expect(nudges.value.some((n) => n.id === "setup_mfa")).toBe(false);
  });

  it("nudges sorted by priority", () => {
    const creds = ref([makeCred(CredentialType.OPAQUE)]);
    const principals = ref([makePrincipal(PrincipalType.EMAIL, false)]);
    const { nudges } = useSecurityLevel(creds, principals);
    const priorities = nudges.value.map((n) => n.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });
});
