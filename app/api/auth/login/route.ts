import { NextRequest, NextResponse } from 'next/server';
import { mintJwt, setTokenCookies } from '@/lib/authSession';
import { getBackendOriginFromRequest, verifiedJwtClaims } from '@/lib/serverAuth';

/**
 * Password sign-in. Exchanges the credentials for an access token and a JWT on the server and
 * stores both as HttpOnly cookies; the response carries no token, only the user's id and the
 * JWT's claims.
 */
export async function POST(request: NextRequest) {
  let body: { userid?: string; password?: string; tenantId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: 'failed', statusMessage: 'Invalid request' }, { status: 400 });
  }
  const userid = body?.userid?.trim();
  const tenantId = body?.tenantId?.trim();
  if (!userid || !body.password || !tenantId) {
    return NextResponse.json(
      { status: 'failed', statusMessage: 'User id, password and tenant are required' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${getBackendOriginFromRequest(request)}/RequestJWTToken/TokenProvider/requestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestToken: { registeredAppName: tenantId, userid, password: body.password } }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    const tokenResponse = data?.tokenResponse;
    const failed =
      !response.ok ||
      data?.status === 'failed' ||
      data?.status === 'error' ||
      tokenResponse?.status === 'failed' ||
      tokenResponse?.status === 'error';
    const accessToken = String(tokenResponse?.accessToken ?? '').trim();
    if (failed || !accessToken) {
      return NextResponse.json(
        { status: 'failed', statusMessage: data?.statusMessage || 'Authentication failed' },
        { status: 401 }
      );
    }

    const jwtToken = await mintJwt(request, accessToken, tenantId);
    const userUniqueID = String(tokenResponse?.userUniqueID ?? '').trim() || undefined;
    const result = NextResponse.json(
      { status: 'success', userUniqueID, claims: await verifiedJwtClaims(jwtToken) },
      { headers: { 'Cache-Control': 'no-store, private' } }
    );
    setTokenCookies(result, request, { accessToken, jwtToken });
    return result;
  } catch (error) {
    return NextResponse.json(
      { status: 'failed', statusMessage: error instanceof Error ? error.message : 'Sign-in failed' },
      { status: 502 }
    );
  }
}
