import { beforeEach, describe, expect, it } from "vitest";
import {
  UPSTREAM_CALLBACK_PATH,
  peekUpstream,
  rememberUpstream,
  takeUpstream,
  upstreamCallbackUri,
  upstreamRequestOfPage,
} from "./upstream";

const RD =
  "https://sid.example.com/i/0123456789abcdef0123456789abcdef/oauth2/authorize?client_id=ops&request_uri=urn%3Aietf%3Aparams%3Aoauth%3Arequest_uri%3Ar";

function location(path: string) {
  const url = new URL(path, "https://ee.sid.example.com");
  return { pathname: url.pathname, search: url.search };
}

beforeEach(() => sessionStorage.clear());

describe("upstreamCallbackUri", () => {
  // The provider returns to one exact URI registered for this origin, with
  // no query: the provider compares it exactly (RFC 6749 §3.1.2).
  it("is the callback page on this origin", () => {
    expect(upstreamCallbackUri("https://ee.sid.example.com")).toBe(
      `https://ee.sid.example.com${UPSTREAM_CALLBACK_PATH}`,
    );
    expect(
      upstreamCallbackUri("https://admin.sid.example.com", "/upstream/return"),
    ).toBe("https://admin.sid.example.com/upstream/return");
  });
});

describe("the kept return", () => {
  // The return to the callback page finds the provider and the request it
  // started with, under the provider's state.
  it("is found under its state", () => {
    rememberUpstream(sessionStorage, "s1", { provider: "p1", rd: RD });
    expect(peekUpstream(sessionStorage, "s1")).toEqual({
      provider: "p1",
      rd: RD,
    });
    expect(peekUpstream(sessionStorage, "s2")).toBeUndefined();
  });

  // A sign-in without an authorization request returns without one.
  it("keeps the absence of a request", () => {
    rememberUpstream(sessionStorage, "s1", { provider: "p1", rd: null });
    expect(peekUpstream(sessionStorage, "s1")?.rd).toBeNull();
  });

  // A return completes once: taking it removes it, so a reloaded or replayed
  // callback finds nothing to continue.
  it("is taken once", () => {
    rememberUpstream(sessionStorage, "s1", { provider: "p1", rd: RD });
    expect(takeUpstream(sessionStorage, "s1")?.provider).toBe("p1");
    expect(takeUpstream(sessionStorage, "s1")).toBeUndefined();
  });

  // A malformed or foreign entry is no return.
  it("ignores what it did not write", () => {
    sessionStorage.setItem("sid.upstream.s1", "not json");
    sessionStorage.setItem("sid.upstream.s2", JSON.stringify({ rd: RD }));
    expect(peekUpstream(sessionStorage, "s1")).toBeUndefined();
    expect(peekUpstream(sessionStorage, "s2")).toBeUndefined();
  });
});

describe("upstreamRequestOfPage", () => {
  // Every other page completes the request in its query.
  it("reads rd from the query", () => {
    expect(
      upstreamRequestOfPage(
        location(`/account/login?rd=${encodeURIComponent(RD)}`),
        sessionStorage,
      ),
    ).toBe(RD);
    expect(
      upstreamRequestOfPage(location("/account/login"), sessionStorage),
    ).toBeNull();
  });

  // The callback page completes the request kept for its state, which the
  // provider's return does not carry; the entry stays for the page to take.
  // An rd in the callback's own query is never used.
  it("reads the callback's request only from its kept return", () => {
    rememberUpstream(sessionStorage, "s1", { provider: "p1", rd: RD });
    const callback = location(`${UPSTREAM_CALLBACK_PATH}?code=c&state=s1`);
    expect(upstreamRequestOfPage(callback, sessionStorage)).toBe(RD);
    expect(peekUpstream(sessionStorage, "s1")).toBeDefined();
    expect(
      upstreamRequestOfPage(
        location(`${UPSTREAM_CALLBACK_PATH}?code=c&state=other`),
        sessionStorage,
      ),
    ).toBeNull();
    expect(
      upstreamRequestOfPage(
        location(
          `${UPSTREAM_CALLBACK_PATH}?state=other&rd=${encodeURIComponent(RD)}`,
        ),
        sessionStorage,
      ),
    ).toBeNull();
  });

  // An app with its own callback path reads its own callback page.
  it("follows the app's callback path", () => {
    rememberUpstream(sessionStorage, "s1", { provider: "p1", rd: RD });
    expect(
      upstreamRequestOfPage(
        location("/upstream/return?state=s1"),
        sessionStorage,
        "/upstream/return",
      ),
    ).toBe(RD);
  });
});
