import { COOKIE_NAMES, getCookie, refreshJWTToken, forceLogout } from "@/lib/auth";

let fetchPatched = false;
let originalFetch: typeof window.fetch | null = null;

/** True when the current request is our own retry after token refresh (avoids infinite loop) */
const RETRY_HEADER = "X-Internal-Token-Retry";

function isKeyforgeRequest(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  return typeof url === "string" && url.includes("keyforge.ai");
}

function isTokenExpiredBody(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  const status = String(o.status ?? o.Status ?? "").toLowerCase();
  const msg = String(o.errorMessage ?? o.error_message ?? o.ErrorMessage ?? "").trim().toLowerCase();
  return status === "error" && msg === "token expired";
}

/**
 * Gets the original fetch function before it was patched
 * This is useful for requests that need to bypass the JWT token patch
 * Captures the original fetch on first call (before patching) or returns stored original
 */
export function getOriginalFetch(): typeof window.fetch {
  if (typeof window === "undefined") {
    throw new Error("getOriginalFetch can only be called in browser environment");
  }
  if (originalFetch) return originalFetch;
  originalFetch = window.fetch.bind(window);
  return originalFetch;
}

/**
 * Ensures that the global fetch function:
 * - Attaches the JWT bearer token when available
 * - On 401/403 or response body "Token Expired": refresh JWT using access token, retry once
 * - On refresh failure (access token expired): call logout
 * Safe to call multiple times.
 */
export function ensureAuthFetchPatched(): void {
  if (fetchPatched) return;
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;

  originalFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const isRetry = (init?.headers instanceof Headers && (init.headers as Headers).get(RETRY_HEADER) === "1") ||
      (typeof init?.headers === "object" && !Array.isArray(init?.headers) && (init.headers as Record<string, string>)[RETRY_HEADER] === "1");

    try {
      const jwtToken = getCookie(COOKIE_NAMES.JWT_TOKEN);

      if (!jwtToken && !isRetry) {
        return originalFetch!(input, init);
      }

      let headers: Headers;
      if (init?.headers instanceof Headers) {
        headers = new Headers(init.headers);
      } else if (Array.isArray(init?.headers)) {
        headers = new Headers(init.headers);
      } else if (init?.headers && typeof init?.headers === "object") {
        headers = new Headers(init.headers as Record<string, string>);
      } else {
        headers = new Headers();
      }
      headers.delete(RETRY_HEADER);

      if (!headers.has("Authorization") && jwtToken) {
        headers.set("Authorization", `Bearer ${jwtToken}`);
      }

      const nextInit: RequestInit = { ...init, headers };

      const promise = originalFetch!(input, nextInit);

      if (isRetry || !isKeyforgeRequest(input)) {
        return promise;
      }

      return promise.then(async (response) => {
        const doRefreshAndRetry = async (): Promise<Response> => {
          const ok = await refreshJWTToken();
          if (!ok) {
            forceLogout("Token refresh failed - access token expired");
            return response;
          }
          const newJwt = getCookie(COOKIE_NAMES.JWT_TOKEN);
          const newHeaders = new Headers(nextInit.headers as Headers);
          newHeaders.set("Authorization", `Bearer ${newJwt}`);
          newHeaders.set(RETRY_HEADER, "1");
          return originalFetch!(input, { ...nextInit, headers: newHeaders });
        };

        if (response.status === 401 || response.status === 403) {
          return doRefreshAndRetry();
        }

        const cloned = response.clone();
        let text: string;
        try {
          text = await cloned.text();
        } catch {
          return response;
        }
        try {
          const data = JSON.parse(text) as unknown;
          if (isTokenExpiredBody(data)) {
            return doRefreshAndRetry();
          }
        } catch {
          // not JSON or other parse error
        }
        return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
      });
    } catch (error) {
      console.error("Error in auth fetch patch:", error);
      return originalFetch!(input, init);
    }
  }) as typeof window.fetch;

  fetchPatched = true;
}

