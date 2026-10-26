// =====================================================================
// Server-side token proxy: session tokens are HttpOnly cookies.
//
// accessToken / jwtToken are HttpOnly cookies (set by our /api/auth routes, or
// by KeyForge after an external SSO sign-in): the browser holds them but our JS
// never sees them, so an XSS cannot steal them. Code that attaches
// `Authorization` itself gets a placeholder from getCookie() instead of the
// token; calls carrying it to the KeyForge backend are rerouted through
// /kfidp/api/kf/... (app/api/kf), which swaps the placeholder for the token
// from the cookie on the server and forwards to the original service.
// =====================================================================

import { BASE_PATH, withBasePath } from "@/lib/basePath";
import { getBackendOrigin } from "@/lib/backendOrigin";

/** Which cookie the proxy authorizes with: the master access token or the short-lived JWT. */
export type KfProxyAuth = "access" | "jwt";

export const KF_PROXY_PREFIX = "/api/kf";
/** Header naming the upstream origin (validated server-side: the backend origin or *.keyforge.ai). */
export const KF_UPSTREAM_HEADER = "X-KF-Upstream";
/** Header naming the token the proxy should add (KfProxyAuth). */
export const KF_AUTH_HEADER = "X-KF-Auth";

/**
 * Upstream paths that mint or hand out tokens. Never reachable through the proxy: it would sign the
 * request with the session's token and return a fresh token to page code, defeating HttpOnly.
 */
export const TOKEN_ISSUING_PATH = /(generateJWTToken|requestJWTToken|requestToken|TokenProvider|oauth\/token)/i;

/** True for https://keyforge.ai and https://*.keyforge.ai. */
export function isKeyforgeOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && (u.hostname === "keyforge.ai" || u.hostname.endsWith(".keyforge.ai"));
  } catch {
    return false;
  }
}

/** What getCookie() returns for a token cookie in a signed-in session: never the token itself. */
export const TOKEN_PLACEHOLDER: Record<KfProxyAuth, string> = {
  access: "kf-httponly-access-token",
  jwt: "kf-httponly-jwt-token",
};

export function isTokenPlaceholder(value: string | null | undefined): boolean {
  return value === TOKEN_PLACEHOLDER.access || value === TOKEN_PLACEHOLDER.jwt;
}

/** The token a request's `Authorization: Bearer <placeholder>` stands for, or null. */
function placeholderAuth(headers: Headers): KfProxyAuth | null {
  const value = headers.get("Authorization")?.replace(/^bearer\s+/i, "").trim();
  if (value === TOKEN_PLACEHOLDER.access) return "access";
  if (value === TOKEN_PLACEHOLDER.jwt) return "jwt";
  return null;
}

let httpOnlySession = false;

/** Set on sign-in / session restore: the session is valid and its tokens are HttpOnly cookies. */
export function setHttpOnlySession(value: boolean): void {
  httpOnlySession = value;
}

export function usesHttpOnlySession(): boolean {
  return httpOnlySession;
}

/**
 * Rewrites a KeyForge backend call carrying a token placeholder to go through the token proxy,
 * which adds the token the placeholder names. Returns null when the call should not be proxied
 * (no placeholder, one of our own /kfidp routes, not a KeyForge service, or a token endpoint).
 */
export function viaTokenProxy(url: string, init: RequestInit | undefined): { url: string; init: RequestInit } | null {
  if (typeof window === "undefined" || !init?.headers) return null;
  const headers = new Headers(init.headers);
  const placeholder = placeholderAuth(headers);
  if (!placeholder) return null;

  let target: URL;
  try {
    target = new URL(url, window.location.href);
  } catch {
    return null;
  }
  // The UI and the backend may share an origin (self-hosted): only /kfidp/* is ours.
  const ownRoute =
    target.origin === window.location.origin &&
    (target.pathname === BASE_PATH || target.pathname.startsWith(`${BASE_PATH}/`));
  if (ownRoute) return null;
  if (target.origin !== getBackendOrigin() && !isKeyforgeOrigin(target.origin)) return null;
  if (TOKEN_ISSUING_PATH.test(target.pathname)) return null;

  headers.delete("Authorization");
  headers.set(KF_UPSTREAM_HEADER, target.origin);
  headers.set(KF_AUTH_HEADER, placeholder);
  return { url: `${withBasePath(KF_PROXY_PREFIX)}${target.pathname}${target.search}`, init: { ...init, headers } };
}

/** Drops an `Authorization: Bearer <placeholder>` header (our own routes read the token from the cookie). */
export function withoutTokenPlaceholder(init: RequestInit | undefined): RequestInit | undefined {
  if (!init?.headers) return init;
  const headers = new Headers(init.headers);
  if (!placeholderAuth(headers)) return init;
  headers.delete("Authorization");
  return { ...init, headers };
}

/** Routes a request carrying a token placeholder: KeyForge services via the token proxy, anything else without it. */
export function routeTokenPlaceholder(
  input: RequestInfo | URL,
  init: RequestInit | undefined
): [RequestInfo | URL, RequestInit | undefined] {
  if (typeof input === "string" || input instanceof URL) {
    const proxied = viaTokenProxy(typeof input === "string" ? input : input.href, init);
    if (proxied) return [proxied.url, proxied.init];
  }
  return [input, withoutTokenPlaceholder(init)];
}
