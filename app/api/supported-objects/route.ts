import { NextRequest, NextResponse } from 'next/server';
import { getAccessTokenFromRequest, withRegisterScimAuthHeader } from '@/lib/serverAuth';
import { mergeSupportedObjectsExtensions } from '@/lib/supported-objects-extensions';

const SUPPORTED_OBJECTS_URL =
  'https://preview.keyforge.ai/registerscimapp/registerfortenant/ACMECOM/getAllSupportedObjects';

export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessTokenFromRequest(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Failed to fetch supported objects', message: 'No access token available' },
        { status: 401 }
      );
    }

    const response = await fetch(SUPPORTED_OBJECTS_URL, {
      method: 'GET',
      headers: withRegisterScimAuthHeader(
        {
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'ISPM-App/1.0',
        },
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
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('supported-objects: GET handler error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch supported objects',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
