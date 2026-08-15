import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAMES } from '@/lib/auth';

/** Server-side session check (reads HttpOnly cookies the browser JS cannot). */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(COOKIE_NAMES.ACCESS_TOKEN)?.value ?? null;
  const jwtToken = request.cookies.get(COOKIE_NAMES.JWT_TOKEN)?.value ?? null;
  const uidTenant = request.cookies.get(COOKIE_NAMES.UID_TENANT)?.value ?? null;

  let user: { email?: string; tenantId?: string; userid?: string } | null = null;
  if (uidTenant) {
    try {
      user = JSON.parse(uidTenant) as { email?: string; tenantId?: string; userid?: string };
    } catch {
      user = null;
    }
  }

  return NextResponse.json({
    authenticated: !!(accessToken && jwtToken),
    hasAccessToken: !!accessToken,
    hasJwtToken: !!jwtToken,
    user,
  });
}
