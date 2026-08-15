import { NextRequest, NextResponse } from "next/server";
import { getJwtTokenFromRequest, withAuthHeader } from "@/lib/serverAuth";

const KEYFORGE_CERT_BASE =
  "https://preview.keyforge.ai/certification/api/v1/ACMECOM";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const path = pathSegments?.join("/") ?? "";
    if (!path) {
      return NextResponse.json(
        { error: "Missing path", message: "Certification path is required" },
        { status: 400 }
      );
    }

    const jwtToken = getJwtTokenFromRequest(request);
    if (!jwtToken) {
      return NextResponse.json(
        { error: "Unauthorized", message: "JWT token is required" },
        { status: 401 }
      );
    }

    const url = `${KEYFORGE_CERT_BASE}/${path}`;
    let body: string | undefined;
    try {
      body = await request.text();
    } catch {
      body = undefined;
    }

    const headers = withAuthHeader(
      {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      jwtToken
    ) as Record<string, string>;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: body || undefined,
    });

    const text = await response.text();
    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = JSON.parse(text);
      } catch {
        errorData = { message: text };
      }
      return NextResponse.json(errorData, {
        status: response.status,
        headers: corsHeaders(),
      });
    }

    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: corsHeaders(),
    });
  } catch (error) {
    console.error("Certification proxy error:", error);
    return NextResponse.json(
      {
        error: "Proxy failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
