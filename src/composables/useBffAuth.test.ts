import { describe, it, expect, vi, beforeEach } from "vitest";
import { RpcError } from "@protobuf-ts/runtime-rpc";
import { GrantOutcome } from "@structured-id/proto/sid/v1/authn/application_session";

/** What the UI host's session service answers; each test sets its calls. */
const host = vi.hoisted(() => ({
  getApplicationSession: vi.fn(),
  endApplicationSession: vi.fn(),
  /** The base URL of the transport last made. */
  transportBase: undefined as string | undefined,
}));

vi.mock("@protobuf-ts/grpcweb-transport", () => ({
  GrpcWebFetchTransport: class {
    constructor(options: { baseUrl: string }) {
      host.transportBase = options.baseUrl;
    }
  },
}));

vi.mock("@structured-id/proto/sid/v1/authn/application_session.client", () => ({
  ApplicationSessionServiceClient: class {
    getApplicationSession = host.getApplicationSession;
    endApplicationSession = host.endApplicationSession;
  },
}));

import {
  bffCsrfToken,
  bffLogout,
  checkBffSession,
  initBff,
} from "./useBffAuth";

/** A unary call that answers `response`. */
function answers(response: unknown) {
  return Promise.resolve({ response });
}

/** A unary call refused with gRPC status `code`. */
function refused(code: string) {
  return Promise.reject(new RpcError("refused", code));
}

/** A live session with CSRF token `token-1`. */
const LIVE = {
  sub: "0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d9e",
  email: "user@sid.example.com",
  acr: "urn:sid:acr:basic",
  csrfToken: "token-1",
};

describe("the session service's address", () => {
  // The host serves a page's calls only under its API mount: a call at the
  // root is refused, and the page cannot read a session it has.
  it("is the API mount of the page's own origin", () => {
    initBff("");
    expect(host.transportBase).toBe("/api");
  });

  it("is the API mount of a configured host", () => {
    initBff("https://host.sid.example.com");
    expect(host.transportBase).toBe("https://host.sid.example.com/api");
  });

  it("is the API mount of a host named for one call", async () => {
    initBff("");
    host.getApplicationSession.mockReturnValue(answers(LIVE));
    await checkBffSession("https://other.sid.example.com");
    expect(host.transportBase).toBe("https://other.sid.example.com/api");
  });
});

describe("checkBffSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initBff("");
  });

  // The page shows the signed-in user and keeps the session's CSRF token for
  // the state-changing calls that follow.
  it("reads the live session and keeps its CSRF token", async () => {
    host.getApplicationSession.mockReturnValue(answers(LIVE));
    await expect(checkBffSession()).resolves.toEqual({
      sub: LIVE.sub,
      email: LIVE.email,
      name: null,
      preferred_username: null,
      acr: LIVE.acr,
      csrf_token: "token-1",
    });
    expect(bffCsrfToken()).toBe("token-1");
  });

  // No session is a signed-out page, and no token is kept from before.
  it("reports a signed-out page as null and forgets the token", async () => {
    host.getApplicationSession.mockReturnValue(answers(LIVE));
    await checkBffSession();
    host.getApplicationSession.mockReturnValue(refused("UNAUTHENTICATED"));
    await expect(checkBffSession()).resolves.toBeNull();
    expect(bffCsrfToken()).toBeNull();
  });

  // An outage must not send a signed-in user to sign-in again.
  it.each(["UNAVAILABLE", "INTERNAL"])(
    "throws on %s instead of reporting a signed-out page",
    async (code) => {
      host.getApplicationSession.mockReturnValue(refused(code));
      await expect(checkBffSession()).rejects.toBeInstanceOf(RpcError);
    },
  );

  it("reports nothing before the session is set up", async () => {
    vi.resetModules();
    const fresh = await import("./useBffAuth");
    await expect(fresh.checkBffSession()).resolves.toBeNull();
    expect(host.getApplicationSession).not.toHaveBeenCalled();
  });
});

describe("bffLogout", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    initBff("");
    host.getApplicationSession.mockReturnValue(answers(LIVE));
    await checkBffSession();
  });

  // The page tells a local end of its session from one where the issuer also
  // revoked the grant, so it can say which happened.
  it.each([
    [GrantOutcome.REVOKED, "revoked"],
    [GrantOutcome.NOT_REVOKED, "not_revoked"],
    [GrantOutcome.NONE, "none"],
    [GrantOutcome.UNKNOWN, "unknown"],
  ] as const)(
    "reports the ended session with grant %s",
    async (grant, name) => {
      host.endApplicationSession.mockReturnValue(answers({ grant }));
      await expect(bffLogout()).resolves.toEqual({ ended: true, grant: name });
      expect(host.endApplicationSession).toHaveBeenCalledWith(
        {},
        { meta: { "x-csrf-token": "token-1" } },
      );
    },
  );

  // A refused or failed sign-out leaves the session alive: the page must not
  // report it as ended.
  it.each(["PERMISSION_DENIED", "UNAVAILABLE", "UNAUTHENTICATED"])(
    "reports a sign-out refused with %s as not ended",
    async (code) => {
      host.endApplicationSession.mockReturnValue(refused(code));
      await expect(bffLogout()).resolves.toEqual({ ended: false });
    },
  );

  it("reports an unreachable host as not ended", async () => {
    host.endApplicationSession.mockReturnValue(
      Promise.reject(new TypeError("offline")),
    );
    await expect(bffLogout()).resolves.toEqual({ ended: false });
  });

  it("reports nothing ended before the session is set up", async () => {
    vi.resetModules();
    const fresh = await import("./useBffAuth");
    await expect(fresh.bffLogout()).resolves.toEqual({ ended: false });
    expect(host.endApplicationSession).not.toHaveBeenCalled();
  });

  // Whatever the host answers, the page forgets the session's token.
  it("forgets the CSRF token even when the sign-out failed", async () => {
    host.endApplicationSession.mockReturnValue(refused("UNAVAILABLE"));
    await bffLogout();
    expect(bffCsrfToken()).toBeNull();
  });
});
