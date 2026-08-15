import { NextRequest, NextResponse } from 'next/server';
import { getJwtTokenFromRequest, withAuthHeader } from '@/lib/serverAuth';

export async function POST(request: NextRequest) {
  try {
    const jwtToken = getJwtTokenFromRequest(request);
    const body = await request.json();
    
    // Log the payload for debugging
    console.log('=== SCHEDULE CAMPAIGN API CALL ===');
    console.log('Payload being sent:', JSON.stringify(body, null, 2));
    console.log('JWT Token present:', !!jwtToken);
    
    const response = await fetch(
      'https://preview.keyforge.ai/kfscheduler/api/v1/ACMECOM/jobs/schedule/campaign',
      {
        method: 'POST',
        headers: withAuthHeader({
          'Content-Type': 'application/json',
          'User-Agent': 'ISPM-Scheduler/1.0',
        }, jwtToken),
        body: JSON.stringify(body)
      }
    );

    // Read the response body once
    const responseText = await response.text();
    
    console.log('API Response Status:', response.status);
    console.log('API Response Text:', responseText);
    
    if (!response.ok) {
      throw new Error(`External API error: ${response.status} ${response.statusText} - ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      data = { message: responseText, success: true };
    }
    
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Error scheduling campaign:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to schedule campaign',
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
