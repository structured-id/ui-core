import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  bffCsrfToken,
  bffLogout,
  checkBffSession,
  initBff,
} from "./useBffAuth";

/** A BFF that answers every request with this response. */
function bffAnswers(response: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The BFF's sign-out answer: the session ended, with this grant outcome. */
function ended(grant: string) {
  return { ok: true, status: 200, json: async () => ({ grant }) };
}

describe("bffLogout", () => {
  beforeEach(async () => {
    initBff("");
    bffAnswers({
      ok: true,
      status: 200,
      json: async () => ({ sub: "s", csrf_token: "token-1" }),
    });
    await checkBffSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The page tells a local end of its session from one where the issuer also
  // revoked the grant, so it can say which happened.
  it.each(["revoked", "not_revoked", "none"] as const)(
    "reports the ended session with grant %s",
    async (grant) => {
      const fetchMock = bffAnswers(ended(grant));
      await expect(bffLogout()).resolves.toEqual({ ended: true, grant });
      expect(fetchMock).toHaveBeenCalledWith("/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": "token-1" },
      });
    },
  );

  // A refused or failed sign-out leaves the BFF session alive: the page must
  // not report it as ended.
  it.each([
    ["refused", { ok: false, status: 403 }],
    ["unavailable", { ok: false, status: 503 }],
  ])("reports a %s sign-out as not ended", async (_name, response) => {
    bffAnswers(response);
    await expect(bffLogout()).resolves.toEqual({ ended: false });
  });

  it("reports an unreachable BFF as not ended", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(bffLogout()).resolves.toEqual({ ended: false });
  });

  // An answer the page cannot read still came after the BFF ended the
  // session; only the grant's fate is unknown.
  it("reports an unreadable answer as ended with an unknown grant", async () => {
    bffAnswers({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("not json");
      },
    });
    await expect(bffLogout()).resolves.toEqual({
      ended: true,
      grant: "unknown",
    });
  });

  it("reports nothing ended before the BFF is set up", async () => {
    vi.resetModules();
    const fresh = await import("./useBffAuth");
    const fetchMock = bffAnswers(ended("revoked"));
    await expect(fresh.bffLogout()).resolves.toEqual({ ended: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Whatever the BFF answers, the page forgets the session's token.
  it("forgets the CSRF token even when the sign-out failed", async () => {
    bffAnswers({ ok: false, status: 503 });
    await bffLogout();
    expect(bffCsrfToken()).toBeNull();
  });
});
