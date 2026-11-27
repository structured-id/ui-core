import { beforeEach, describe, expect, it } from "vitest";
import { UpstreamProviderId } from "@structured-id/ids";
import {
  UPSTREAM_CALLBACK_PATH,
  peekUpstream,
  rememberUpstream,
  signInEntryOfPage,
  takeUpstream,
  upstreamCallbackUri,
  upstreamRequestOfPage,
} from "./upstream";

const P1 = UpstreamProviderId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d20");
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
    rememberUpstream(sessionStorage, "s1", { provider: P1, rd: RD });
    const kept = peekUpstream(sessionStorage, "s1");
    expect(kept?.provider.toString()).toBe(P1.toString());
    expect(kept?.rd).toBe(RD);
    expect(peekUpstream(sessionStorage, "s2")).toBeUndefined();
  });

  // A sign-in without an authorization request returns without one.
  it("keeps the absence of a request", () => {
    rememberUpstream(sessionStorage, "s1", { provider: P1, rd: null });
    expect(peekUpstream(sessionStorage, "s1")?.rd).toBeNull();
  });

  // A return completes once: taking it removes it, so a reloaded or replayed
  // callback finds nothing to continue.
  it("is taken once", () => {
    rememberUpstream(sessionStorage, "s1", { provider: P1, rd: RD });
    expect(takeUpstream(sessionStorage, "s1")?.provider.toString()).toBe(
      P1.toString(),
    );
    expect(takeUpstream(sessionStorage, "s1")).toBeUndefined();
  });

  // What is tested: the one kept entry holds the sign-in the user left, with
  // the issuer's route and its offered federated entry.
  // Bug prevented: the entry kept the request alone, so the return of a
  // sign-in at an issuer that named its route was read at the host root and
  // signing in another way lost the federated entry.
  it("keeps the issuer's route and federated entry with the request", () => {
    rememberUpstream(sessionStorage, "s1", {
      provider: P1,
      rd: RD,
      route: "/i/0123abcd",
      federated: true,
    });
    const kept = peekUpstream(sessionStorage, "s1");
    expect(kept?.route).toBe("/i/0123abcd");
    expect(kept?.federated).toBe(true);
    expect(sessionStorage.length).toBe(1);

    // A sign-in whose issuer named neither keeps neither.
    rememberUpstream(sessionStorage, "s2", { provider: P1, rd: RD });
    const plain = peekUpstream(sessionStorage, "s2");
    expect(plain?.route).toBeUndefined();
    expect(plain?.federated).toBeUndefined();
  });

  // An entry naming a route that is not an issuer route chooses no path.
  it("reads no route that is not an issuer route", () => {
    sessionStorage.setItem(
      "sid.upstream.s1",
      JSON.stringify({
        provider: P1.toString(),
        rd: RD,
        route: "/admin",
        federated: "1",
      }),
    );
    const kept = peekUpstream(sessionStorage, "s1");
    expect(kept?.rd).toBe(RD);
    expect(kept?.route).toBeUndefined();
    expect(kept?.federated).toBeUndefined();
  });

  // A malformed or foreign entry is no return.
  it("ignores what it did not write", () => {
    sessionStorage.setItem("sid.upstream.s1", "not json");
    sessionStorage.setItem("sid.upstream.s2", JSON.stringify({ rd: RD }));
    sessionStorage.setItem(
      "sid.upstream.s3",
      JSON.stringify({ provider: "not-an-id", rd: RD }),
    );
    expect(peekUpstream(sessionStorage, "s1")).toBeUndefined();
    expect(peekUpstream(sessionStorage, "s2")).toBeUndefined();
    expect(peekUpstream(sessionStorage, "s3")).toBeUndefined();
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
    rememberUpstream(sessionStorage, "s1", { provider: P1, rd: RD });
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

  // What is tested: the page's sign-in, read before anything is addressed:
  // from its query everywhere, and on the callback page only from the entry
  // kept for its state.
  // Bug prevented: a callback page that knew the request but not the route
  // of the issuer it was started at, or one taking a route from the return
  // URL, which anyone can write.
  it("restores the callback's whole sign-in from its kept return alone", () => {
    expect(
      signInEntryOfPage(
        location(
          `/account/login?route=%2Fi%2F0123abcd&federated=1&rd=${encodeURIComponent(RD)}`,
        ),
        sessionStorage,
      ),
    ).toEqual({ rd: RD, route: "/i/0123abcd", federated: "1" });

    rememberUpstream(sessionStorage, "s1", {
      provider: P1,
      rd: RD,
      route: "/i/0123abcd",
      federated: true,
    });
    expect(
      signInEntryOfPage(
        location(
          `${UPSTREAM_CALLBACK_PATH}?code=c&state=s1&route=%2Fi%2Fother&rd=x`,
        ),
        sessionStorage,
      ),
    ).toEqual({ rd: RD, route: "/i/0123abcd", federated: "1" });
    expect(peekUpstream(sessionStorage, "s1")).toBeDefined();

    // An unknown state names no sign-in, whatever the return URL adds.
    expect(
      signInEntryOfPage(
        location(
          `${UPSTREAM_CALLBACK_PATH}?state=other&route=%2Fi%2F0123abcd&federated=1&rd=${encodeURIComponent(RD)}`,
        ),
        sessionStorage,
      ),
    ).toEqual({});
  });

  // An app with its own callback path reads its own callback page.
  it("follows the app's callback path", () => {
    rememberUpstream(sessionStorage, "s1", { provider: P1, rd: RD });
    expect(
      upstreamRequestOfPage(
        location("/upstream/return?state=s1"),
        sessionStorage,
        "/upstream/return",
      ),
    ).toBe(RD);
  });
});
