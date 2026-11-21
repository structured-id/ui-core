import type { Router } from "vue-router";
import {
  checkBffSession,
  initAccountApi,
  initBff,
  startBffLogin,
  useAuthStore,
} from "@structured-id/ui-core";

/**
 * The console's mount: its browser adapter (session read, sign-in and
 * sign-out) answers here and its API calls go under `<mount>/api`. The
 * installation's sign-in surface keeps `/api` on the same origin.
 */
export const CONSOLE_MOUNT = "/admin";

/** Set up the console's adapter and API transports; call before reading the session. */
export function setupConsoleTransports(mount: string = CONSOLE_MOUNT): void {
  initBff(mount);
  initAccountApi({ baseUrl: `${mount}/api` });
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
