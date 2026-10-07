import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  MethodInfo,
  RpcInterceptor,
  RpcOptions,
} from "@protobuf-ts/runtime-rpc";

const created: Array<{
  baseUrl: string;
  fetchInit?: RequestInit;
  interceptors?: RpcInterceptor[];
}> = [];

vi.mock("@protobuf-ts/grpcweb-transport", () => ({
  GrpcWebFetchTransport: vi.fn().mockImplementation((options) => {
    created.push(options);
    return { type: "grpc-web-transport" };
  }),
}));

import {
  initAccountApi,
  getAccountTransport,
  closeAccountTransport,
} from "./useAccountTransport";
import { bffLogout, checkBffSession, initBff } from "./useBffAuth";

/** Run the transport's interceptor over a call and return the options it passed on. */
function intercepted(options: RpcOptions): RpcOptions {
  const [interceptor] = created[created.length - 1].interceptors ?? [];
  let passed: RpcOptions | undefined;
  interceptor.interceptUnary!(
    (_method, _input, opts) => {
      passed = opts;
      return {} as never;
    },
    {} as MethodInfo,
    {},
    options,
  );
  return passed!;
}

/** The BFF's answer to the page's session check: the user with the session's token. */
function bffSession(csrfToken: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ sub: "up_1", csrf_token: csrfToken }),
    }),
  );
}

/** The BFF's answer without a session. */
function noBffSession() {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
}

describe("account API transport", () => {
  beforeEach(async () => {
    created.length = 0;
    closeAccountTransport();
    initBff("");
    noBffSession();
    await checkBffSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The account API is reached only through the BFF on the page's own origin:
  // its cookie rides along same-origin, and no other origin gets it.
  it("goes to the BFF's API route with same-origin credentials", () => {
    initAccountApi({ baseUrl: "/api" });
    expect(created[0].baseUrl).toBe("/api");
    expect(created[0].fetchInit).toEqual({ credentials: "same-origin" });
  });

  // Every call echoes the session's CSRF token, which the BFF hands the page
  // with the session check: the BFF refuses a call without it, which is what
  // stops a foreign page driving the account API.
  it("sends the CSRF token the BFF gave with the session on every call", async () => {
    initAccountApi({ baseUrl: "/api" });
    bffSession("token-1");
    await checkBffSession();
    const options = intercepted({ meta: { other: "kept" } });
    expect(options.meta).toEqual({ other: "kept", "x-csrf-token": "token-1" });
  });

  // No session, no header: the call goes out and the BFF answers it (401 or
  // 403), rather than the page inventing a token.
  it("sends no CSRF header without a session", () => {
    initAccountApi({ baseUrl: "/api" });
    const options = intercepted({ meta: {} });
    expect(options.meta).toEqual({});
  });

  // Sign-out ends the session; its token goes with it.
  it("forgets the token at sign-out", async () => {
    initAccountApi({ baseUrl: "/api" });
    bffSession("token-1");
    await checkBffSession();
    await bffLogout();
    const options = intercepted({ meta: {} });
    expect(options.meta).toEqual({});
  });

  it("is unusable before it is set up", () => {
    expect(() => getAccountTransport()).toThrow(
      "account API transport not initialized",
    );
  });

  it("is the one set up", () => {
    initAccountApi({ baseUrl: "/api" });
    expect(getAccountTransport()).toEqual({ type: "grpc-web-transport" });
  });
});
