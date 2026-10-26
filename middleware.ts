import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEV_BACKEND_ORIGIN, getConfiguredBackendOrigin } from "@/lib/backendOrigin";

/**
 * Content-Security-Policy. Scripts run only with this request's nonce (Next.js adds it to its own
 * scripts) or when loaded by such a script ('strict-dynamic'); inline scripts and on* handler
 * attributes are blocked, so injected markup cannot run code. Dev keeps 'unsafe-eval' for
 * React Refresh. style-src keeps 'unsafe-inline': the UI relies on inline styles throughout.
 * The other security headers are set in next.config.ts.
 */
export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === "development";
  // The browser talks to this origin, KeyForge services and the configured backend.
  const backend = getConfiguredBackendOrigin() || (isDev ? DEV_BACKEND_ORIGIN : "");
  const csp =
    "default-src 'self'; " +
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}; ` +
    // globals.css imports the Inter stylesheet from Google Fonts.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https:; " +
    `connect-src 'self' https://*.keyforge.ai${backend ? ` ${backend}` : ""}; ` +
    "object-src 'none'; frame-ancestors 'self'; base-uri 'self'";

  // Next.js reads the nonce from the request's CSP header when rendering the page.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = { matcher: "/:path*" };
