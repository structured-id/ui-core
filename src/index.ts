// Composables
export {
  useGrpc,
  initGrpc,
  getTransport,
  closeTransport,
  getTransportType,
  type TransportType,
} from "./composables/useGrpc";
export { useSession, type SessionCallbacks } from "./composables/useSession";
export {
  useBffAuth,
  initBff,
  getBffBaseUrl,
  checkBffSession,
  startBffLogin,
  bffLogout,
  bffCsrfToken,
  type BffUserInfo,
} from "./composables/useBffAuth";
export {
  initAccountApi,
  getAccountTransport,
  closeAccountTransport,
  type AccountApiConfig,
} from "./composables/useAccountTransport";

// Stores
export { useAuthStore } from "./stores/auth";

// Components — import from '@structured-id/ui-core/components' (raw .vue SFC)
// Consuming apps with their own Vue build pipeline import directly:
//   import { SidStatusBadge } from '@structured-id/ui-core/components'

// Utils
export {
  isValidEmail,
  isValidPhone,
  isValidUuid,
  isValidUsername,
  minLength,
  maxLength,
  isRequired,
  formatDate,
  formatRelativeTime,
  truncate,
  maskEmail,
} from "./utils";

export {
  detectLoginInputType,
  normalizePrincipal,
  type LoginInputType,
  type NormalizedPrincipal,
} from "./utils/normalizePrincipal";

export {
  rpcRefusal,
  rpcReason,
  refusalMessage,
  REFUSAL_TEXTS,
  SID_ERROR_DOMAIN,
  type RpcRefusal,
} from "./utils/rpcRefusal";

// Types
export type { AuthState, SessionInfo, GrpcConfig } from "./types";

// i18n key constants
export { AUTH_KEYS, COMMON_KEYS } from "./i18n";

// Generated clients and messages come from '@structured-id/proto'
// (e.g. '@structured-id/proto/sid/v1/identity/identity.client').
