import { NextRequest, NextResponse } from 'next/server';
import { getJwtTokenFromRequest, withAuthHeader } from '@/lib/serverAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobName: string } }
) {
  try {
    const jwtToken = getJwtTokenFromRequest(request);
    const { jobName } = params;
    
    // Decode URL-encoded parameter
    const decodedJobName = decodeURIComponent(jobName);
    
    const response = await fetch(
      `https://preview.keyforge.ai/kfscheduler/api/v1/ACMECOM/jobs/campaign/${decodedJobName}`,
      {
        method: 'GET',
        headers: withAuthHeader({
          'Content-Type': 'application/json',
          'User-Agent': 'ISPM-Scheduler/1.0',
        }, jwtToken),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`External API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Error fetching campaign job details:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch campaign job details',
        message: error instanceof Error ? error.message : 'Unknown error'
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

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
