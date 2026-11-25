import { describe, expect, it } from "vitest";
import {
  ResourceState,
  type Application,
  type ProtectedResource,
  type ResourceAccess,
} from "@structured-id/proto/sid/v1/projects/projects";
import {
  accessRows,
  grantableResources,
  resourcesWithoutAccess,
  signInScopes,
  userinfoResource,
} from "./resourceAccess";

const ISSUER = "https://sid.example.com";
const OTHER_ISSUER =
  "https://sid.example.com/i/0123456789abcdef0123456789abcdef";

const wire = (last: number) => ({
  value: Uint8Array.from({ length: 16 }, (_, i) => (i === 15 ? last : 1)),
});

function resource(
  last: number,
  indicator: string,
  over: Partial<ProtectedResource> = {},
): ProtectedResource {
  return {
    id: wire(last),
    indicator,
    issuer: ISSUER,
    scopes: ["openid", "profile", "email", "phone", "address"],
    state: ResourceState.ACTIVE,
    revision: 1n,
    ...over,
  };
}

function application(name: string, r?: ProtectedResource): Application {
  return { name, resource: r } as Application;
}

const USERINFO = resource(1, `${ISSUER}/userinfo`);
const ORDERS = resource(2, "https://api.sid.example.com/orders", {
  scopes: ["orders.read", "orders.write"],
});
const RETIRED = resource(3, "https://api.sid.example.com/old", {
  state: ResourceState.RETIRED,
});
const INACTIVE = resource(4, "https://api.sid.example.com/paused", {
  state: ResourceState.INACTIVE,
});
const FOREIGN = resource(5, `${OTHER_ISSUER}/userinfo`, {
  issuer: OTHER_ISSUER,
});

const APPLICATIONS = [
  application("OIDC UserInfo", USERINFO),
  application("Orders API", ORDERS),
  application("Old API", RETIRED),
  application("Paused API", INACTIVE),
  application("Another issuer's UserInfo", FOREIGN),
  application("Notes"),
];

describe("grantableResources", () => {
  // What is tested: only resources of the client's own issuer are offered,
  // and a retired one is not.
  // Bug prevented: an access offered that the server refuses (another
  // issuer, a retired resource), or a foreign issuer's UserInfo taken for
  // the client's own.
  it("offers the client's own issuer's resources that still accept access", () => {
    const offered = grantableResources(APPLICATIONS, { issuer: ISSUER });
    expect(offered.map((r) => r.name)).toEqual([
      "OIDC UserInfo",
      "Orders API",
      "Paused API",
    ]);
  });
});

describe("userinfoResource", () => {
  const own = grantableResources(APPLICATIONS, { issuer: ISSUER });

  // What is tested: the UserInfo resource is the one whose indicator is the
  // endpoint the issuer's discovery names.
  // Bug prevented: a sign-in access granted to a resource picked by its
  // display name or by its place in the list.
  it("is the resource the issuer's discovery names", () => {
    expect(userinfoResource(own, `${ISSUER}/userinfo`)?.name).toBe(
      "OIDC UserInfo",
    );
    expect(userinfoResource(own, `${ISSUER}/elsewhere`)).toBeUndefined();
  });

  it("is none while that resource is inactive", () => {
    const paused = [
      {
        name: "OIDC UserInfo",
        resource: { ...USERINFO, state: ResourceState.INACTIVE },
      },
    ];
    expect(userinfoResource(paused, `${ISSUER}/userinfo`)).toBeUndefined();
  });
});

describe("signInScopes", () => {
  // What is tested: a sign-in access asks only for sign-in scopes, limited
  // to what the resource understands and the client may request.
  // Bug prevented: a sign-in that silently gains `phone` and `address`
  // because the resource understands them.
  it("grants the sign-in scopes the resource and the client share", () => {
    expect(signInScopes(USERINFO, { allowedScopes: [] })).toEqual([
      "openid",
      "profile",
      "email",
    ]);
    expect(
      signInScopes(USERINFO, { allowedScopes: ["openid", "email", "phone"] }),
    ).toEqual(["openid", "email"]);
    expect(signInScopes(ORDERS, { allowedScopes: [] })).toEqual([]);
  });
});

describe("accessRows", () => {
  const own = grantableResources(APPLICATIONS, { issuer: ISSUER });
  const access: ResourceAccess[] = [
    { clientId: "c", resourceId: USERINFO.id, scopes: ["openid"] },
    { clientId: "c", resourceId: ORDERS.id, scopes: ["orders.read"] },
    { clientId: "c", resourceId: wire(9), scopes: [] },
  ];

  // What is tested: each access is shown with its resource, the default
  // target is marked on exactly its row, and an access to a resource the
  // console cannot list still gets a row.
  // Bug prevented: the default marked on the wrong resource, or an access
  // hidden because its resource is not in the loaded list.
  it("marks the default target and keeps an access to an unlisted resource", () => {
    const rows = accessRows(access, own, { defaultResourceId: ORDERS.id });
    expect(rows.map((r) => [r.resource?.name, r.isDefault])).toEqual([
      ["OIDC UserInfo", false],
      ["Orders API", true],
      [undefined, false],
    ]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(3);
  });

  it("marks no row without a default target", () => {
    const rows = accessRows(access, own, { defaultResourceId: undefined });
    expect(rows.some((r) => r.isDefault)).toBe(false);
  });

  // What is tested: "Add access" offers only resources the client has no
  // access to yet.
  it("offers the resources without an access", () => {
    expect(resourcesWithoutAccess(own, access).map((r) => r.name)).toEqual([
      "Paused API",
    ]);
  });
});
