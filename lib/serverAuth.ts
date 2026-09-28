import { NextRequest } from "next/server";
import { COOKIE_NAMES } from "@/lib/auth";
import { REGISTERED_APP_COOKIE } from "@/lib/tenant";
import { tenantId as defaultTenantId } from "@/lib/config";

export function getJwtTokenFromRequest(request: NextRequest): string | null {
  try {
    return request.cookies.get(COOKIE_NAMES.JWT_TOKEN)?.value ?? null;
  } catch {
    return null;
  }
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
    return (
      request.cookies.get(REGISTERED_APP_COOKIE)?.value?.trim() ||
      defaultTenantId?.trim() ||
      "ACMECOM"
    );
  } catch {
    return defaultTenantId?.trim() || "ACMECOM";
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

