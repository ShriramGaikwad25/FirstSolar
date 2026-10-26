import { NextRequest, NextResponse } from 'next/server';
import { getRegisteredAppFromCookies } from '@/lib/tenant-server';
import { getBackendOriginFromRequest, verifiedJwtClaims } from '@/lib/serverAuth';
import { mintJwt, setTokenCookies } from '@/lib/authSession';

const authBaseUrl = (request: NextRequest) =>
  `${getBackendOriginFromRequest(request)}/RequestJWTToken/TokenProvider`;

/**
 * OAuth code exchange on the server (avoids browser CORS). On success the tokens are stored as
 * HttpOnly cookies and the page gets only the user's ids and the JWT's claims, never a token.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim();
  const state = request.nextUrl.searchParams.get('state')?.trim();
  let registeredAppName = await getRegisteredAppFromCookies();
  if (!registeredAppName) {
    registeredAppName = request.nextUrl.searchParams.get('registeredAppName')?.trim() || null;
  }

  if (!code || !state) {
    return NextResponse.json(
      { status: 'failed', statusMessage: 'Missing code or state' },
      { status: 400 }
    );
  }

  if (!registeredAppName) {
    return NextResponse.json(
      { status: 'failed', statusMessage: 'Tenant required in cookie' },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams({
      code,
      state,
      registeredAppName,
    });
    const response = await fetch(`${authBaseUrl(request)}/oauth/callback?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json', 'X-Tenant-Id': registeredAppName },
      cache: 'no-store',
    });

    const text = await response.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      /* not JSON: passed back as-is below */
    }
    const tokenResponse =
      data?.tokenResponse && typeof data.tokenResponse === 'object'
        ? (data.tokenResponse as Record<string, unknown>)
        : null;
    const accessToken = String(tokenResponse?.accessToken ?? data?.accessToken ?? '').trim();
    const failed = data?.status === 'failed' || data?.status === 'error' || data?.STATUS === 'FAILED';
    if (!response.ok || !data || failed || !accessToken) {
      // Error answers carry no token; pass them back for the page to show.
      return new NextResponse(text, {
        status: response.ok && !accessToken ? 502 : response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Store the tokens as HttpOnly cookies; the page gets only the user's ids and claims.
    const jwtToken = await mintJwt(request, accessToken, registeredAppName);
    const userUniqueID = String(tokenResponse?.userUniqueID ?? data.userUniqueID ?? '').trim() || undefined;
    const userid = String(tokenResponse?.userid ?? data.userid ?? userUniqueID ?? '').trim() || undefined;
    const result = NextResponse.json(
      { status: 'success', userUniqueID, userid, claims: await verifiedJwtClaims(jwtToken) },
      { headers: { 'Cache-Control': 'no-store, private' } }
    );
    setTokenCookies(result, request, { accessToken, jwtToken });
    return result;
  } catch (error) {
    return NextResponse.json(
      {
        status: 'failed',
        statusMessage: error instanceof Error ? error.message : 'oauth callback proxy failed',
      },
      { status: 502 }
    );
  }
}
