/**
 * i18n key constants shared across all SID UI applications.
 *
 * These match the keys defined in sid-i18n Rust crate (locales/*.json).
 * Apps import these constants instead of hardcoding strings,
 * ensuring consistency between frontend and backend translations.
 */

export const AUTH_KEYS = {
  LOGIN_TITLE: "auth.login.title",
  LOGIN_SUBMIT: "auth.login.submit",
  REGISTER_TITLE: "auth.register.title",
  REGISTER_SUBMIT: "auth.register.submit",
  MFA_TITLE: "auth.mfa.title",
  MAGIC_LINK_TITLE: "auth.magic_link.title",
  DEVICE_AUTH_TITLE: "auth.device_auth.title",
  PASSWORD_RESET_TITLE: "auth.password_reset.title",
  LOGOUT_TITLE: "auth.logout.title",
  LOGOUT_SUBMIT: "auth.logout.submit",
} as const;

export const COMMON_KEYS = {
  SAVE: "common.buttons.save",
  CANCEL: "common.buttons.cancel",
  DELETE: "common.buttons.delete",
  CONFIRM: "common.buttons.confirm",
  LOADING: "common.labels.loading",
  NO_RESULTS: "common.labels.no_results",
} as const;
