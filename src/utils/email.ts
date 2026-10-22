import { readonly, ref, type Ref } from "vue";

/**
 * Which mailboxes an email namespace admits, as the server's policy for it
 * (sid_authn::email) does. Equality and the resolution key stay the
 * server's: the field only refuses what the namespace never admits.
 */
export interface EmailPolicy {
  /** Accept non-ASCII characters in the local part (RFC 6531). */
  readonly unicodeLocal: boolean;
  /** Accept internationalized domains, in Unicode or A-label spelling. */
  readonly idnDomain: boolean;
  /** Accept a domain without a dot (an installation-local mail domain). */
  readonly singleLabelDomain: boolean;
  /** Require the domain to end in a Public Suffix List suffix. */
  readonly publicSuffix: boolean;
}

/** The global SaaS/federated Personal namespace: ASCII, no IDN, a public mail domain. */
export const GLOBAL_PERSONAL: EmailPolicy = Object.freeze({
  unicodeLocal: false,
  idnDomain: false,
  singleLabelDomain: false,
  publicSuffix: true,
});

/** An organization's Corporate namespace before it sets its own rules. */
export const CORPORATE_BASELINE: EmailPolicy = Object.freeze({
  unicodeLocal: false,
  idnDomain: false,
  singleLabelDomain: true,
  publicSuffix: false,
});

/** An installation's own managed accounts (standalone). */
export const LOCAL: EmailPolicy = Object.freeze({
  unicodeLocal: true,
  idnDomain: true,
  singleLabelDomain: true,
  publicSuffix: false,
});

/** A verdict on one input; `pending` until the parser is loaded. */
export type EmailCheck = "valid" | "invalid" | "pending";

type Parser = typeof import("@structured-world/structured-email-address-wasm");

let parser: Parser | undefined;
let loading: Promise<Parser> | undefined;
let appPolicy: EmailPolicy = LOCAL;
const loaded = ref(false);

/** Whether the parser is loaded; a rule depending on it re-runs when it is. */
export const emailReady: Readonly<Ref<boolean>> = readonly(loaded);

/**
 * Load the parser (once) and set the application's email namespace, LOCAL
 * unless named. The parser is the server's own (WebAssembly, the Public
 * Suffix List embedded), so no network is involved and its verdict is the
 * server's. An application calls this at start; a field starts it when
 * nobody did.
 */
export async function initEmail(options?: {
  policy?: EmailPolicy;
}): Promise<void> {
  if (options?.policy) appPolicy = options.policy;
  loading ??= import("@structured-world/structured-email-address-wasm").then(
    async (module) => {
      await module.init();
      return module;
    },
  );
  try {
    parser = await loading;
  } catch (error) {
    // A failed load is retried by the next call, never cached as loaded.
    loading = undefined;
    throw error;
  }
  loaded.value = true;
}

/** The application's email namespace. */
export function emailPolicy(): EmailPolicy {
  return appPolicy;
}

/** Whether a domain label is an IDNA A-label (`xn--`). */
function isALabel(label: string): boolean {
  return label.slice(0, 4).toLowerCase() === "xn--";
}

/**
 * Whether `value` is one mailbox the namespace admits: an RFC 5321 mailbox
 * (dot-atom or quoted local part; no comments, display name or address
 * literal) under the namespace's character, domain and suffix rules, with a
 * local part that its equality rules (case, dots, `+tag`) do not empty.
 */
export function checkEmail(
  value: string,
  policy: EmailPolicy = appPolicy,
): EmailCheck {
  if (!parser) return "pending";
  if (
    !policy.unicodeLocal &&
    !policy.idnDomain &&
    !/^[\x00-\x7f]*$/.test(value)
  ) {
    return "invalid";
  }
  let local: string;
  let domain: string;
  try {
    const mailbox = parser.parse(value, {
      strictness: "strict",
      allowQuotedLocalPart: true,
      casePolicy: "preserve",
      dotPolicy: "preserve",
      subaddress: "preserve",
      allowSingleLabelDomain: policy.singleLabelDomain,
      domainCheck: policy.publicSuffix ? "psl" : "syntax",
    });
    local = mailbox.localPart;
    domain = mailbox.domain;
  } catch {
    return "invalid";
  }
  if (!policy.unicodeLocal && !/^[\x00-\x7f]*$/.test(local)) return "invalid";
  // A Unicode domain arrives IDNA-encoded, so A-labels cover both spellings.
  if (!policy.idnDomain && domain.split(".").some(isALabel)) return "invalid";
  const base = local.toLowerCase().split("+", 1)[0] ?? "";
  if (base.replaceAll(".", "") === "") return "invalid";
  return "valid";
}

/** {@link checkEmail} as a yes/no; `false` while the parser is loading. */
export function isValidEmail(
  value: string,
  policy: EmailPolicy = appPolicy,
): boolean {
  return checkEmail(value, policy) === "valid";
}
