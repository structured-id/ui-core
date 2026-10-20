/**
 * Quasar-dependent components.
 *
 * Separate entrypoint from main ui-core (which is pure Vue 3 + TS).
 * Import as: import { SidPrincipalInput } from '@structured-id/ui-core/quasar'
 */
export { default as SidPrincipalInput } from "./SidPrincipalInput.vue";
export type {
  AcceptedPrincipalType,
  PrincipalInputTexts,
  PrincipalType,
} from "./principalInputTexts";
export {
  ALL_PRINCIPAL_TYPES,
  DEFAULT_PRINCIPAL_INPUT_TEXTS,
} from "./principalInputTexts";
export { default as SidPasswordCeremony } from "./SidPasswordCeremony.vue";
export type { CeremonyOutcome } from "./SidPasswordCeremony.vue";
