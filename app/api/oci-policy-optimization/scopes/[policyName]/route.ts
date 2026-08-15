import { NextRequest, NextResponse } from "next/server";
import {
  fetchPolicyOptimizationScopes,
  isPolicyOptimizationApiConfigured,
} from "@/lib/policy-optimization-api";
import { getJwtTokenFromRequest } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ policyName: string }> }
) {
  if (!isPolicyOptimizationApiConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        message: "Policy optimization API is unavailable.",
      },
      { status: 503 }
    );
  }

  const { policyName } = await params;
  const decodedName = decodeURIComponent(policyName).trim();
  if (!decodedName) {
    return NextResponse.json(
      { configured: true, message: "Policy name is required." },
      { status: 400 }
    );
  }

  try {
    const jwtToken = getJwtTokenFromRequest(request);
    if (!jwtToken && !process.env.POLICY_OPTIMIZATION_API_KEY?.trim()) {
      return NextResponse.json(
        {
          configured: true,
          message: "Sign in required to load policy scopes.",
        },
        { status: 401 }
      );
    }

    const scopes = await fetchPolicyOptimizationScopes(decodedName, jwtToken);

    return NextResponse.json({
      configured: true,
      policyName: decodedName,
      scopes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load policy scopes";
    const status =
      error instanceof Error && "status" in error && typeof error.status === "number"
        ? error.status
        : 500;
    console.error("[oci-policy-optimization-scopes]", message);
    return NextResponse.json({ configured: true, message }, { status });
  }
}
