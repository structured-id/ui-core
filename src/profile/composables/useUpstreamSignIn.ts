/**
 * Sign-in through the upstream identity providers the issuer trusts, over
 * the sign-in surface's transport. See `../upstream` for what is kept
 * between leaving for the provider and its return.
 */
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getTransport } from "../../index";
import type { EnabledProviderInfo } from "@structured-id/proto/sid/v1/federation/upstream";
import { UpstreamServiceClient } from "@structured-id/proto/sid/v1/federation/upstream.client";
import {
  UPSTREAM_CALLBACK_PATH,
  rememberUpstream,
  takeUpstream,
  upstreamCallbackUri,
} from "../upstream";
import { useLoginSuccess, type LoginSuccessOptions } from "./useLoginSuccess";

export type { EnabledProviderInfo };

/** The calls a sign-in makes; the issuer's upstream service by default. */
export interface UpstreamApi {
  list(): Promise<EnabledProviderInfo[]>;
  initiate(
    provider: string,
    redirectUri: string,
  ): Promise<{ authorizationUrl: string; stateToken: string }>;
  complete(
    provider: string,
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<"signed-in" | "linking-required">;
}

/** The issuer's upstream service on the sign-in surface. */
export function upstreamApi(): UpstreamApi {
  const client = () => new UpstreamServiceClient(getTransport());
  return {
    async list() {
      const { response } = await client().listEnabledProviders({});
      return [...response.providers].sort(
        (a, b) => a.displayOrder - b.displayOrder,
      );
    },
    async initiate(provider, redirectUri) {
      const { response } = await client().initiateUpstreamAuth({
        providerId: provider,
        redirectUri,
      });
      return response;
    },
    async complete(provider, code, state, redirectUri) {
      const { response } = await client().handleUpstreamCallback({
        providerId: provider,
        code,
        state,
        redirectUri,
      });
      switch (response.result.oneofKind) {
        case "success":
          return "signed-in";
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

/**
 * Leave for `provider`, keeping the request `rd` for the return: the issuer
 * starts the sign-in for this origin's callback page.
 */
export async function startUpstream(
  provider: string,
  rd: string | null,
  api: UpstreamApi = upstreamApi(),
  browser: UpstreamBrowser = pageBrowser(),
): Promise<void> {
  const started = await api.initiate(
    provider,
    upstreamCallbackUri(browser.origin, browser.callbackPath),
  );
  rememberUpstream(browser.storage, started.stateToken, { provider, rd });
  browser.leaveTo(started.authorizationUrl);
}

/**
 * Give up the return carrying `state`, which the provider answered with an
 * error (RFC 6749 §4.1.2.1): its kept entry is taken, and the request it
 * waited for, if any, is answered for signing in another way.
 */
export function abandonUpstream(
  state: string,
  browser: UpstreamBrowser = pageBrowser(),
): string | null {
  return takeUpstream(browser.storage, state)?.rd ?? null;
}

/** How a return to the callback page ended. */
export type UpstreamReturn =
  | {
      /** `failed`: the issuer could not complete it. */
      outcome: "signed-in" | "linking-required" | "failed";
      rd: string | null;
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
  try {
    const outcome = await api.complete(
      pending.provider,
      code,
      state,
      upstreamCallbackUri(browser.origin, browser.callbackPath),
    );
    return { outcome, rd: pending.rd };
  } catch {
    return { outcome: "failed", rd: pending.rd };
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
  const providers = ref<EnabledProviderInfo[]>([]);
  const loading = ref<string | null>(null);
  const error = ref<string | null>(null);
  const api = () => options.api ?? upstreamApi();

  async function load() {
    try {
      providers.value = await api().list();
    } catch {
      // Without its providers the page still signs in another way.
      providers.value = [];
    }
  }

  async function signInWith(provider: string) {
    loading.value = provider;
    error.value = null;
    try {
      await startUpstream(
        provider,
        rd(),
        api(),
        options.browser ?? pageBrowser(options.callbackPath),
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
  /** The request a failed return still waits for, to sign in another way. */
  const continued = ref<string | null>(null);
  const browser = () => options.browser ?? pageBrowser(options.callbackPath);

  function text(value: unknown): string | null {
    return typeof value === "string" && value ? value : null;
  }

  async function complete() {
    const code = text(route.query.code);
    const state = text(route.query.state);
    if (text(route.query.error)) {
      if (state) continued.value = abandonUpstream(state, browser());
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
      continued.value = done.rd;
      if (done.outcome !== "signed-in") {
        failure.value = done.outcome;
        return;
      }
      await router.replace({
        path: route.path,
        query: done.rd ? { rd: done.rd } : {},
      });
      await onLoginSuccess();
    } catch {
      failure.value = "failed";
    }
  }

  return { failure, continued, complete };
}
