import { NextRequest, NextResponse } from "next/server";

const AG_API_BASE =
  "https://ag-poc-idoc2ay9p1ie.access-governance.us-ashburn-1.oci.oraclecloud.com/access-governance/access-controls/20250331";

// NOTE: For development/demo only – in production, move this into an environment
// variable instead of hard-coding it in the repository.
const AG_BEARER_TOKEN =
  "eyJ4NXQjUzI1NiI6InZMRmNVZkdOWGZfZ2pQbzEtNzcxZ1UxMDRaT3NCLWlnaVFURVFQdDhXdk0iLCJ4NXQiOiJobHhLdVk0QjNQRVJKVEp1THVlaC1XdGFMN3MiLCJraWQiOiJTSUdOSU5HX0tFWSIsImFsZyI6IlJTMjU2In0.eyJjbGllbnRfb2NpZCI6Im9jaWQxLmRvbWFpbmFwcC5vYzEuaWFkLmFtYWFhYWFha2ZvbWpzYWF3enBwenFybHhwdnN3YjZ2aG5ucDV0b2k0dG91eHczZ24ycDdiN3ZtdWw1YSIsInN1YiI6ImJmNTNiNDM3MWJiZjQxY2FhY2IzOTEzZDIwNDM5MDFhIiwic2lkbGUiOjQ4MCwidXNlci50ZW5hbnQubmFtZSI6ImlkY3MtMGY0OGY0ZmQzM2NkNGViN2JjNjkwZmNiOTQ5YWQyNGUiLCJpc3MiOiJodHRwczovL2lkZW50aXR5Lm9yYWNsZWNsb3VkLmNvbS8iLCJkb21haW5faG9tZSI6InVzLWFzaGJ1cm4tMSIsImNhX29jaWQiOiJvY2lkMS50ZW5hbmN5Lm9jMS4uYWFhYWFhYWF4emhibWJicHBkbGFjaHl3Znd5dHlocWdsNTV4NjNub3N0Z2tucmp5b2lnNXl1bGd4a3JxIiwiY2xpZW50X2lkIjoiYmY1M2I0MzcxYmJmNDFjYWFjYjM5MTNkMjA0MzkwMWEiLCJkb21haW5faWQiOiJvY2lkMS5kb21haW4ub2MxLi5hYWFhYWFhYWN6bndoMng3ZGVkYnphc21oYm5qenBmbnpjNmZ3M3Y0czZkYXBhc2VobWt0bGlvYzJidmEiLCJzdWJfdHlwZSI6ImNsaWVudCIsInNjb3BlIjoidXJuOm9wYzphZ2NzOmFsbCIsImNsaWVudF90ZW5hbnRuYW1lIjoiaWRjcy0wZjQ4ZjRmZDMzY2Q0ZWI3YmM2OTBmY2I5NDlhZDI0ZSIsInJlZ2lvbl9uYW1lIjoidXMtYXNoYnVybi1pZGNzLTEiLCJleHAiOjE3NzYwNjE4ODMsImlhdCI6MTc3MjQ2MTg4MywiY2xpZW50X2d1aWQiOiJmM2VjZmI5MjhjYWE0MjY3OTIzNDk4NGM0M2E0M2NjOSIsImNsaWVudF9uYW1lIjoiYWdwb2MtYXBpLXRlc3Qtb2F1dGgtY2xpZW50LWFwcCIsInRlbmFudCI6ImlkY3MtMGY0OGY0ZmQzM2NkNGViN2JjNjkwZmNiOTQ5YWQyNGUiLCJqdGkiOiJmODZiYzdmMjJmMGI0NmZiYWQxZmIyNTQzOTQ5NjE0NSIsImd0cCI6ImNjIiwib3BjIjpmYWxzZSwic3ViX21hcHBpbmdhdHRyIjoidXNlck5hbWUiLCJwcmltVGVuYW50Ijp0cnVlLCJ0b2tfdHlwZSI6IkFUIiwiY2FfZ3VpZCI6ImNhY2N0LTE0Mjk0ZWRmMDdlYTQyODRhMzBlMjIzZGY4ZTY3NGU1IiwiYXVkIjoiaHR0cHM6Ly9hZy1wb2MtaWRvYzJheTlwMWllLmFjY2Vzcy1nb3Zlcm5hbmNlLnVzLWFzaGJ1cm4tMS5vY2kub3JhY2xlY2xvdWQuY29tLyIsImNhX25hbWUiOiJ1bWFzc29jaSIsImRvbWFpbiI6Ik9yYWNsZUlkZW50aXR5Q2xvdWRTZXJ2aWNlIiwidGVuYW50X2lzcyI6Imh0dHBzOi8vaWRjcy0wZjQ4ZjRmZDMzY2Q0ZWI3YmM2OTBmY2I5NDlhZDI0ZS5pZGVudGl0eS5vcmFjbGVjbG91ZC5jb206NDQzIiwicmVzb3VyY2VfYXBwX2lkIjoiNGIwMTE1NDAwMjkxNDI2NzhkZDIwMmJlZWJlNTIxNmQifQ.Cai9kfabY6aOnRZNMY7N7hw1sD6T8788Ryl4H9iIT9gxGJ5Oe7I88QHz5z-GJ_1d3P0OO4VpqZ2pFkmVNKYe9lqEQxAHz2eGruW17y_Le9CEs789ZnOCJ6H-eUN02xfptTTgy3QVFcNISCqJLFCNW4tYbm2tkbTHl94FAHIbAQ2yHpdLWyVm-MfHIktP3oqpBdDpN5pgKXMYGGX2riugdlB9ZJluu_ZnaG2rOSvK8r2xi7MIQ2lSaLrD74bQVh0JG3acLX2bHOPIA-9L17mkSBLRCygoU15aMW7DqaJM0CkHmd4_s99WCpSCE0rMnDct6dnurIBMDX4qlsE3oZxh1Q";

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

