import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAMES } from '@/lib/auth';
import { checkJwt, isAccessTokenExpired, verifiedJwtClaims } from '@/lib/serverAuth';

/**
 * Server-side session check (reads HttpOnly cookies the browser JS cannot). A signed-in session
 * also gets the JWT's claims (user id, roles, tenant), which the page cannot decode itself.
 */
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

  // Presence alone is not a session: jwtToken must be a well-formed KeyForge token (correctly
  // signed when KF_JWT_SECRET is set) and accessToken unexpired. An expired jwtToken is fine —
  // the client refreshes it from accessToken.
  const jwtCheck = await checkJwt(jwtToken);
  const tampered = !!jwtToken && jwtCheck === 'invalid';
  const authenticated =
    !!accessToken && !isAccessTokenExpired(accessToken) && !!jwtToken && jwtCheck !== 'invalid';

  const response = NextResponse.json(
    {
      authenticated,
      hasAccessToken: !!accessToken,
      hasJwtToken: !!jwtToken,
      user: authenticated ? user : null,
      claims: authenticated ? await verifiedJwtClaims(jwtToken) : null,
    },
    { headers: { 'Cache-Control': 'no-store, private' } }
  );
  if (tampered) {
    for (const name of [COOKIE_NAMES.ACCESS_TOKEN, COOKIE_NAMES.JWT_TOKEN]) {
      response.cookies.set(name, '', { path: '/', maxAge: 0 });
    }
  }
  return response;
}
