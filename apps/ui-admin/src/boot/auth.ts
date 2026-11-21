import { defineBoot } from "#q-app";
import { useAuthStore } from "src/stores/auth";
import { checkBffSession, startBffLogin } from "@structured-id/ui-core";

/**
 * Reads the console's session from its browser adapter (set up by the grpc
 * boot) at start; a page needing one, without it, starts the installation's
 * sign-in and comes back to the same page. The console keeps no token.
 */
export default defineBoot(async ({ router }) => {
  const auth = useAuthStore();

  try {
    const userInfo = await checkBffSession();
    if (userInfo) {
      auth.setBffSession(userInfo);
    }
  } catch {
    // Unreachable adapter: the guard below starts sign-in.
  }

  router.beforeEach((to, _from, next) => {
    if (to.meta.public || to.name === "not-found") {
      next();
      return;
    }
    if (!auth.isAuthenticated) {
      startBffLogin(undefined, to.fullPath);
      return;
    }
    next();
  });
});
