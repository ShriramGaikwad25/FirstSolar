import { NextRequest, NextResponse } from "next/server";
import { fetchOciGroupAccessDetail, isGroupsApiConfigured } from "@/lib/group-access-api";
import { getJwtTokenFromRequest } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupName: string }> }
) {
  if (!isGroupsApiConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        message: "Group access API is unavailable.",
      },
      { status: 503 }
    );
  }

  const { groupName } = await params;
  const decodedName = decodeURIComponent(groupName).trim();
  if (!decodedName) {
    return NextResponse.json(
      { configured: true, message: "Group name is required." },
      { status: 400 }
    );
  }

  try {
    const jwtToken = getJwtTokenFromRequest(request);
    if (!jwtToken && !process.env.POLICY_OPTIMIZATION_API_KEY?.trim()) {
      return NextResponse.json(
        {
          configured: true,
          message: "Sign in required to load group access data.",
        },
        { status: 401 }
      );
    }

    const tenancyId = request.nextUrl.searchParams.get("tenancyId");
    const group = await fetchOciGroupAccessDetail(decodedName, jwtToken, tenancyId);

    return NextResponse.json({ configured: true, group });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load group access";
    const status =
      error instanceof Error && "status" in error && typeof error.status === "number"
        ? error.status
        : 500;
    console.error("[oci-group-access-detail]", message);
    return NextResponse.json({ configured: true, message }, { status });
  }
}
