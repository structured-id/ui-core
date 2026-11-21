import { defineBoot } from "#q-app";
import { initAccountApi, initBff, initGrpc } from "@structured-id/ui-core";

/**
 * Two surfaces on the page's own origin:
 * - the installation's sign-in surface at `/api`, where the ceremonies run
 *   and the issuer's session cookie lives;
 * - the account pages' browser adapter and API under their own mount
 *   (`/account/api`), which hold the account session and add its bearer;
 *   the page sends its cookie and the session's CSRF token.
 */
export const ACCOUNT_MOUNT = "/account";

export default defineBoot(() => {
  initGrpc({ baseUrl: `${window.location.origin}/api` });
  initBff(ACCOUNT_MOUNT);
  initAccountApi({ baseUrl: `${ACCOUNT_MOUNT}/api` });
});
