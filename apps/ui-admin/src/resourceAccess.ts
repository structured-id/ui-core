/**
 * What a client may reach: the resources it has access to, the resources it
 * could be given access to, and its default target.
 *
 * A client obtains a token only for a registered resource it was explicitly
 * given access to. A request naming no resource uses the client's saved
 * default target; without one it is refused. A client that only signs users
 * in targets its issuer's UserInfo resource. The console offers these
 * choices and grants nothing by itself.
 */
import {
  ResourceState,
  type Application,
  type OAuthClient,
  type ProtectedResource,
  type ResourceAccess,
} from "@structured-id/proto/sid/v1/projects/projects";
import { sameWire, shown, type WireId } from "#admin/ids";

/** A resource as the console names it: the application's name with it. */
export interface NamedResource {
  /** The application holding the resource role. */
  name: string;
  resource: ProtectedResource;
}

/** The scopes a sign-in asks for, in the order OpenID Connect names them. */
const SIGN_IN_SCOPES = ["openid", "profile", "email"];

/**
 * The resources `client` can be given access to: the active and inactive
 * resources registered under the client's own issuer. A retired resource
 * accepts no access, and a resource of another issuer never takes this
 * client's tokens.
 */
export function grantableResources(
  applications: Application[],
  client: Pick<OAuthClient, "issuer">,
): NamedResource[] {
  return applications
    .flatMap((application) =>
      application.resource
        ? [{ name: application.name, resource: application.resource }]
        : [],
    )
    .filter(
      ({ resource }) =>
        resource.issuer === client.issuer &&
        resource.state !== ResourceState.RETIRED,
    );
}

/** The resource `id` names among `resources`, if it is there. */
export function resourceNamed(
  resources: NamedResource[],
  id: WireId | undefined,
): NamedResource | undefined {
  return id
    ? resources.find(({ resource }) => resource.id && sameWire(resource.id, id))
    : undefined;
}

/**
 * The issuer's UserInfo resource among `resources`: the one whose indicator
 * is the UserInfo endpoint the issuer's own discovery document names
 * (`userinfoEndpoint`). The endpoint is read from the issuer, never built
 * from its URL here.
 */
export function userinfoResource(
  resources: NamedResource[],
  userinfoEndpoint: string,
): NamedResource | undefined {
  return resources.find(
    ({ resource }) =>
      resource.indicator === userinfoEndpoint &&
      resource.state === ResourceState.ACTIVE,
  );
}

/**
 * The scopes of a sign-in access to `resource`: the sign-in scopes the
 * resource understands and the client may request. A client with no allowed
 * scopes saved has the server's default (`openid profile email`).
 */
export function signInScopes(
  resource: Pick<ProtectedResource, "scopes">,
  client: Pick<OAuthClient, "allowedScopes">,
): string[] {
  const allowed = client.allowedScopes.length
    ? client.allowedScopes
    : SIGN_IN_SCOPES;
  return SIGN_IN_SCOPES.filter(
    (scope) => resource.scopes.includes(scope) && allowed.includes(scope),
  );
}

/** One row of a client's access: the access with the resource it is to. */
export interface AccessRow {
  /** Row key: the resource's identifier text. */
  key: string;
  access: ResourceAccess;
  /** The resource, when the console knows it (absent for one it cannot list). */
  resource: NamedResource | undefined;
  /** This resource is the client's default target. */
  isDefault: boolean;
}

/** A client's access rows, in the order the server answered them. */
export function accessRows(
  access: ResourceAccess[],
  resources: NamedResource[],
  client: Pick<OAuthClient, "defaultResourceId">,
): AccessRow[] {
  return access.map((entry) => ({
    key: shown(entry.resourceId),
    access: entry,
    resource: resourceNamed(resources, entry.resourceId),
    isDefault:
      entry.resourceId !== undefined &&
      client.defaultResourceId !== undefined &&
      sameWire(entry.resourceId, client.defaultResourceId),
  }));
}

/** The resources `client` has no access to yet: what "Add access" offers. */
export function resourcesWithoutAccess(
  resources: NamedResource[],
  access: ResourceAccess[],
): NamedResource[] {
  return resources.filter(
    ({ resource }) =>
      !access.some(
        (entry) =>
          entry.resourceId &&
          resource.id &&
          sameWire(entry.resourceId, resource.id),
      ),
  );
}
