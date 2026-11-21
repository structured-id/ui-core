import type { Router } from "vue-router";
import {
  checkBffSession,
  initAccountApi,
  initBff,
  startBffLogin,
  useAuthStore,
} from "@structured-id/ui-core";
import { consoleBase } from "#admin/base";

/**
 * Set up the console's adapter and API transports under the console's base
 * (see {@link consoleBase}): the adapter (session read, sign-in, sign-out)
 * answers there and the API calls go under `<base>api`. Call before reading
 * the session.
 */
export function setupConsoleTransports(): void {
  const base = consoleBase();
  initBff(base.slice(0, -1));
  initAccountApi({ baseUrl: `${base}api` });
}

/**
 * Read the console session and guard `router`: a page that needs a session,
 * without one, starts the installation's sign-in through the adapter and
 * comes back to the same page. The console keeps no token itself.
 */
export async function guardConsole(router: Router): Promise<void> {
  const auth = useAuthStore();
  try {
    const userInfo = await checkBffSession();
    if (userInfo) auth.setBffSession(userInfo);
  } catch {
    // Unreachable adapter: the guard below starts sign-in.
  }
  router.beforeEach((to, _from, next) => {
    if (to.meta.public || to.name === "not-found" || auth.isAuthenticated) {
      next();
      return;
    }
    startBffLogin(undefined, to.fullPath);
  });
}
