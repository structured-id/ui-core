// When a change of the session domain narrows it: the installation then
// signs out the browsers that shared the wider scope, and the console warns
// before the administrator saves. The rule is the installation's own: a
// narrower kind of scope, a selected host no longer listed, or a stored
// expression changed or removed, whose former matches cannot be known to
// survive. Bug prevented: a list shortened or an expression tightened with
// no warning, because the kind of scope did not change.
import { describe, expect, it } from "vitest";
import { SessionCookieDomain } from "@structured-id/proto/sid/v1/admin/settings";
import { narrows, type SessionScope } from "./sessionScope";

const thisHost: SessionScope = {
  domain: SessionCookieDomain.THIS_HOST,
  subdomains: [],
  subdomainPattern: "",
};
const all: SessionScope = {
  domain: SessionCookieDomain.ALL_SUBDOMAINS,
  subdomains: [],
  subdomainPattern: "",
};
const selected = (
  subdomains: string[],
  subdomainPattern = "",
): SessionScope => ({
  domain: SessionCookieDomain.SELECTED_SUBDOMAINS,
  subdomains,
  subdomainPattern,
});

describe("narrows", () => {
  it("is a narrower kind of scope", () => {
    expect(narrows(all, thisHost)).toBe(true);
    expect(narrows(all, selected(["app.sid.example.com"]))).toBe(true);
    expect(narrows(selected(["app.sid.example.com"]), thisHost)).toBe(true);
  });

  it("is not the same or a wider kind of scope", () => {
    expect(narrows(thisHost, thisHost)).toBe(false);
    expect(narrows(all, all)).toBe(false);
    expect(narrows(thisHost, selected(["app.sid.example.com"]))).toBe(false);
    expect(narrows(selected(["app.sid.example.com"]), all)).toBe(false);
  });

  it("is a selected host no longer listed", () => {
    const before = selected(["app.sid.example.com", "wiki.sid.example.com"]);
    expect(narrows(before, selected(["app.sid.example.com"]))).toBe(true);
    expect(
      narrows(
        before,
        selected(["app.sid.example.com", "docs.sid.example.com"]),
      ),
    ).toBe(true);
  });

  it("is not a list that keeps every host, in any order, or adds one", () => {
    const before = selected(["app.sid.example.com", "wiki.sid.example.com"]);
    expect(
      narrows(
        before,
        selected(["wiki.sid.example.com", "app.sid.example.com"]),
      ),
    ).toBe(false);
    expect(
      narrows(
        before,
        selected([
          "app.sid.example.com",
          "wiki.sid.example.com",
          "docs.sid.example.com",
        ]),
      ),
    ).toBe(false);
  });

  it("is a stored expression changed or removed", () => {
    const before = selected([], "^[a-z]+\\.sid\\.example\\.com$");
    expect(narrows(before, selected([], "^app\\.sid\\.example\\.com$"))).toBe(
      true,
    );
    expect(narrows(before, selected(["app.sid.example.com"]))).toBe(true);
  });

  it("is not an unchanged expression or one newly added", () => {
    const pattern = "^[a-z]+\\.sid\\.example\\.com$";
    expect(narrows(selected([], pattern), selected([], pattern))).toBe(false);
    expect(
      narrows(
        selected(["app.sid.example.com"]),
        selected(["app.sid.example.com"], pattern),
      ),
    ).toBe(false);
  });
});
