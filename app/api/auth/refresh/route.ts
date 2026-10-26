import { NextRequest, NextResponse } from 'next/server';
import { mintJwt, setTokenCookies, tenantFromRequest } from '@/lib/authSession';
import { getAccessTokenFromRequest, isAccessTokenExpired, verifiedJwtClaims } from '@/lib/serverAuth';

/**
 * Issues a fresh JWT from the session's access token (both HttpOnly cookies) and stores it as the
 * jwtToken cookie. The response carries no token, only the new JWT's claims.
 */
export async function POST(request: NextRequest) {
  const accessToken = getAccessTokenFromRequest(request)?.trim();
  const tenant = tenantFromRequest(request);
  if (!accessToken || isAccessTokenExpired(accessToken) || !tenant) {
    return NextResponse.json({ ok: false, message: 'No session' }, { status: 401 });
  }
  try {
    const jwtToken = await mintJwt(request, accessToken, tenant);
    const response = NextResponse.json(
      { ok: true, claims: await verifiedJwtClaims(jwtToken) },
      { headers: { 'Cache-Control': 'no-store, private' } }
    );
    setTokenCookies(response, request, { jwtToken });
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Refresh failed' },
      { status: 401 }
    );
  }
}
