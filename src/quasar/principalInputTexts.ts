/** The principal types and texts of `SidPrincipalInput`. */

export type PrincipalType = "email" | "phone" | "username" | "unknown";

/** A principal type a field can accept. */
export type AcceptedPrincipalType = Exclude<PrincipalType, "unknown">;

/** Every type, in the order the label and the texts name them. */
export const ALL_PRINCIPAL_TYPES: readonly AcceptedPrincipalType[] = [
  "email",
  "phone",
  "username",
];

/** What the field says; each text can be replaced (translated) by the form. */
export interface PrincipalInputTexts {
  /**
   * The label naming one type: the field's only accepted type, or the type
   * the input of a several-type field was recognized as.
   */
  label: (types: AcceptedPrincipalType[]) => string;
  /** The label of a field of several types before its input shows which. */
  login: string;
  /** A value of a type the field does not accept, or of no type at all. */
  enterAccepted: (types: AcceptedPrincipalType[]) => string;
  /** The chip naming the type the value was recognized as. */
  typeChip: (type: AcceptedPrincipalType) => string;
  /** The login form's default subtitle for the accepted types. */
  loginSubtitle: (types: AcceptedPrincipalType[]) => string;
  invalidEmail: string;
  invalidPhone: string;
  usernameTooShort: (min: number) => string;
  usernameTooLong: (max: number) => string;
  usernameUnderscoreEdge: string;
  usernameDoubleUnderscore: string;
}

/** `a`, `a or b`, `a, b, or c`. */
function list(words: string[]): string {
  if (words.length <= 1) return words.join("");
  if (words.length === 2) return `${words[0]} or ${words[1]}`;
  return `${words.slice(0, -1).join(", ")}, or ${words[words.length - 1]}`;
}

const LABEL_WORDS: Record<AcceptedPrincipalType, string> = {
  email: "email",
  phone: "phone",
  username: "username",
};

const ENTER_WORDS: Record<AcceptedPrincipalType, string> = {
  email: "an email address",
  phone: "a phone number (+...)",
  username: "a username",
};

export const DEFAULT_PRINCIPAL_INPUT_TEXTS: PrincipalInputTexts = {
  label: (types) => {
    const text = list(types.map((t) => LABEL_WORDS[t]));
    return text.charAt(0).toUpperCase() + text.slice(1);
  },
  login: "Login",
  enterAccepted: (types) => `Enter ${list(types.map((t) => ENTER_WORDS[t]))}`,
  typeChip: (type) => LABEL_WORDS[type],
  loginSubtitle: (types) =>
    `Enter your ${list(types.map((t) => LABEL_WORDS[t]))} to continue`,
  invalidEmail: "Invalid email address",
  invalidPhone: "Invalid phone number",
  usernameTooShort: (min) => `A username has at least ${min} characters`,
  usernameTooLong: (max) => `A username has at most ${max} characters`,
  usernameUnderscoreEdge: "A username cannot start or end with an underscore",
  usernameDoubleUnderscore:
    "A username cannot contain two underscores in a row",
};
