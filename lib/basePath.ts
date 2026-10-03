/**
 * URL prefix the whole app is served under (Next.js `basePath`), e.g. /kfidp/ACMECOM, /kfidp/dashboard.
 * Next adds it to <Link>, router.push and redirect(); use withBasePath() for anything else:
 * window.location, fetch('/api/...'), and public asset paths passed to <img> / next/image.
 */
export const BASE_PATH = "/kfidp";

/** Prefixes an app-relative path ("/x") with BASE_PATH; leaves absolute URLs and already-prefixed paths alone. */
export function withBasePath(path: string): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return path === "/" ? BASE_PATH : `${BASE_PATH}${path}`;
}

/** Removes BASE_PATH from a browser pathname (window.location.pathname includes it; usePathname() does not). */
export function stripBasePath(pathname: string): string {
  if (pathname === BASE_PATH) return "/";
  return pathname.startsWith(`${BASE_PATH}/`) ? pathname.slice(BASE_PATH.length) : pathname;
}
