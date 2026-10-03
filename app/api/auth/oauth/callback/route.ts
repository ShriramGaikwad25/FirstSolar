import { NextRequest, NextResponse } from 'next/server';
import { getRegisteredAppFromCookies } from '@/lib/tenant-server';
import { getBackendOriginFromRequest } from '@/lib/serverAuth';

const authBaseUrl = (request: NextRequest) =>
  `${getBackendOriginFromRequest(request)}/RequestJWTToken/TokenProvider`;

/** Server proxy for OAuth code exchange (avoids browser CORS). */
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
    return new NextResponse(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
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
