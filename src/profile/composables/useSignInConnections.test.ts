import { describe, it, expect, vi } from "vitest";
import {
  continuedIssuer,
  entryStartUrl,
  useSignInConnections,
  type SignInConnection,
  type SignInConnectionsApi,
} from "./useSignInConnections";

const ORIGIN = "https://sid.example.com";
const HANDLE = "0123456789abcdef0123456789abcdef";
const REQUEST = "urn:ietf:params:oauth:request_uri:abc";

/** The continuation of an authorization request at the issuer under `base`. */
function continuation(base: string): string {
  return `${base}/oauth2/authorize?client_id=app&request_uri=${encodeURIComponent(REQUEST)}`;
}

const SCOPED = continuation(`${ORIGIN}/i/${HANDLE}`);
const ROOT = continuation(ORIGIN);

const FIRST: SignInConnection = { handle: "aaaa1111", name: "Partner" };
const SECOND: SignInConnection = { handle: "bbbb2222", name: "Partner" };

/** An api answering `listed` and recording the issuer it was asked for. */
function api(listed: SignInConnection[] | Error) {
  const list = vi.fn<SignInConnectionsApi["list"]>(async () => {
    if (listed instanceof Error) throw listed;
    return listed;
  });
  return { list };
}

describe("continuedIssuer", () => {
  // What is tested: the issuer is read from the continuation's own path.
  // Bug prevented: the root issuer's connections listed for a path-addressed
  // issuer of the same installation, or the reverse.
  it("names a path-addressed issuer by its handle and URL", () => {
    expect(continuedIssuer(SCOPED, ORIGIN)).toEqual({
      url: `${ORIGIN}/i/${HANDLE}`,
      handle: HANDLE,
      continuation: SCOPED,
    });
  });

  it("names the base issuer at the root by the empty handle", () => {
    expect(continuedIssuer(ROOT, ORIGIN)).toEqual({
      url: ORIGIN,
      handle: "",
      continuation: ROOT,
    });
  });

  // What is tested: only a validated continuation of this installation
  // names an issuer.
  // Bug prevented: an entry started for an address the page did not
  // validate, or a connection list read for another origin's issuer.
  it.each([
    ["no rd", undefined],
    [
      "another origin",
      continuation(`https://other.sid.example.com/i/${HANDLE}`),
    ],
    ["a path that is no authorization endpoint", `${ORIGIN}/account`],
    ["an extra parameter", `${SCOPED}&next=1`],
  ])("answers nothing for %s", (_name, rd) => {
    expect(continuedIssuer(rd, ORIGIN)).toBeNull();
  });
});

describe("entryStartUrl", () => {
  // What is tested: the start is the continued issuer's own route, carrying
  // the exact handle and the whole continuation.
  // Bug prevented: an entry started at the root issuer for a path-addressed
  // one, or a continuation cut at its first `&`.
  it("is the issuer's entry start with the connection and the continuation", () => {
    const issuer = continuedIssuer(SCOPED, ORIGIN)!;
    const start = new URL(entryStartUrl(issuer, FIRST.handle));
    expect(start.origin + start.pathname).toBe(
      `${ORIGIN}/i/${HANDLE}/auth/federation/start`,
    );
    expect([...start.searchParams.keys()].sort()).toEqual(["connection", "rd"]);
    expect(start.searchParams.get("connection")).toBe(FIRST.handle);
    expect(start.searchParams.get("rd")).toBe(SCOPED);
  });

  it("is at the root for the base issuer", () => {
    const issuer = continuedIssuer(ROOT, ORIGIN)!;
    const start = new URL(entryStartUrl(issuer, FIRST.handle));
    expect(start.origin + start.pathname).toBe(
      `${ORIGIN}/auth/federation/start`,
    );
  });
});

describe("useSignInConnections", () => {
  // What is tested: the list is read for the issuer of the page's request.
  // Bug prevented: every issuer of an installation offering the root
  // issuer's connections.
  it("lists the connections of the continued issuer", async () => {
    const calls = api([FIRST, SECOND]);
    const page = useSignInConnections(() => SCOPED, ORIGIN, { api: calls });
    await page.load();
    expect(calls.list).toHaveBeenCalledExactlyOnceWith(HANDLE);
    expect(page.connections.value).toEqual([FIRST, SECOND]);
  });

  // What is tested: without a request to continue the page asks nothing.
  // Bug prevented: buttons that start an entry the installation answers
  // with a refusal page, on a sign-in opened directly.
  it("offers nothing without an authorization request", async () => {
    const calls = api([FIRST]);
    const page = useSignInConnections(() => undefined, ORIGIN, { api: calls });
    await page.load();
    expect(calls.list).not.toHaveBeenCalled();
    expect(page.connections.value).toEqual([]);
  });

  // What is tested: a failed read leaves the page without connections.
  // Bug prevented: an unavailable list breaking local sign-in.
  it("offers nothing when the list cannot be read", async () => {
    const page = useSignInConnections(() => SCOPED, ORIGIN, {
      api: api(new Error("unavailable")),
    });
    await expect(page.load()).resolves.toBeUndefined();
    expect(page.connections.value).toEqual([]);
  });

  // What is tested: the chosen connection is named by its handle, also when
  // two share a display name.
  // Bug prevented: the first of two equally named connections entered when
  // the user picked the second.
  it("leaves through the chosen connection's handle", async () => {
    const leaveTo = vi.fn();
    const page = useSignInConnections(() => SCOPED, ORIGIN, {
      api: api([FIRST, SECOND]),
      leaveTo,
    });
    await page.load();
    page.signInThrough(SECOND.handle);
    expect(leaveTo).toHaveBeenCalledExactlyOnceWith(
      entryStartUrl(continuedIssuer(SCOPED, ORIGIN)!, SECOND.handle),
    );
    expect(page.leaving.value).toBe(SECOND.handle);
  });

  // What is tested: only a listed connection is entered.
  // Bug prevented: the page starting an entry for a handle the installation
  // did not offer, or before the list was read.
  it("does not leave through a connection it did not list", async () => {
    const leaveTo = vi.fn();
    const page = useSignInConnections(() => SCOPED, ORIGIN, {
      api: api([FIRST]),
      leaveTo,
    });
    page.signInThrough(FIRST.handle);
    await page.load();
    page.signInThrough("cccc3333");
    expect(leaveTo).not.toHaveBeenCalled();
    expect(page.leaving.value).toBeNull();
  });
});
