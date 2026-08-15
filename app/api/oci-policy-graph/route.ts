import { NextRequest, NextResponse } from "next/server";
import { fetchPolicyGraph, isPolicyGraphApiConfigured } from "@/lib/oci-policy-graph-api";
import { getJwtTokenFromRequest } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isPolicyGraphApiConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        message: "Policy graph API is unavailable.",
      },
      { status: 503 }
    );
  }

  const policy = request.nextUrl.searchParams.get("policy")?.trim() ?? "";
  if (!policy) {
    return NextResponse.json({ configured: true, message: "Policy name is required." }, { status: 400 });
  }

  try {
    const jwtToken = getJwtTokenFromRequest(request);
    if (!jwtToken && !process.env.POLICY_OPTIMIZATION_API_KEY?.trim()) {
      return NextResponse.json(
        {
          configured: true,
          message: "Sign in required to load policy graph data.",
        },
        { status: 401 }
      );
    }

    const graph = await fetchPolicyGraph(policy, jwtToken);
    return NextResponse.json({ configured: true, graph });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load policy graph";
    const status =
      error instanceof Error && "status" in error && typeof error.status === "number"
        ? error.status
        : 500;
    console.error("[oci-policy-graph]", message);
    return NextResponse.json({ configured: true, message }, { status });
  }
}
