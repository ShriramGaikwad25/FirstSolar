import { NextRequest, NextResponse } from 'next/server';
import { getJwtTokenFromRequest, getTenantIdFromRequest, withAuthHeader, withTenantHeader } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
  try {
    const jwtToken = getJwtTokenFromRequest(request);
    const externalUrl = `https://preview.keyforge.ai/reports/api/v1/${encodeURIComponent(getTenantIdFromRequest(request))}/getallsignature`;
    const response = await fetch(externalUrl, {
      method: 'GET',
      headers: withTenantHeader(
        withAuthHeader(
          {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'ISPM-App/1.0',
          },
          jwtToken
        ),
        request
      ),
    });

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch signatures', message: response.statusText },
        { status: response.status }
      );
    }

    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route [getallsignature]:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch signatures',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
