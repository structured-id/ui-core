/**
 * The CE administration console as a package: an extended console (EE)
 * builds its router from `adminRoutes`, adding its own pages and menu
 * entries, and sets up the same transports and session guard.
 *
 * @example
 * ```ts
 * import { adminRoutes, guardConsole, setupConsoleTransports } from "@structured-id/ui-admin";
 *
 * const routes = adminRoutes({ pages: eePages, nav: eeNav });
 * await setupConsoleTransports();
 * await guardConsole(router);
 * ```
 */
export {
  adminRoutes,
  consolePages,
  type ConsoleExtension,
} from "./router/routes";
export { consoleNav, type AdminNavLink } from "./navigation";
export { guardConsole, setupConsoleTransports } from "./console";
export { consoleBase } from "./base";
