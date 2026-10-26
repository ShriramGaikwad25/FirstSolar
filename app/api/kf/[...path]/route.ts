import { NextRequest, NextResponse } from "next/server";
import { getAccessTokenFromRequest, getBackendOriginFromRequest, getJwtTokenFromRequest } from "@/lib/serverAuth";
import { isKeyforgeOrigin, KF_AUTH_HEADER, KF_UPSTREAM_HEADER, TOKEN_ISSUING_PATH } from "@/lib/kfProxy";

// Token proxy: session tokens are HttpOnly cookies (see lib/kfProxy.ts).
// The browser calls /kfidp/api/kf/<service path> with X-KF-Upstream (the
// service's origin) and X-KF-Auth (access | jwt); this adds Authorization from
// that cookie and forwards to <origin>/<service path>. Only the backend origin
// and https://*.keyforge.ai are allowed upstreams, so this is not an open proxy.

/**
 * Request headers never passed to the upstream service: the browser's cookies (the token is added
 * from them here instead), hop-by-hop and browser-set headers, and the proxy's own X-KF-* headers.
 * Everything else (X-Tenant-Id, loginremote_user, ...) goes through as the caller set it.
 */
const DROPPED_HEADERS = new Set([
  "authorization", "cookie", "host", "connection", "keep-alive", "transfer-encoding", "content-length",
  "accept-encoding", "origin", "referer", "x-internal-token-retry",
]);
const DROPPED_HEADER_PREFIXES = ["x-kf-", "sec-", "x-forwarded-", "x-real-ip"];
/** Response headers passed back to the browser. */
const RETURNED_HEADERS = ["content-type", "content-disposition"];

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathSegments } = await params;
  const path = (pathSegments ?? []).map(encodeURIComponent).join("/");

  const backendOrigin = getBackendOriginFromRequest(request);
  const requested = request.headers.get(KF_UPSTREAM_HEADER)?.trim().replace(/\/+$/, "") || backendOrigin;
  if (requested !== backendOrigin && !isKeyforgeOrigin(requested)) {
    return NextResponse.json({ error: "bad_upstream", message: `Upstream not allowed: ${requested}` }, { status: 400 });
  }
  if (TOKEN_ISSUING_PATH.test(path)) {
    return NextResponse.json({ error: "forbidden_path", message: "Token endpoints are not available through the proxy" }, { status: 403 });
  }
  const url = `${requested}/${path}${request.nextUrl.search}`;

  const headers = new Headers();
  request.headers.forEach((value, name) => {
    const n = name.toLowerCase();
    if (DROPPED_HEADERS.has(n) || DROPPED_HEADER_PREFIXES.some((p) => n.startsWith(p))) return;
    headers.set(name, value);
  });
  // The caller's Authorization is only ever a placeholder: the token always comes from the cookie.
  const token = request.headers.get(KF_AUTH_HEADER)?.toLowerCase() === "access"
    ? getAccessTokenFromRequest(request)
    : getJwtTokenFromRequest(request);
  if (token) headers.set("authorization", `Bearer ${token}`);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    });
    const body = await upstream.arrayBuffer();
    const responseHeaders = new Headers({ "Cache-Control": "no-store, private" });
    for (const name of RETURNED_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new NextResponse(body.byteLength ? body : null, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: "upstream_unreachable", message: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
