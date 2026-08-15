import { NextRequest, NextResponse } from "next/server";
import {
  fetchPolicyOptimizationRows,
  isPolicyOptimizationApiConfigured,
} from "@/lib/policy-optimization-api";
import { getJwtTokenFromRequest } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isPolicyOptimizationApiConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        rows: [],
        message:
          "Policy optimization API is unavailable.",
      },
      { status: 503 }
    );
  }

  try {
    const jwtToken = getJwtTokenFromRequest(request);
    if (!jwtToken && !process.env.POLICY_OPTIMIZATION_API_KEY?.trim()) {
      return NextResponse.json(
        {
          configured: true,
          rows: [],
          message: "Sign in required to load policy optimization data.",
        },
        { status: 401 }
      );
    }

    const { rows, summary, tenancyName } = await fetchPolicyOptimizationRows(jwtToken);
    return NextResponse.json({ configured: true, rows, summary, tenancyName });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load policy optimization";
    const status =
      error instanceof Error && "status" in error && typeof error.status === "number"
        ? error.status
        : 500;
    console.error("[oci-policy-optimization]", message);
    return NextResponse.json({ configured: true, message, rows: [] }, { status });
  }
}
