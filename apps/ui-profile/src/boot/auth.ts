import { defineBoot } from "#q-app";
import {
  checkBffSession,
  startBffLogin,
  useAuthStore,
} from "@structured-id/ui-core";

/**
 * Reads the account session at start. A self-service page without one
 * starts sign-in through the account adapter and comes back to the same
 * page; the ceremony pages need no account session.
 */
export default defineBoot(async ({ router }) => {
  const auth = useAuthStore();

  try {
    const userInfo = await checkBffSession();
    if (userInfo) auth.setBffSession(userInfo);
  } catch {
    // Unreachable adapter: a self-service page starts sign-in below.
  }

  router.beforeEach((to, _from, next) => {
    if (to.matched.some((r) => r.meta.public) || auth.isAuthenticated) {
      next();
      return;
    }
    startBffLogin(undefined, to.fullPath);
  });
});
