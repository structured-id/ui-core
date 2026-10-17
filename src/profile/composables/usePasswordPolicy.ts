/**
 * The server's password policy, as a form checks a new password against it.
 * The proof enforces the policy; these checks only tell the user early.
 */
import { readonly, ref } from "vue";
import type { GetZkppPolicyResponse } from "@structured-id/proto/sid/v1/authn/auth";
import { getPasswordPolicy } from "./useAuthApi";

/** The minimums of a password policy. */
export type PasswordPolicy = Pick<
  GetZkppPolicyResponse,
  "minLength" | "minUppercase" | "minLowercase" | "minDigit" | "minSymbol"
>;

/** A minimum a password can fail. */
export type PasswordRule =
  "length" | "uppercase" | "lowercase" | "digit" | "symbol";

/** What a failed rule says, given the policy's number for it. */
export type PasswordRuleText = (rule: PasswordRule, count: number) => string;

export const defaultPasswordRuleText: PasswordRuleText = (rule, count) => {
  switch (rule) {
    case "length":
      return `At least ${count} characters`;
    case "uppercase":
      return `At least ${count} uppercase ${count === 1 ? "letter" : "letters"}`;
    case "lowercase":
      return `At least ${count} lowercase ${count === 1 ? "letter" : "letters"}`;
    case "digit":
      return `At least ${count} ${count === 1 ? "digit" : "digits"}`;
    case "symbol":
      return `At least ${count} ${count === 1 ? "symbol" : "symbols"}`;
  }
};

// The character classes the proof counts: ASCII letters and digits, and the
// printable ASCII characters that are neither (a space is not a symbol).
const UPPERCASE = /[A-Z]/g;
const LOWERCASE = /[a-z]/g;
const DIGIT = /[0-9]/g;
const SYMBOL = /[!-/:-@[-`{-~]/g;

const count = (value: string, pattern: RegExp) =>
  value.match(pattern)?.length ?? 0;

/**
 * The first minimum `password` fails, or null when it meets them all. Length
 * is counted in characters: the proof counts UTF-8 bytes, never fewer, so a
 * password that passes here is never refused there for its length.
 */
export function failedPasswordRule(
  password: string,
  policy: PasswordPolicy,
): { rule: PasswordRule; count: number } | null {
  const checks: [PasswordRule, number, number][] = [
    ["length", [...password].length, policy.minLength],
    ["uppercase", count(password, UPPERCASE), policy.minUppercase],
    ["lowercase", count(password, LOWERCASE), policy.minLowercase],
    ["digit", count(password, DIGIT), policy.minDigit],
    ["symbol", count(password, SYMBOL), policy.minSymbol],
  ];
  for (const [rule, has, needs] of checks) {
    if (has < needs) return { rule, count: needs };
  }
  return null;
}

/**
 * Load the policy once. Until it is known (or when it cannot be loaded)
 * `policy` stays null: the operation itself then meets the server, which
 * refuses a password its policy does not admit.
 */
export function usePasswordPolicy(
  load: () => Promise<PasswordPolicy> = getPasswordPolicy,
) {
  const policy = ref<PasswordPolicy | null>(null);
  load().then(
    (p) => (policy.value = p),
    () => undefined,
  );
  return { policy: readonly(policy) };
}
