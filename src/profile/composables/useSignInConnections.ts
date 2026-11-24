/**
 * Sign-in through an entry connection the installation registered: an issuer
 * its users sign in through. The page lists the connections of the issuer
 * whose authorization request it completes and, when the user picks one,
 * sends the browser to that issuer's entry start with the connection's exact
 * handle and the request's continuation. The installation owns everything
 * else: the issuer, the client and the checks of the return.
 *
 * A connection is chosen by its handle alone. Its name is for display; its
 * place in the list, or its being the only one, selects nothing.
 */
import { ref } from "vue";
import { EntryConnectionServiceClient } from "@structured-id/proto/sid/v1/federation/entry.client";
import { getTransport } from "../../index";
import { authorizationContinuation } from "./useLoginSuccess";

/** A connection as the sign-in page offers it. */
export interface SignInConnection {
  /** The connection's routing name: the `connection` of the entry start. */
  handle: string;
  /** How the page names it. */
  name: string;
}

/** The route, below an installation issuer's URL, that starts an entry. */
const ENTRY_START_PATH = "/auth/federation/start";

/** The issuer's authorization endpoint path, below its URL. */
const AUTHORIZE_SUFFIX = "/oauth2/authorize";

/** The issuer an authorization request is continued at. */
export interface ContinuedIssuer {
  /** The issuer's URL: its origin, with `/i/<handle>` for a path-addressed one. */
  url: string;
  /** The issuer's opaque handle; empty for the base issuer at the origin's root. */
  handle: string;
  /** The validated continuation, as the entry returns to it. */
  continuation: string;
}

/**
 * The issuer `rd` continues an authorization request at, when `rd` is
 * exactly such a continuation at `issuerOrigin`
 * ({@link authorizationContinuation}); null otherwise. An entry starts only
 * for a request the issuer kept, so a page opened without one offers no
 * connection.
 */
export function continuedIssuer(
  rd: unknown,
  issuerOrigin: string,
): ContinuedIssuer | null {
  const continuation = authorizationContinuation(rd, issuerOrigin);
  if (continuation === null) return null;
  const url = new URL(continuation);
  const base = url.pathname.slice(0, -AUTHORIZE_SUFFIX.length);
  return {
    url: `${url.origin}${base}`,
    handle: base ? base.slice("/i/".length) : "",
    continuation,
  };
}

/**
 * Where the browser goes to sign in through the connection `handle` of
 * `issuer`: that issuer's entry start, naming the connection and the
 * continuation the entry returns to.
 */
export function entryStartUrl(issuer: ContinuedIssuer, handle: string): string {
  const start = new URL(`${issuer.url}${ENTRY_START_PATH}`);
  start.searchParams.set("connection", handle);
  start.searchParams.set("rd", issuer.continuation);
  return start.toString();
}

/** The calls the page makes; the installation's sign-in surface by default. */
export interface SignInConnectionsApi {
  /** The enabled connections of the issuer `issuerHandle` names. */
  list(issuerHandle: string): Promise<SignInConnection[]>;
}

/** The installation's entry connection service on the sign-in surface. */
export function signInConnectionsApi(): SignInConnectionsApi {
  return {
    async list(issuerHandle) {
      const client = new EntryConnectionServiceClient(getTransport());
      const { response } = await client.listSignInConnections({ issuerHandle });
      return response.connections.map(({ handle, name }) => ({ handle, name }));
    },
  };
}

/** Options of {@link useSignInConnections}. */
export interface SignInConnectionsOptions {
  api?: SignInConnectionsApi;
  /** Leave the app for an absolute URL; defaults to `window.location.assign`. */
  leaveTo?: (url: string) => void;
}

/**
 * The sign-in page's connections and their buttons, for the authorization
 * request `rd` names at an issuer of `issuerOrigin`.
 */
export function useSignInConnections(
  rd: () => unknown,
  issuerOrigin: string,
  options: SignInConnectionsOptions = {},
) {
  const connections = ref<SignInConnection[]>([]);
  /** The handle of the connection the browser is leaving through. */
  const leaving = ref<string | null>(null);

  async function load() {
    const issuer = continuedIssuer(rd(), issuerOrigin);
    if (issuer === null) {
      connections.value = [];
      return;
    }
    try {
      connections.value = await (options.api ?? signInConnectionsApi()).list(
        issuer.handle,
      );
    } catch {
      // Without its connections the page still signs in locally.
      connections.value = [];
    }
  }

  /**
   * Leave through the connection `handle`, one of those listed. The
   * installation refuses a connection disabled since, which ends this
   * attempt.
   */
  function signInThrough(handle: string) {
    const issuer = continuedIssuer(rd(), issuerOrigin);
    if (
      issuer === null ||
      !connections.value.some((connection) => connection.handle === handle)
    ) {
      return;
    }
    leaving.value = handle;
    (options.leaveTo ?? ((url: string) => window.location.assign(url)))(
      entryStartUrl(issuer, handle),
    );
  }

  return { connections, leaving, load, signInThrough };
}
