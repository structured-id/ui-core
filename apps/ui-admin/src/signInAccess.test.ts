import { describe, expect, it, vi } from "vitest";
import {
  ResourceState,
  type Application,
  type OAuthClient,
} from "@structured-id/proto/sid/v1/projects/projects";
import {
  discoverUserinfoEndpoint,
  grantSignInAccess,
  type SignInAccessApi,
} from "./signInAccess";

const ISSUER = "https://sid.example.com";
const USERINFO_ID = { value: new Uint8Array(16).fill(7) };

const CLIENT = {
  clientId: "sid_notes",
  issuer: ISSUER,
  allowedScopes: ["openid", "profile", "email"],
} as OAuthClient;

const USERINFO = {
  name: "OIDC UserInfo",
  resource: {
    id: USERINFO_ID,
    indicator: `${ISSUER}/userinfo`,
    issuer: ISSUER,
    scopes: ["openid", "profile", "email", "phone", "address"],
    state: ResourceState.ACTIVE,
    revision: 1n,
  },
} as Application;

function api(over: Partial<SignInAccessApi> = {}) {
  const calls: string[] = [];
  const made: SignInAccessApi = {
    userinfoEndpoint: vi.fn(async () => `${ISSUER}/userinfo`),
    setAccess: vi.fn(async () => {
      calls.push("access");
    }),
    setDefaultTarget: vi.fn(async () => {
      calls.push("default");
    }),
    ...over,
  };
  return { made, calls };
}

describe("grantSignInAccess", () => {
  // What is tested: the client gets access to its issuer's UserInfo resource
  // with the sign-in scopes, and only then that resource as its default.
  // Bug prevented: a default saved before the access exists (the server
  // refuses it), or `phone` and `address` granted because UserInfo
  // understands them.
  it("gives the sign-in scopes, then saves the default target", async () => {
    const { made, calls } = api();
    const target = await grantSignInAccess(made, CLIENT, [USERINFO]);
    expect(target.name).toBe("OIDC UserInfo");
    expect(made.userinfoEndpoint).toHaveBeenCalledExactlyOnceWith(ISSUER);
    expect(made.setAccess).toHaveBeenCalledExactlyOnceWith(
      "sid_notes",
      USERINFO_ID,
      ["openid", "profile", "email"],
    );
    expect(made.setDefaultTarget).toHaveBeenCalledExactlyOnceWith(
      "sid_notes",
      USERINFO_ID,
    );
    expect(calls).toEqual(["access", "default"]);
  });

  // What is tested: without the issuer's UserInfo resource nothing is
  // granted and the failure says why.
  // Bug prevented: the sign-in access given to whatever resource happens to
  // be listed.
  it("changes nothing when the UserInfo resource is not registered", async () => {
    const { made } = api();
    const other = {
      ...USERINFO,
      resource: { ...USERINFO.resource!, indicator: `${ISSUER}/orders` },
    } as Application;
    await expect(grantSignInAccess(made, CLIENT, [other])).rejects.toThrow(
      "The issuer's UserInfo resource is not registered",
    );
    expect(made.setAccess).not.toHaveBeenCalled();
    expect(made.setDefaultTarget).not.toHaveBeenCalled();
  });

  // What is tested: a refused access leaves no default behind it.
  it("saves no default when the access was refused", async () => {
    const { made } = api({
      setAccess: vi.fn(async () => {
        throw new Error("refused");
      }),
    });
    await expect(grantSignInAccess(made, CLIENT, [USERINFO])).rejects.toThrow(
      "refused",
    );
    expect(made.setDefaultTarget).not.toHaveBeenCalled();
  });
});

describe("discoverUserinfoEndpoint", () => {
  const answering = (status: number, body: unknown) =>
    vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(body), { status }),
    );

  it("reads the endpoint from the issuer's own document", async () => {
    const get = answering(200, {
      issuer: ISSUER,
      userinfo_endpoint: `${ISSUER}/userinfo`,
    });
    expect(await discoverUserinfoEndpoint(ISSUER, get)).toBe(
      `${ISSUER}/userinfo`,
    );
    expect(get.mock.calls[0]![0]).toBe(
      `${ISSUER}/.well-known/openid-configuration`,
    );
  });

  // What is tested: a document naming another issuer is refused (OpenID
  // Connect Discovery 1.0, 4.3).
  // Bug prevented: another issuer's UserInfo taken as this client's target.
  it("refuses a document that names another issuer", async () => {
    const get = answering(200, {
      issuer: "https://elsewhere.sid.example.com",
      userinfo_endpoint: "https://elsewhere.sid.example.com/userinfo",
    });
    await expect(discoverUserinfoEndpoint(ISSUER, get)).rejects.toThrow(
      "another issuer",
    );
  });

  it("refuses an unanswered or incomplete discovery", async () => {
    await expect(
      discoverUserinfoEndpoint(ISSUER, answering(404, {})),
    ).rejects.toThrow("404");
    await expect(
      discoverUserinfoEndpoint(ISSUER, answering(200, { issuer: ISSUER })),
    ).rejects.toThrow("no UserInfo endpoint");
  });
});
