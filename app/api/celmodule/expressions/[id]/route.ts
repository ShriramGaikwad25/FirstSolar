import { NextResponse } from "next/server";

const COLLECTION_UPSTREAM =
  process.env.CELMODULE_EXPRESSIONS_URL ??
  "https://preview.keyforge.ai/celmodule/api/v1/ACMECOM/expressions";

type UpdateExpressionBody = {
  name?: unknown;
  description?: unknown;
  category?: unknown;
  expression?: unknown;
  variableNames?: unknown;
  variables?: unknown;
};

function itemUpstream(id: string): string {
  return `${COLLECTION_UPSTREAM.replace(/\/$/, "")}/${encodeURIComponent(id)}`;
}

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

function putJsonHeaders(): Record<string, string> {
  return {
    ...commonUpstreamHeaders(),
    "Content-Type": "application/json",
  };
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idParam } = await ctx.params;
    if (!idParam || !/^\d+$/.test(idParam)) {
      return NextResponse.json({ error: "Invalid expression id" }, { status: 400 });
    }

    let body: UpdateExpressionBody;
    try {
      body = (await req.json()) as UpdateExpressionBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const expressionRaw =
      typeof body.expression === "string" ? body.expression : "";
    const expression = expressionRaw
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

    const res = await fetch(itemUpstream(idParam), {
      method: "PUT",
      headers: putJsonHeaders(),
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
          error: "Upstream update expression failed",
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
