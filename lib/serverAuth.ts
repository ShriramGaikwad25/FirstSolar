import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAMES } from "@/lib/auth";
import { REGISTERED_APP_COOKIE } from "@/lib/tenant";
import { DEV_BACKEND_ORIGIN, getConfiguredBackendOrigin } from "@/lib/backendOrigin";

export type JwtCheck = "ok" | "expired" | "invalid";

function base64UrlDecode(part: string): Uint8Array {
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Server-side check of the KeyForge jwtToken: well-formed, signed (alg not "none"), not
 * expired, and, when KF_JWT_SECRET is set, a valid HS256 signature. Without the secret a
 * forged-but-well-formed token still passes; the gateway remains the authority for every API call.
 */
export async function checkJwt(token: string | null | undefined): Promise<JwtCheck> {
  const parts = token?.split(".");
  if (!parts || parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return "invalid";
  let header: { alg?: string };
  let payload: { exp?: number };
  try {
    const text = new TextDecoder();
    header = JSON.parse(text.decode(base64UrlDecode(parts[0])));
    payload = JSON.parse(text.decode(base64UrlDecode(parts[1])));
  } catch {
    return "invalid";
  }
  if (!header.alg || header.alg.toLowerCase() === "none") return "invalid";

  const secret = process.env.KF_JWT_SECRET?.trim();
  if (secret) {
    if (header.alg !== "HS256") return "invalid";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(parts[2]).buffer as ArrayBuffer,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!ok) return "invalid";
  }

  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) return "expired";
  return "ok";
}

/**
 * The payload claims of a session jwtToken, for the page (it cannot read the HttpOnly cookie).
 * Null unless checkJwt accepts the token; an expired one still yields its claims.
 */
export async function verifiedJwtClaims(token: string | null | undefined): Promise<Record<string, unknown> | null> {
  if (!token || (await checkJwt(token)) === "invalid") return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(token.split(".")[1]))) as unknown;
    return claims && typeof claims === "object" && !Array.isArray(claims) ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The access token may be KeyForge's JWT or, after an external SSO sign-in, a provider token in
 * another format, so only its expiry is checked, and only when it decodes as a JWT.
 */
export function isAccessTokenExpired(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]))) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

export function getJwtTokenFromRequest(request: NextRequest): string | null {
  try {
    return request.cookies.get(COOKIE_NAMES.JWT_TOKEN)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns a 401 response when the caller has no session JWT, otherwise null.
 * Use at the top of route handlers that act with server-held credentials.
 */
export function requireSession(request: NextRequest): NextResponse | null {
  if (getJwtTokenFromRequest(request)) return null;
  return NextResponse.json({ error: "Unauthorized", message: "Sign in required" }, { status: 401 });
}

/** Master access token used by registerscimapp / schemamapper endpoints (not JWT). */
export function getAccessTokenFromRequest(request: NextRequest): string | null {
  try {
    return request.cookies.get(COOKIE_NAMES.ACCESS_TOKEN)?.value ?? null;
  } catch {
    return null;
  }
}

export function withAuthHeader(
  headers: HeadersInit | undefined,
  jwtToken: string | null
): HeadersInit | undefined {
  if (!jwtToken) {
    return headers;
  }

  const headerBag = new Headers(headers ?? undefined);

  if (!headerBag.has("Authorization")) {
    headerBag.set("Authorization", `Bearer ${jwtToken}`);
  }

  return headerBag;
}

/** Authorization for registerscimapp APIs — prefers access token over JWT. */
export function withRegisterScimAuthHeader(
  headers: HeadersInit | undefined,
  request: NextRequest
): HeadersInit {
  const accessToken = getAccessTokenFromRequest(request);
  const headerBag = new Headers(headers ?? undefined);
  if (accessToken) {
    headerBag.set("Authorization", `Bearer ${accessToken}`);
  }
  return headerBag;
}

/** Resolves the caller's tenant from the incoming request's registeredAppName cookie. */
export function getTenantIdFromRequest(request: NextRequest): string {
  try {
    return request.cookies.get(REGISTERED_APP_COOKIE)?.value?.trim() || "";
  } catch {
    return "";
  }
}

/** Attaches X-Tenant-Id (resolved from the incoming request) for the outbound KeyForge call. */
export function withTenantHeader(
  headers: HeadersInit | undefined,
  request: NextRequest
): HeadersInit {
  const headerBag = new Headers(headers ?? undefined);
  if (!headerBag.has("X-Tenant-Id")) {
    headerBag.set("X-Tenant-Id", getTenantIdFromRequest(request));
  }
  return headerBag;
}


/**
 * Backend origin for server-side calls: NEXT_PUBLIC_BACKEND_ORIGIN when set (e.g. Vercel), DEV_BACKEND_ORIGIN under
 * `npm run dev`, otherwise the host the user typed (from the proxy's X-Forwarded-* headers or Host), without /kfidp.
 */
export function getBackendOriginFromRequest(request: NextRequest): string {
  const configured = getConfiguredBackendOrigin();
  if (configured) return configured;
  if (process.env.NODE_ENV === "development") return DEV_BACKEND_ORIGIN;
  const first = (v: string | null) => v?.split(",")[0]?.trim() || "";
  const proto = first(request.headers.get("x-forwarded-proto")) || request.nextUrl.protocol.replace(/:$/, "");
  const host = first(request.headers.get("x-forwarded-host")) || first(request.headers.get("host")) || request.nextUrl.host;
  return `${proto}://${host}`;
}
