import { NextResponse } from "next/server";

const UPSTREAM =
  process.env.CELMODULE_EXPRESSIONS_URL ??
  "https://preview.keyforge.ai/celmodule/api/v1/ACMECOM/expressions";

type CreateExpressionBody = {
  name?: unknown;
  description?: unknown;
  category?: unknown;
  expression?: unknown;
  variableNames?: unknown;
  variables?: unknown;
};

function upstreamErrorDetail(data: unknown, text: string): string {
  if (typeof data === "object" && data !== null) {
    const o = data as Record<string, unknown>;
    for (const key of ["message", "detail", "error"]) {
      const v = o[key];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return text.slice(0, 500).trim();
}

function commonUpstreamHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "ISPM-App/1.0",
  };
  const auth = process.env.CELMODULE_AUTHORIZATION;
  if (auth) {
    h.Authorization = auth;
  }
  return h;
}

function postJsonHeaders(): Record<string, string> {
  return {
    ...commonUpstreamHeaders(),
    "Content-Type": "application/json",
  };
}

export async function POST(req: Request) {
  try {
    let body: CreateExpressionBody;
    try {
      body = (await req.json()) as CreateExpressionBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const expressionRaw =
      typeof body.expression === "string" ? body.expression : "";
    const expression = expressionRaw
      // strip BOM / odd whitespace that breaks CEL parsers
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!expression.trim()) {
      return NextResponse.json({ error: "expression is required" }, { status: 400 });
    }

    const description =
      typeof body.description === "string" ? body.description : "";
    const category = typeof body.category === "string" ? body.category : "";
    const variableNames = Array.isArray(body.variableNames)
      ? body.variableNames
          .filter((x): x is string => typeof x === "string")
          .map((n) => n.trim())
          .filter(Boolean)
      : [];

    let variables: { name: string; type: string; category: string }[] | undefined;
    if (Array.isArray(body.variables)) {
      variables = body.variables
        .filter(
          (v): v is Record<string, unknown> =>
            typeof v === "object" && v !== null,
        )
        .map((v) => ({
          name: typeof v.name === "string" ? v.name.trim() : "",
          type: typeof v.type === "string" ? v.type.trim() : "",
          category: typeof v.category === "string" ? v.category.trim() : "",
        }))
        .filter((v) => v.name && v.type && v.category);
    }

    const payload: Record<string, unknown> = {
      name,
      description,
      category,
      expression,
      variableNames,
    };
    if (variables?.length) {
      payload.variables = variables;
    }

    const res = await fetch(UPSTREAM, {
      method: "POST",
      headers: postJsonHeaders(),
      body: JSON.stringify(payload as Record<string, unknown>),
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text.slice(0, 500) };
      }
    }

    if (!res.ok) {
      const detail = upstreamErrorDetail(data, text);
      return NextResponse.json(
        {
          error: "Upstream create expression failed",
          status: res.status,
          detail,
        },
        { status: res.status },
      );
    }

    return NextResponse.json(data ?? {}, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Proxy failed" },
      { status: 502 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const upstreamUrl = new URL(UPSTREAM);
    for (const category of searchParams.getAll("category")) {
      const trimmed = category.trim();
      if (trimmed) upstreamUrl.searchParams.append("category", trimmed);
    }

    const res = await fetch(upstreamUrl.toString(), {
      headers: commonUpstreamHeaders(),
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "Upstream expressions request failed",
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
