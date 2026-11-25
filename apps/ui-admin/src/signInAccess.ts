/**
 * The access a client needs to sign users in with OpenID Connect and nothing
 * else: access to its issuer's UserInfo resource with the sign-in scopes,
 * saved as its default target, so a standard authorization request (which
 * names no resource) is issued a token for UserInfo.
 *
 * The administrator chooses this in the create wizard; it is two ordinary
 * calls, each of which changes nothing when repeated.
 */
import type {
  Application,
  OAuthClient,
  ResourceAccess,
} from "@structured-id/proto/sid/v1/projects/projects";
import {
  grantableResources,
  signInScopes,
  userinfoResource,
  type NamedResource,
} from "#admin/resourceAccess";

/** The calls the grant makes. */
export interface SignInAccessApi {
  /** The UserInfo endpoint the issuer's discovery document names. */
  userinfoEndpoint(issuer: string): Promise<string>;
  setAccess(
    clientId: string,
    resourceId: ResourceAccess["resourceId"],
    scopes: string[],
  ): Promise<unknown>;
  setDefaultTarget(
    clientId: string,
    resourceId: ResourceAccess["resourceId"],
  ): Promise<unknown>;
}

/**
 * The UserInfo endpoint of `issuer`, from its discovery document. The
 * document is the issuer's only when it names that issuer (OpenID Connect
 * Discovery 1.0, 4.3); any other is refused.
 */
export async function discoverUserinfoEndpoint(
  issuer: string,
  get: typeof fetch = fetch,
): Promise<string> {
  const response = await get(`${issuer}/.well-known/openid-configuration`, {
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`The issuer's discovery answered ${response.status}`);
  }
  const document = (await response.json()) as {
    issuer?: unknown;
    userinfo_endpoint?: unknown;
  };
  if (document.issuer !== issuer) {
    throw new Error("The discovery document names another issuer");
  }
  if (typeof document.userinfo_endpoint !== "string") {
    throw new Error("The issuer's discovery names no UserInfo endpoint");
  }
  return document.userinfo_endpoint;
}

/**
 * Gives `client` its sign-in access and returns the resource it was given.
 * Fails, having changed nothing, when the issuer's UserInfo resource is not
 * among `applications`.
 */
export async function grantSignInAccess(
  api: SignInAccessApi,
  client: OAuthClient,
  applications: Application[],
): Promise<NamedResource> {
  const endpoint = await api.userinfoEndpoint(client.issuer);
  const target = userinfoResource(
    grantableResources(applications, client),
    endpoint,
  );
  if (!target) {
    throw new Error("The issuer's UserInfo resource is not registered");
  }
  await api.setAccess(
    client.clientId,
    target.resource.id,
    signInScopes(target.resource, client),
  );
  // The default must be a resource the client already has access to.
  await api.setDefaultTarget(client.clientId, target.resource.id);
  return target;
}
