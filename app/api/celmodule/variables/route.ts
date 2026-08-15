import { NextResponse } from "next/server";

const UPSTREAM =
  process.env.CELMODULE_VARIABLES_URL ??
  "https://preview.keyforge.ai/celmodule/api/v1/ACMECOM/variables";

export async function GET() {
  try {
    const res = await fetch(UPSTREAM, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ISPM-App/1.0",
      },
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
