import { defineBoot } from "#q-app";
import { initAccountApi, initBff } from "@structured-id/ui-core";

/**
 * The console's browser adapter and API are served under its own mount
 * (`/admin/api`): the adapter holds the administrator's session and adds the
 * bearer, the page sends its cookie and the session's CSRF token. The
 * installation's own sign-in surface keeps `/api` on the same origin.
 */
export const CONSOLE_MOUNT = "/admin";

export default defineBoot(() => {
  initBff(CONSOLE_MOUNT);
  initAccountApi({ baseUrl: `${CONSOLE_MOUNT}/api` });
});
