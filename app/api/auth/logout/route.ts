import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAMES_TO_CLEAR } from '@/lib/auth';

/** Clears auth cookies (including HttpOnly) on logout. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  const expired = new Date(0);

  for (const name of AUTH_COOKIE_NAMES_TO_CLEAR) {
    response.cookies.set(name, '', {
      expires: expired,
      path: '/',
      maxAge: 0,
    });
  }

  return response;
}
