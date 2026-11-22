import type { Router } from "vue-router";
import {
  checkInstallationSession,
  initInstallationSession,
  installationSignInUrl,
  installationTransport,
  useApiTransport,
  useAuthStore,
} from "@structured-id/ui-core";
import { consoleBase } from "#admin/base";

/**
 * The installation the console administers: the `installationUrl` its
 * host's `config.json` names (the console may sit on a sibling host), else
 * the page's own origin.
 */
async function installationUrl(): Promise<string> {
  try {
    const answer = await fetch(`${consoleBase()}config.json`, {
      credentials: "same-origin",
    });
    if (answer.ok) {
      const config: unknown = await answer.json();
      const named =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>).installationUrl
          : undefined;
      if (typeof named === "string" && named) return named;
    }
  } catch {
    // An unreadable configuration leaves the page's own origin.
  }
  return window.location.origin;
}

/**
 * Point the console at its installation: every API call goes to the
 * installation's `/api` in its own browser session, with the session's
 * CSRF token. Call before reading the session.
 */
export async function setupConsoleTransports(): Promise<void> {
  initInstallationSession(await installationUrl());
  useApiTransport(installationTransport());
}

/**
 * Read the installation session and guard `router`: a page that needs a
 * session, without one, sends the user to the installation's sign-in. The
 * console keeps no token itself; the installation's API decides each call
 * by the session's current authority.
 */
export async function guardConsole(router: Router): Promise<void> {
  const auth = useAuthStore();
  try {
    if (await checkInstallationSession()) auth.setInstallationSession();
  } catch {
    // Unreachable installation: the guard below sends the user to sign in.
  }
  router.beforeEach((to, _from, next) => {
    if (to.meta.public || to.name === "not-found" || auth.isAuthenticated) {
      next();
      return;
    }
    window.location.assign(installationSignInUrl());
  });
}
