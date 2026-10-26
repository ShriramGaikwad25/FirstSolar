import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAMES } from '@/lib/auth';
import { ACCESS_TOKEN_ALIASES, expireCookie, JWT_TOKEN_ALIASES, setTokenCookies } from '@/lib/authSession';

/**
 * Re-stores session tokens JS can still read as HttpOnly cookies: those an older build of this app
 * wrote from the browser, and those some SSO sign-ins leave under other names (access_token, ...).
 * The page calls this when it sees such a cookie; afterwards only HttpOnly copies remain.
 */
export async function POST(request: NextRequest) {
  const first = (names: string[]) =>
    names.map((n) => request.cookies.get(n)?.value?.trim()).find(Boolean) || undefined;
  const accessToken = first(ACCESS_TOKEN_ALIASES);
  const jwtToken = first(JWT_TOKEN_ALIASES);

  const response = NextResponse.json(
    { secured: !!(accessToken || jwtToken) },
    { headers: { 'Cache-Control': 'no-store, private' } }
  );
  for (const name of [...ACCESS_TOKEN_ALIASES, ...JWT_TOKEN_ALIASES]) {
    if (name !== COOKIE_NAMES.ACCESS_TOKEN && name !== COOKIE_NAMES.JWT_TOKEN && request.cookies.has(name)) {
      expireCookie(response, name);
    }
  }
  setTokenCookies(response, request, { accessToken, jwtToken });
  return response;
}
