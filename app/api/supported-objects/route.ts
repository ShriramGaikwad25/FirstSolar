import { NextRequest, NextResponse } from 'next/server';
import { getAccessTokenFromRequest, getTenantIdFromRequest, withRegisterScimAuthHeader, withTenantHeader } from '@/lib/serverAuth';
import { mergeSupportedObjectsExtensions } from '@/lib/supported-objects-extensions';

export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessTokenFromRequest(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Failed to fetch supported objects', message: 'No access token available' },
        { status: 401 }
      );
    }

    const supportedObjectsUrl = `https://preview.keyforge.ai/registerscimapp/registerfortenant/${encodeURIComponent(getTenantIdFromRequest(request))}/getAllSupportedObjects`;

    const response = await fetch(supportedObjectsUrl, {
      method: 'GET',
      headers: withTenantHeader(
        withRegisterScimAuthHeader(
          {
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'ISPM-App/1.0',
          },
          request
        ),
        request
      ),
    });

    const text = await response.text();

    if (!response.ok) {
      console.error('supported-objects: external API error:', response.status, text);
      throw new Error(`External API error: ${response.status} ${response.statusText} - ${text}`);
    }

    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text };
    }

    data = mergeSupportedObjectsExtensions(data);

    return NextResponse.json(data, {
      status: 200,
    });
  } catch (error) {
    console.error('supported-objects: GET handler error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch supported objects',
      },
      {
        status: 500,
      }
    );
  }
}
