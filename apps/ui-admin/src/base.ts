/**
 * The path the console is served under, with a trailing slash: `/admin/` in
 * the quick start, another prefix, or `/` at the root of an admin host. The
 * UI host names it in the shell's `<base href>` from the installation's
 * console address, so one build serves every placement; without one (the
 * development server) the console is at the root.
 */
export function consoleBase(): string {
  const href = document.querySelector("base")?.getAttribute("href");
  if (!href) return "/";
  const path = new URL(href, window.location.origin).pathname;
  return path.endsWith("/") ? path : `${path}/`;
}
