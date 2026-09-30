import { NextRequest, NextResponse } from "next/server";
import { getJwtTokenFromRequest, getTenantIdFromRequest, withAuthHeader, withTenantHeader } from "@/lib/serverAuth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    // Reject dot segments and re-encode each segment so callers cannot climb out of the
    // certification API prefix on the upstream host.
    if (pathSegments?.some((seg) => !seg || seg === "." || seg === "..")) {
      return NextResponse.json(
        { error: "Invalid path", message: "Certification path is invalid" },
        { status: 400 }
      );
    }
    const path = pathSegments?.map(encodeURIComponent).join("/") ?? "";
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

    const url = `https://preview.keyforge.ai/certification/api/v1/${encodeURIComponent(getTenantIdFromRequest(request))}/${path}`;
    let body: string | undefined;
    try {
      body = await request.text();
    } catch {
      body = undefined;
    }

    const headers = withTenantHeader(
      withAuthHeader(
        {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        jwtToken
      ),
      request
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
        status: response.status
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
    });
  } catch (error) {
    console.error("Certification proxy error:", error);
    return NextResponse.json(
      {
        error: "Proxy failed",
      },
      { status: 500 }
    );
  }
}
