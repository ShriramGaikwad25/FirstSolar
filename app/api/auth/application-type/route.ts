import { NextRequest, NextResponse } from 'next/server';
import { getRegisteredAppFromCookies } from '@/lib/tenant-server';

const AUTH_BASE_URL = 'https://preview.keyforge.ai/RequestJWTToken/TokenProvider';

/** Server proxy for applicationType (avoids browser CORS). */
export async function POST(request: NextRequest) {
  let registeredAppName = await getRegisteredAppFromCookies();

  if (!registeredAppName) {
    try {
      const body = (await request.json()) as { registeredAppName?: string };
      registeredAppName = body?.registeredAppName?.trim() || null;
    } catch {
      /* empty or invalid body */
    }
  }

  if (!registeredAppName) {
    return NextResponse.json(
      {
        status: 'failed',
        statusMessage: 'Tenant required. Open the app via /YOUR_TENANT_ID (e.g. /KFPRODOCI).',
      },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${AUTH_BASE_URL}/applicationType`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registeredAppName }),
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
        statusMessage: error instanceof Error ? error.message : 'applicationType proxy failed',
      },
      { status: 502 }
    );
  }
}
