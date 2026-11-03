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

  const tokenUrl = `${getBackendOriginFromRequest(request)}/RequestJWTToken/TokenProvider/requestToken`;
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestToken: { registeredAppName: tenantId, userid, password: body.password } }),
      cache: 'no-store',
    });
    const rawText = await response.text();
    let data: Record<string, any> | null = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }
    const tokenResponse = data?.tokenResponse;
    const failed =
      !response.ok ||
      data?.status === 'failed' ||
      data?.status === 'error' ||
      tokenResponse?.status === 'failed' ||
      tokenResponse?.status === 'error';
    const accessToken = String(tokenResponse?.accessToken ?? '').trim();
    if (failed || !accessToken) {
      // Server log only (never the password): shows whether the backend refused the credentials
      // or the call went to the wrong place (redirect, HTML error page, wrong origin).
      console.error(
        `Sign-in failed: POST ${tokenUrl} -> ${response.status}${response.redirected ? ` (redirected to ${response.url})` : ''}: ${rawText.slice(0, 300)}`
      );
      const statusMessage =
        data?.statusMessage ||
        tokenResponse?.statusMessage ||
        (data ? 'Authentication failed' : `Sign-in service returned ${response.status} (not JSON)`);
      return NextResponse.json({ status: 'failed', statusMessage }, { status: 401 });
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
    // fetch() only says "fetch failed"; the cause names the real problem (refused, DNS, untrusted certificate).
    const cause = error instanceof Error ? (error.cause as { code?: string; message?: string } | undefined) : undefined;
    const message = error instanceof Error ? error.message : 'Sign-in failed';
    const detail = cause?.code || cause?.message;
    console.error(`Sign-in failed: POST ${tokenUrl} -> ${message}${detail ? ` (${detail})` : ''}`);
    return NextResponse.json(
      { status: 'failed', statusMessage: detail ? `${message} (${detail})` : message },
      { status: 502 }
    );
  }
}
