import { describe, it, expect } from "vitest";
import { issuerRouteHint, signInAddress, signInEntryOf } from "./signInEntry";

const RD = "https://sid.example.com/oauth2/authorize?client_id=c&request_uri=u";

describe("signInEntryOf", () => {
  // What is tested: the next page of a sign-in is addressed with everything
  // this page was addressed with.
  // Bug prevented: `rd` passed on alone, so that a page opened afresh read a
  // root-addressed issuer's request at the host root instead of the route
  // the issuer named, and lost its federated entry.
  it("keeps the request with the issuer's route and federated entry", () => {
    expect(
      signInEntryOf({ rd: RD, route: "/i/0123abcd", federated: "1" }),
    ).toEqual({ rd: RD, route: "/i/0123abcd", federated: "1" });
  });

  it("keeps only what names the sign-in", () => {
    expect(signInEntryOf({ rd: RD, invite: "ABCD1234", lang: "en" })).toEqual({
      rd: RD,
    });
  });

  // A hint that is not an issuer route chooses no path, and a flag other
  // than the issuer's own is not passed on.
  it("drops a route that is not an issuer route and a foreign flag", () => {
    for (const route of [
      "/admin",
      "https://sid.example.com/i/x",
      "/i/a/b",
      ["/i/a", "/i/b"],
    ]) {
      expect(
        signInEntryOf({ rd: RD, route, federated: "yes" }),
        String(route),
      ).toEqual({ rd: RD });
    }
  });

  // Without a request the page belongs to no sign-in: nothing is carried.
  it("carries nothing without a request", () => {
    expect(signInEntryOf({ route: "/i/0123abcd", federated: "1" })).toEqual({});
    expect(signInEntryOf({ rd: [RD, RD] })).toEqual({});
    expect(signInEntryOf({})).toEqual({});
  });
});

describe("issuerRouteHint", () => {
  it("is an issuer route or nothing", () => {
    expect(issuerRouteHint("/i/0123abcd")).toBe("/i/0123abcd");
    for (const hint of [null, undefined, "", "/", "/i/", "//i/x", 7]) {
      expect(issuerRouteHint(hint), String(hint)).toBeUndefined();
    }
  });
});

describe("signInAddress", () => {
  it("addresses a page with what the entry names, or bare without one", () => {
    expect(
      signInAddress("/account/login", {
        rd: RD,
        route: "/i/0123abcd",
        federated: "1",
      }),
    ).toBe(
      `/account/login?rd=${encodeURIComponent(RD)}&route=%2Fi%2F0123abcd&federated=1`,
    );
    expect(signInAddress("/account/login", { rd: RD })).toBe(
      `/account/login?rd=${encodeURIComponent(RD)}`,
    );
    expect(signInAddress("/account/login", {})).toBe("/account/login");
  });
});
