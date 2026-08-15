import { NextRequest, NextResponse } from "next/server";

const AG_API_BASE =
  "https://ag-poc-idoc2ay9p1ie.access-governance.us-ashburn-1.oci.oraclecloud.com/access-governance/access-controls/20250331";

// NOTE: For development/demo only – in production, move this into an environment
// variable instead of hard-coding it in the repository.
const AG_BEARER_TOKEN =
  "REDACTED_AG_BEARER_TOKEN";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  if (!type || !id) {
    return NextResponse.json(
      { error: "Missing required query params: type, id" },
      { status: 400 },
    );
  }

  if (!AG_BEARER_TOKEN) {
    return NextResponse.json(
      { error: "AG_BEARER_TOKEN is not configured on the server" },
      { status: 500 },
    );
  }

  const targetUrl = `${AG_API_BASE}/${type}/${encodeURIComponent(id)}`;

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        Authorization: `Bearer ${AG_BEARER_TOKEN}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const bodyText = await upstream.text();

    return new NextResponse(bodyText, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to call AG API",
        message: error?.message || String(error),
      },
      { status: 502 },
    );
  }
}

