import { defineBoot } from "#q-app";
import { useAuthStore } from "src/stores/auth";
import { checkBffSession, startBffLogin } from "@structured-id/ui-core";

// The browser adapter holding the administrator's session answers on the
// console's own origin; the console keeps no token of its own.
const BFF = window.location.origin;

/**
 * Reads the adapter's session at start; a page needing one, without it,
 * starts the installation's sign-in and comes back to the same page.
 */
export default defineBoot(async ({ router }) => {
  const auth = useAuthStore();

  try {
    const userInfo = await checkBffSession(BFF);
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
      startBffLogin(BFF, to.fullPath);
      return;
    }
    next();
  });
});
