import { NextRequest, NextResponse } from "next/server";
import { getTenantIdFromRequest, requireSession, withTenantHeader } from "@/lib/serverAuth";

function upstreamUrl(request: NextRequest): string {
  return (
    process.env.CELMODULE_VARIABLES_URL ??
    `https://preview.keyforge.ai/celmodule/api/v1/${encodeURIComponent(getTenantIdFromRequest(request))}/variables`
  );
}

export async function GET(request: NextRequest) {
  const unauthorized = requireSession(request);
  if (unauthorized) return unauthorized;

  try {
    const res = await fetch(upstreamUrl(request), {
      headers: withTenantHeader(
        {
          Accept: "application/json",
          "User-Agent": "ISPM-App/1.0",
        },
        request
      ),
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "Upstream variables request failed",
          status: res.status,
          detail: text.slice(0, 500),
        },
        { status: res.status },
      );
    }

    let data: unknown;
    try {
      data = text ? JSON.parse(text) : [];
    } catch {
      return NextResponse.json({ error: "Invalid JSON from upstream" }, { status: 502 });
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Proxy failed" },
      { status: 502 },
    );
  }
}
