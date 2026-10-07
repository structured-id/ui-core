/**
 * The account API transport: gRPC-Web through the BFF (sid-auth-proxy) on the
 * page's own origin. The BFF holds the session's tokens and adds the Bearer
 * token itself; the page sends only its session cookie and, on every call,
 * the CSRF token the BFF set (double submit).
 *
 * Sign-in ceremonies are not account API calls: they go to SID's own sign-in
 * surface through `getTransport()`, where the IdP's session lives.
 */
import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import type { RpcInterceptor, RpcTransport } from "@protobuf-ts/runtime-rpc";
import { bffCsrfToken } from "./useBffAuth";

/** Where the account API is reached. */
export interface AccountApiConfig {
  /** The BFF's API route, usually `/api` on the page's own origin. */
  baseUrl: string;
}

let _account: RpcTransport | null = null;

/** The CSRF token of the BFF session, added to every call's metadata. */
const csrf: RpcInterceptor = {
  interceptUnary(next, method, input, options) {
    const token = bffCsrfToken();
    return next(
      method,
      input,
      token
        ? { ...options, meta: { ...options.meta, "x-csrf-token": token } }
        : options,
    );
  },
  interceptServerStreaming(next, method, input, options) {
    const token = bffCsrfToken();
    return next(
      method,
      input,
      token
        ? { ...options, meta: { ...options.meta, "x-csrf-token": token } }
        : options,
    );
  },
};

/** Set up the account API transport. Call once at app startup. */
export function initAccountApi(config: AccountApiConfig): void {
  _account = new GrpcWebFetchTransport({
    baseUrl: config.baseUrl,
    // The BFF is on this origin; its cookie must not travel anywhere else.
    fetchInit: { credentials: "same-origin" },
    interceptors: [csrf],
  });
}

/** The account API transport. Throws if it was not set up. */
export function getAccountTransport(): RpcTransport {
  if (!_account) {
    throw new Error(
      "account API transport not initialized. Call initAccountApi() at app startup.",
    );
  }
  return _account;
}

/** Drop the account API transport (tests, app teardown). */
export function closeAccountTransport(): void {
  _account = null;
}
