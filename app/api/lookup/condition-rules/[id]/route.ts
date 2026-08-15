import { NextRequest, NextResponse } from "next/server";
import { getJwtTokenFromRequest, withAuthHeader } from "@/lib/serverAuth";

const BASE_URL =
  "https://preview.keyforge.ai/lookup/api/v1/ACMECOM/conditionRules";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const jwtToken = getJwtTokenFromRequest(request);
    const body = await request.json();
    const url = `${BASE_URL}/${encodeURIComponent(params.id)}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: withAuthHeader(
        {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "ISPM-App/1.0",
          Accept: "application/json",
        },
        jwtToken,
      ),
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await response.text();

    if (!response.ok) {
      let message = response.statusText;
      try {
        const errJson = text ? JSON.parse(text) : null;
        if (errJson && typeof errJson === "object") {
          message =
            (errJson as { message?: string }).message ??
            (errJson as { error?: string }).error ??
            message;
        }
      } catch {
        if (text) message = text.slice(0, 500);
      }
      return NextResponse.json(
        {
          error: "Failed to update condition rule",
          message,
          detail: text.slice(0, 500),
        },
        { status: response.status },
      );
    }

    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("API Route [lookup/condition-rules/:id] PUT:", error);
    return NextResponse.json(
      {
        error: "Failed to update condition rule",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
