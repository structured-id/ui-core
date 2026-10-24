import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RpcError,
  type MethodInfo,
  type RpcInterceptor,
  type RpcOptions,
} from "@protobuf-ts/runtime-rpc";

const created: Array<{
  baseUrl: string;
  fetchInit?: RequestInit;
  interceptors?: RpcInterceptor[];
}> = [];

vi.mock("@protobuf-ts/grpcweb-transport", () => ({
  // Called with `new`: a constructor mock must be a `function`, not an arrow.
  GrpcWebFetchTransport: vi.fn().mockImplementation(function (options) {
    created.push(options);
    return { type: "grpc-web-transport" };
  }),
}));

/** What the UI host's session service answers; each test sets its calls. */
const host = vi.hoisted(() => ({
  getApplicationSession: vi.fn(),
  endApplicationSession: vi.fn(),
}));

vi.mock("@structured-id/proto/sid/v1/authn/application_session.client", () => ({
  ApplicationSessionServiceClient: class {
    getApplicationSession = host.getApplicationSession;
    endApplicationSession = host.endApplicationSession;
  },
}));

import {
  initAccountApi,
  getAccountTransport,
  closeAccountTransport,
} from "./useAccountTransport";
import { bffLogout, checkBffSession, initBff } from "./useBffAuth";

/** The account transport's options: the last transport created. */
function account() {
  return created[created.length - 1];
}

/** Run the transport's interceptor over a call and return the options it passed on. */
function intercepted(options: RpcOptions): RpcOptions {
  const [interceptor] = account().interceptors ?? [];
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

/** The host's answer to the page's session read: a session with this token. */
async function session(csrfToken: string) {
  host.getApplicationSession.mockResolvedValue({
    response: { sub: "up_1", acr: "", csrfToken },
  });
  await checkBffSession();
}

describe("account API transport", () => {
  beforeEach(async () => {
    created.length = 0;
    vi.clearAllMocks();
    closeAccountTransport();
    initBff("");
    host.getApplicationSession.mockRejectedValue(
      new RpcError("no session", "UNAUTHENTICATED"),
    );
    await checkBffSession();
  });

  // The account API is reached only through the UI host on the page's own
  // origin: its cookie rides along same-origin, and no other origin gets it.
  it("goes to the UI host on the page's origin with same-origin credentials", () => {
    initAccountApi({ baseUrl: "" });
    expect(account().baseUrl).toBe("");
    expect(account().fetchInit).toEqual({ credentials: "same-origin" });
  });

  // Every call echoes the session's CSRF token, which the host hands the page
  // with the session read: the host refuses a call without it, which is what
  // stops a foreign page driving the account API.
  it("sends the session's CSRF token on every call", async () => {
    initAccountApi({ baseUrl: "" });
    await session("token-1");
    const options = intercepted({ meta: { other: "kept" } });
    expect(options.meta).toEqual({ other: "kept", "x-csrf-token": "token-1" });
  });

  // No session, no header: the call goes out and the host answers it, rather
  // than the page inventing a token.
  it("sends no CSRF header without a session", () => {
    initAccountApi({ baseUrl: "" });
    const options = intercepted({ meta: {} });
    expect(options.meta).toEqual({});
  });

  // Sign-out ends the session; its token goes with it.
  it("forgets the token at sign-out", async () => {
    initAccountApi({ baseUrl: "" });
    await session("token-1");
    host.endApplicationSession.mockResolvedValue({ response: { grant: 1 } });
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
    initAccountApi({ baseUrl: "" });
    expect(getAccountTransport()).toEqual({ type: "grpc-web-transport" });
  });
});
