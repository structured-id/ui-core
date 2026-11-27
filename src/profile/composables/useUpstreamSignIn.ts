/**
 * Sign-in through the upstream identity providers the issuer trusts, over
 * the sign-in surface's transport. See `../upstream` for what is kept
 * between leaving for the provider and its return.
 */
import { computed, ref, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { UpstreamProviderId, required } from "@structured-id/ids";
import { getTransport } from "../../index";
import type { EnabledProviderInfo } from "@structured-id/proto/sid/v1/federation/upstream";
import { UpstreamServiceClient } from "@structured-id/proto/sid/v1/federation/upstream.client";
import {
  UPSTREAM_CALLBACK_PATH,
  rememberUpstream,
  signInEntryOfPending,
  takeUpstream,
  upstreamCallbackUri,
  type PendingUpstream,
} from "../upstream";
import { signInEntryOf, type SignInEntry } from "../signInEntry";
import { useLoginSuccess, type LoginSuccessOptions } from "./useLoginSuccess";
import { holdPendingSignIn, pendingSignIn } from "../pendingSignIn";

export type { EnabledProviderInfo };

/** A provider the issuer trusts, named by its typed id. */
export type UpstreamProvider = Omit<EnabledProviderInfo, "id"> & {
  id: UpstreamProviderId;
};

/** The calls a sign-in makes; the issuer's upstream service by default. */
export interface UpstreamApi {
  list(): Promise<UpstreamProvider[]>;
  initiate(
    provider: UpstreamProviderId,
    redirectUri: string,
  ): Promise<{ authorizationUrl: string; stateToken: string }>;
  complete(
    provider: UpstreamProviderId,
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<UpstreamOutcome>;
}

/**
 * What the issuer answered a completed return: signed in, signed in but
 * owing a second factor (kept as the tab's pending sign-in), or no Profile
 * linked to the upstream account.
 */
export type UpstreamOutcome =
  "signed-in" | "second-factor" | "linking-required";

/** The issuer's upstream service on the sign-in surface. */
export function upstreamApi(): UpstreamApi {
  const client = () => new UpstreamServiceClient(getTransport());
  return {
    async list() {
      const { response } = await client().listEnabledProviders({});
      return response.providers
        .map((provider) => ({
          ...provider,
          id: required(UpstreamProviderId, provider.id),
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder);
    },
    async initiate(provider, redirectUri) {
      const { response } = await client().initiateUpstreamAuth({
        providerId: provider.toWire(),
        redirectUri,
      });
      return response;
    },
    async complete(provider, code, state, redirectUri) {
      const { response } = await client().handleUpstreamCallback({
        providerId: provider.toWire(),
        code,
        state,
        redirectUri,
      });
      switch (response.result.oneofKind) {
        case "success":
          return holdPendingSignIn(response.result.success)
            ? "second-factor"
            : "signed-in";
        case "linkingRequired":
          return "linking-required";
        default:
          throw new Error("The issuer answered no sign-in outcome");
      }
    },
  };
}

/** Where the browser goes and what it keeps: the page's by default. */
export interface UpstreamBrowser {
  origin: string;
  storage: Storage;
  /** The app's callback page path. */
  callbackPath: string;
  leaveTo(url: string): void;
}

/** The current page, returning to `callbackPath`. */
export function pageBrowser(
  callbackPath: string = UPSTREAM_CALLBACK_PATH,
): UpstreamBrowser {
  return {
    origin: window.location.origin,
    storage: sessionStorage,
    callbackPath,
    leaveTo: (url) => window.location.assign(url),
  };
}

/** What the issuer of the request said about itself when it sent the user. */
export interface UpstreamIssuerHints {
  /** The route its ceremonies run on, if it named one. */
  route?: string;
  /** Whether it offered its federated entry. */
  federated?: boolean;
}

/**
 * Leave for `provider`, keeping the request `rd` and what its issuer said
 * about itself for the return: the issuer starts the sign-in for this
 * origin's callback page.
 */
export async function startUpstream(
  provider: UpstreamProviderId,
  rd: string | null,
  api: UpstreamApi = upstreamApi(),
  browser: UpstreamBrowser = pageBrowser(),
  issuer: UpstreamIssuerHints = {},
): Promise<void> {
  const started = await api.initiate(
    provider,
    upstreamCallbackUri(browser.origin, browser.callbackPath),
  );
  const pending: PendingUpstream = { provider, rd };
  // The hints belong to the request: without one there is nothing to keep.
  if (rd !== null) {
    if (issuer.route !== undefined) pending.route = issuer.route;
    if (issuer.federated) pending.federated = true;
  }
  rememberUpstream(browser.storage, started.stateToken, pending);
  browser.leaveTo(started.authorizationUrl);
}

/**
 * Give up the return carrying `state`, which the provider answered with an
 * error (RFC 6749 §4.1.2.1): its kept entry is taken, and the sign-in it
 * was started in, if any, is answered for signing in another way.
 */
export function abandonUpstreamEntry(
  state: string,
  browser: UpstreamBrowser = pageBrowser(),
): SignInEntry {
  const pending = takeUpstream(browser.storage, state);
  return pending ? signInEntryOfPending(pending) : {};
}

/** {@link abandonUpstreamEntry}, answering the waiting request alone. */
export function abandonUpstream(
  state: string,
  browser: UpstreamBrowser = pageBrowser(),
): string | null {
  return abandonUpstreamEntry(state, browser).rd ?? null;
}

/** How a return to the callback page ended. */
export type UpstreamReturn =
  | {
      /** `failed`: the issuer could not complete it. */
      outcome: UpstreamOutcome | "failed";
      rd: string | null;
      /** The sign-in the return was started in. */
      entry: SignInEntry;
    }
  | { outcome: "unknown" };

/**
 * Complete the return carrying `code` and `state` at the issuer: once, for
 * the sign-in this tab started. A return this tab did not start, or one
 * already completed, is `unknown`. Every other outcome, a failed one
 * included, carries the request the return waited for: its kept entry is
 * already taken.
 */
export async function completeUpstream(
  code: string,
  state: string,
  api: UpstreamApi = upstreamApi(),
  browser: UpstreamBrowser = pageBrowser(),
): Promise<UpstreamReturn> {
  const pending = takeUpstream(browser.storage, state);
  if (!pending) return { outcome: "unknown" };
  const entry = signInEntryOfPending(pending);
  try {
    const outcome = await api.complete(
      pending.provider,
      code,
      state,
      upstreamCallbackUri(browser.origin, browser.callbackPath),
    );
    return { outcome, rd: pending.rd, entry };
  } catch {
    return { outcome: "failed", rd: pending.rd, entry };
  }
}

/** Options of the upstream sign-in composables. */
export interface UpstreamSignInOptions {
  /** The app's callback page path; {@link UPSTREAM_CALLBACK_PATH} by default. */
  callbackPath?: string;
  api?: UpstreamApi;
  browser?: UpstreamBrowser;
}

/** The login page's providers and their buttons. */
export function useUpstreamSignIn(
  rd: () => string | null,
  options: UpstreamSignInOptions = {},
) {
  // Shallow: a typed id keeps its bytes in private fields, which a deep
  // reactive proxy cannot read.
  const providers = shallowRef<UpstreamProvider[]>([]);
  /** The text form of the provider the sign-in is leaving for. */
  const loading = ref<string | null>(null);
  const error = ref<string | null>(null);
  const api = () => options.api ?? upstreamApi();
  const route = useRoute();

  /**
   * What the issuer of the request `request` said about itself: this page's
   * own entry, when it is the entry of that request.
   */
  function issuerHints(request: string | null): UpstreamIssuerHints {
    const entry = signInEntryOf(route.query);
    if (request === null || entry.rd !== request) return {};
    return { route: entry.route, federated: entry.federated === "1" };
  }

  async function load() {
    try {
      providers.value = await api().list();
    } catch {
      // Without its providers the page still signs in another way.
      providers.value = [];
    }
  }

  async function signInWith(provider: UpstreamProviderId) {
    loading.value = provider.toString();
    error.value = null;
    try {
      const request = rd();
      await startUpstream(
        provider,
        request,
        api(),
        options.browser ?? pageBrowser(options.callbackPath),
        issuerHints(request),
      );
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Sign-in failed";
      loading.value = null;
    }
  }

  return { providers, loading, error, load, signInWith };
}

/** Why a return to the callback page signed nobody in. */
export type UpstreamFailure =
  /** The provider refused, or the user cancelled there. */
  | "provider-error"
  /** The return carried no code or no state. */
  | "no-return"
  /** This tab did not start the sign-in, or already completed it. */
  | "unknown"
  /** The upstream account is linked to no Profile here. */
  | "linking-required"
  /** The issuer could not complete it. */
  | "failed";

/**
 * The callback page: completes the provider's return once and continues
 * the authorization request kept for its `state` through
 * {@link useLoginSuccess}, or into the app at `redirectTo`. The callback's
 * own query is replaced first, so an `rd` added to it is never continued.
 */
export function useUpstreamCallback(
  redirectTo: string,
  options: UpstreamSignInOptions & LoginSuccessOptions = {},
) {
  const route = useRoute();
  const router = useRouter();
  const { onLoginSuccess } = useLoginSuccess(redirectTo, options);
  const failure = ref<UpstreamFailure | null>(null);
  /**
   * The sign-in a failed return was started in, to sign in another way at
   * the same issuer; empty when no request waited.
   */
  const entry = ref<SignInEntry>({});
  /** The request of {@link entry}. */
  const continued = computed(() => entry.value.rd ?? null);
  const browser = () => options.browser ?? pageBrowser(options.callbackPath);

  function text(value: unknown): string | null {
    return typeof value === "string" && value ? value : null;
  }

  async function complete() {
    const code = text(route.query.code);
    const state = text(route.query.state);
    if (text(route.query.error)) {
      if (state) entry.value = abandonUpstreamEntry(state, browser());
      failure.value = "provider-error";
      return;
    }
    if (!code || !state) {
      failure.value = "no-return";
      return;
    }
    try {
      const done = await completeUpstream(
        code,
        state,
        options.api ?? upstreamApi(),
        browser(),
      );
      if (done.outcome === "unknown") {
        failure.value = "unknown";
        return;
      }
      entry.value = done.entry;
      if (done.outcome === "linking-required" || done.outcome === "failed") {
        failure.value = done.outcome;
        return;
      }
      // What the return URL added is gone: only the kept sign-in continues.
      await router.replace({ path: route.path, query: done.entry });
      // A sign-in owing its second factor continues to the factor's page.
      await onLoginSuccess(
        done.outcome === "second-factor" ? { pending: pendingSignIn() } : {},
      );
    } catch {
      failure.value = "failed";
    }
  }

  return { failure, continued, entry, complete };
}
