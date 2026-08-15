import { NextRequest, NextResponse } from "next/server";
import { fetchOciGroupAccessList, isGroupsApiConfigured } from "@/lib/group-access-api";
import { getJwtTokenFromRequest } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isGroupsApiConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        groups: [],
        message: "Group access API is unavailable.",
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
          groups: [],
          message: "Sign in required to load group access data.",
        },
        { status: 401 }
      );
    }

    const tenancyId = request.nextUrl.searchParams.get("tenancyId");
    const { groups } = await fetchOciGroupAccessList(jwtToken, tenancyId);

    return NextResponse.json({ configured: true, groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load group access";
    const status =
      error instanceof Error && "status" in error && typeof error.status === "number"
        ? error.status
        : 500;
    console.error("[oci-group-access]", message);
    return NextResponse.json({ configured: true, message, groups: [] }, { status });
  }
}
