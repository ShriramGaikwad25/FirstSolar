import { NextRequest, NextResponse } from "next/server";
import { fetchPolicyRecommendation, parsePolicyRecommendationResponse } from "@/lib/policy-recommendation-api";
import { getJwtTokenFromRequest } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const jwtToken = getJwtTokenFromRequest(request);
    if (!jwtToken && !process.env.POLICY_OPTIMIZATION_API_KEY?.trim()) {
      return NextResponse.json(
        { message: "Sign in required to simulate policy recommendations." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      policyName?: string;
      statement?: string;
    };

    const policyName = body.policyName?.trim() ?? "";
    const statement = body.statement?.trim() ?? "";

    if (!policyName) {
      return NextResponse.json({ message: "Policy name is required." }, { status: 400 });
    }
    if (!statement) {
      return NextResponse.json({ message: "Policy statement is required." }, { status: 400 });
    }

    const result = await fetchPolicyRecommendation(
      { policyName, statement },
      jwtToken
    );
    const parsed = parsePolicyRecommendationResponse(result, statement);
    return NextResponse.json({
      data: result,
      result: parsed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load policy recommendation";
    const status =
      error instanceof Error && "status" in error && typeof error.status === "number"
        ? error.status
        : 500;
    console.error("[oci-policy-recommendation]", message);
    return NextResponse.json({ message }, { status });
  }
}
