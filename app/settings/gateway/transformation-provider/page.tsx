"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import type {
  ColDef,
  GetRowIdParams,
  ICellRendererParams,
  IsFullWidthRowParams,
} from "ag-grid-community";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Code2, Pencil } from "lucide-react";
import ClientOnlyAgGrid from "@/components/ClientOnlyAgGrid";

/** Proxied via Next.js routes: app/api/celmodule/variables and expressions */
const VARIABLES_FETCH_URL = "/api/celmodule/variables";
const EXPRESSIONS_FETCH_URL = "/api/celmodule/expressions";

function expressionItemUrl(id: number): string {
  return `${EXPRESSIONS_FETCH_URL}/${id}`;
}

export type CelExpressionVariableRef = {
  name: string;
  type: string;
  category: string;
};

export type CelExpressionRow = {
  id: number;
  name: string;
  expression: string;
  category: string;
  description: string;
  variables: CelExpressionVariableRef[];
  createdAt: string;
  updatedAt: string;
};

export type ExpressionGridDetailRow = {
  rowKind: "detail";
  parentId: number;
  descriptionText: string;
};

export type ExpressionGridMainRow = CelExpressionRow & { rowKind: "main" };

export type ExpressionGridRow = ExpressionGridMainRow | ExpressionGridDetailRow;

export type CelModuleVariable = {
  id: number;
  name: string;
  type: string;
  category: string;
  description: string;
  createdAt: string;
};

export type TransformationProviderPayload = {
  name: string;
  description: string;
  category: string;
  expression: string;
  variableNames: string[];
};

const EMPTY_FORM: TransformationProviderPayload = {
  name: "",
  description: "",
  category: "",
  expression: "",
  variableNames: [],
};

function variableNamesToInput(names: string[]): string {
  return names.join(", ");
}

function parseVariableNames(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function appendVariableName(current: string, name: string): string {
  const existing = parseVariableNames(current);
  if (existing.includes(name)) return current;
  return current.trim() ? `${current.trim()}, ${name}` : name;
}

/** Strip BOM / smart quotes / odd newlines that often trigger “Invalid CEL expression”. */
function normalizeCelExpression(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim();
}

function dedupeVariableNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const n = raw.trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function buildVariablesForSubmit(
  variableNames: string[],
  category: string,
  catalog: CelModuleVariable[],
): CelExpressionVariableRef[] {
  const cat = category.trim();
  const out: CelExpressionVariableRef[] = [];
  for (const raw of variableNames) {
    const name = raw.trim();
    if (!name) continue;
    const inCategory = cat
      ? catalog.find((v) => v.name === name && v.category === cat)
      : undefined;
    const anyMatch = catalog.find((v) => v.name === name);
    const v = inCategory ?? anyMatch;
    if (v) {
      out.push({ name: v.name, type: v.type, category: v.category });
    } else {
      out.push({
        name,
        type: "string",
        category: cat || "string",
      });
    }
  }
  return out;
}

function formatCreateExpressionError(msg: string): string {
  if (/invalid\s*cel\s*expression/i.test(msg)) {
    return `${msg} — Use the same variable names as in the expression, pick a category, and add variables from the sidebar so types match the catalog.`;
  }
  return msg;
}

export default function TransformationProviderPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view") ?? "";
  const editIdRaw = searchParams.get("id");
  const parsedEditId = editIdRaw !== null ? Number.parseInt(editIdRaw, 10) : NaN;
  const editId = Number.isFinite(parsedEditId) && parsedEditId > 0 ? parsedEditId : null;
  const pageMode =
    viewParam === "create"
      ? "create"
      : viewParam === "edit" && editId !== null
        ? "edit"
        : "list";

  const expressionRef = useRef<HTMLTextAreaElement>(null);
  const expressionCursorRef = useRef(0);
  const hydratedEditIdRef = useRef<number | null>(null);
  const [expressionDragOver, setExpressionDragOver] = useState(false);
  const [variableNamesDragOver, setVariableNamesDragOver] = useState(false);

  const [expressions, setExpressions] = useState<CelExpressionRow[]>([]);
  const [expressionsLoading, setExpressionsLoading] = useState(true);
  const [expressionsError, setExpressionsError] = useState<string | null>(null);

  const [expressionModalOpen, setExpressionModalOpen] = useState(false);
  const [expressionModalText, setExpressionModalText] = useState("");
  const [expressionModalTitle, setExpressionModalTitle] = useState("");

  const [name, setName] = useState(EMPTY_FORM.name);
  const [description, setDescription] = useState(EMPTY_FORM.description);
  const [category, setCategory] = useState(EMPTY_FORM.category);
  const [expression, setExpression] = useState(EMPTY_FORM.expression);
  const [variableNamesInput, setVariableNamesInput] = useState(
    variableNamesToInput(EMPTY_FORM.variableNames)
  );
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitPending, setSubmitPending] = useState(false);
  const [submitApiError, setSubmitApiError] = useState(false);

  const [catalogVariables, setCatalogVariables] = useState<CelModuleVariable[]>([]);
  const [variablesLoading, setVariablesLoading] = useState(true);
  const [variablesError, setVariablesError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setVariablesLoading(true);
      setVariablesError(null);
      try {
        const res = await fetch(VARIABLES_FETCH_URL, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }
        const data: unknown = await res.json();
        if (!Array.isArray(data)) {
          throw new Error("Invalid variables response");
        }
        setCatalogVariables(data as CelModuleVariable[]);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setVariablesError(err instanceof Error ? err.message : "Failed to load variables");
        setCatalogVariables([]);
      } finally {
        setVariablesLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (pageMode !== "list" && pageMode !== "edit") return;
    const controller = new AbortController();
    (async () => {
      setExpressionsLoading(true);
      setExpressionsError(null);
      try {
        const res = await fetch(EXPRESSIONS_FETCH_URL, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }
        const data: unknown = await res.json();
        if (!Array.isArray(data)) {
          throw new Error("Invalid expressions response");
        }
        setExpressions(data as CelExpressionRow[]);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setExpressionsError(err instanceof Error ? err.message : "Failed to load expressions");
        setExpressions([]);
      } finally {
        setExpressionsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [pageMode]);

  useEffect(() => {
    if (pageMode !== "edit" || editId === null) {
      hydratedEditIdRef.current = null;
      return;
    }
    const row = expressions.find((e) => e.id === editId);
    if (!row) return;
    if (hydratedEditIdRef.current === editId) return;
    hydratedEditIdRef.current = editId;
    setName(row.name);
    setDescription(row.description);
    setCategory(row.category);
    setExpression(row.expression);
    setVariableNamesInput(
      variableNamesToInput((row.variables ?? []).map((v) => v.name)),
    );
    setSubmitMessage(null);
    setSubmitApiError(false);
  }, [pageMode, editId, expressions]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const v of catalogVariables) {
      const c = v.category?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [catalogVariables]);

  const filteredCatalogVariables = useMemo(() => {
    if (!category) return [];
    return catalogVariables.filter((v) => v.category === category);
  }, [catalogVariables, category]);

  const expressionGridRows = useMemo<ExpressionGridRow[]>(() => {
    const rows: ExpressionGridRow[] = [];
    for (const ex of expressions) {
      rows.push({ ...ex, rowKind: "main" });
      const desc = ex.description?.trim();
      if (desc) {
        rows.push({
          rowKind: "detail",
          parentId: ex.id,
          descriptionText: desc,
        });
      }
    }
    return rows;
  }, [expressions]);

  const getExpressionRowId = useCallback((p: GetRowIdParams<ExpressionGridRow>) => {
    const d = p.data;
    if (d.rowKind === "detail") {
      return `detail-${d.parentId}`;
    }
    return `main-${d.id}`;
  }, []);

  const isExpressionFullWidthRow = useCallback(
    (p: IsFullWidthRowParams<ExpressionGridRow>) =>
      p.rowNode.data?.rowKind === "detail",
    []
  );

  const fullWidthDescriptionRenderer = useCallback(
    (p: ICellRendererParams<ExpressionGridRow, unknown>) => {
      if (p.data?.rowKind !== "detail") return null;
      return (
        <div className="box-border w-full border-t border-gray-100 bg-gray-50/90 px-4 py-2.5 text-sm leading-relaxed text-gray-700">
          <span className="font-medium text-gray-500">Description </span>
          <span className="whitespace-pre-wrap break-words text-gray-800">
            {p.data.descriptionText}
          </span>
        </div>
      );
    },
    []
  );

  const payload: TransformationProviderPayload = useMemo(
    () => ({
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      expression,
      variableNames: parseVariableNames(variableNamesInput),
    }),
    [name, description, category, expression, variableNamesInput]
  );

  const resetForm = () => {
    setName(EMPTY_FORM.name);
    setDescription(EMPTY_FORM.description);
    setCategory(EMPTY_FORM.category);
    setExpression(EMPTY_FORM.expression);
    setVariableNamesInput(variableNamesToInput(EMPTY_FORM.variableNames));
    setSubmitMessage(null);
    setSubmitApiError(false);
  };

  const handleCreate = () => {
    resetForm();
    router.push(`${pathname}?view=create`);
  };

  const openEdit = useCallback(
    (row: CelExpressionRow) => {
      router.push(`${pathname}?view=edit&id=${row.id}`);
    },
    [router, pathname],
  );

  const openExpressionModal = useCallback((text: string, ruleName?: string) => {
    setExpressionModalText(text);
    setExpressionModalTitle(ruleName?.trim() ? `Expression — ${ruleName}` : "Expression");
    setExpressionModalOpen(true);
  }, []);

  const closeExpressionModal = useCallback(() => {
    setExpressionModalOpen(false);
  }, []);

  useEffect(() => {
    if (!expressionModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeExpressionModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expressionModalOpen, closeExpressionModal]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitMessage(null);
    setSubmitApiError(false);
    if (!payload.name) {
      setSubmitMessage("Name is required.");
      return;
    }
    if (!payload.category.trim()) {
      setSubmitMessage("Category is required.");
      return;
    }
    if (!payload.expression.trim()) {
      setSubmitMessage("Expression is required.");
      return;
    }

    const expression = normalizeCelExpression(payload.expression);
    if (!expression) {
      setSubmitMessage("Expression is required.");
      return;
    }

    const variableNames = dedupeVariableNames(payload.variableNames);
    const variables = buildVariablesForSubmit(
      variableNames,
      payload.category,
      catalogVariables,
    );

    setSubmitPending(true);
    try {
      const body = JSON.stringify({
        name: payload.name,
        description: payload.description,
        category: payload.category,
        expression,
        variableNames,
        variables,
      });

      const isEdit = pageMode === "edit" && editId !== null;
      const res = await fetch(
        isEdit ? expressionItemUrl(editId) : EXPRESSIONS_FETCH_URL,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body,
        },
      );
      const data: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        if (data && typeof data === "object") {
          const o = data as Record<string, unknown>;
          if (typeof o.detail === "string" && o.detail) msg = o.detail;
          else if (typeof o.error === "string" && o.error) msg = o.error;
        }
        setSubmitMessage(formatCreateExpressionError(msg));
        setSubmitApiError(true);
        return;
      }

      resetForm();
      router.replace(pathname);
    } catch (err) {
      setSubmitMessage(err instanceof Error ? err.message : "Submit failed.");
      setSubmitApiError(true);
    } finally {
      setSubmitPending(false);
    }
  };

  const syncExpressionCursor = () => {
    const el = expressionRef.current;
    if (el) expressionCursorRef.current = el.selectionStart;
  };

  const handleVariableDragStart = (e: DragEvent<HTMLButtonElement>, variableName: string) => {
    e.dataTransfer.setData("text/plain", variableName);
    e.dataTransfer.effectAllowed = "copy";
  };

  const appendDraggedVariableToNames = (e: DragEvent<HTMLInputElement>) => {
    e.preventDefault();
    setVariableNamesDragOver(false);
    const name = e.dataTransfer.getData("text/plain").trim();
    if (!name) return;
    setVariableNamesInput((prev) => appendVariableName(prev, name));
  };

  const handleExpressionDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setExpressionDragOver(false);
    const insert = e.dataTransfer.getData("text/plain").trim();
    if (!insert) return;
    if (pageMode !== "edit") {
      setVariableNamesInput((prev) => appendVariableName(prev, insert));
    }
    const el = e.currentTarget;
    const len = expression.length;
    const start = Math.max(0, Math.min(el.selectionStart, len));
    const end = Math.max(0, Math.min(el.selectionEnd, len));
    const before = expression.slice(0, start);
    const after = expression.slice(end);
    const next = before + insert + after;
    const caret = start + insert.length;
    setExpression(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
      expressionCursorRef.current = caret;
    });
  };

  useEffect(() => {
    const clearDragOver = () => {
      setExpressionDragOver(false);
      setVariableNamesDragOver(false);
    };
    document.addEventListener("dragend", clearDragOver);
    return () => document.removeEventListener("dragend", clearDragOver);
  }, []);

  const expressionColumnDefs = useMemo<ColDef<ExpressionGridRow>[]>(() => {
    const fmtTime = (iso: string | undefined) => {
      if (!iso) return "—";
      try {
        return new Date(iso).toLocaleString();
      } catch {
        return iso;
      }
    };
    return [
      {
        field: "id",
        headerName: "ID",
        width: 88,
        wrapText: true,
        autoHeight: true,
        valueGetter: (p) => (p.data?.rowKind === "main" ? p.data.id : undefined),
      },
      {
        field: "name",
        headerName: "Name",
        flex: 1.6,
        minWidth: 220,
        wrapText: true,
        autoHeight: true,
        cellRenderer: (p: ICellRendererParams<ExpressionGridRow>) => {
          const row = p.data;
          if (row?.rowKind !== "main") return null;
          return (
            <div className="py-1.5 font-medium text-gray-900">{row.name ?? "—"}</div>
          );
        },
      },
      {
        field: "category",
        headerName: "Category",
        width: 150,
        wrapText: true,
        autoHeight: true,
        valueGetter: (p) => (p.data?.rowKind === "main" ? p.data.category : undefined),
      },
      {
        headerName: "Variables",
        flex: 1.2,
        minWidth: 160,
        wrapText: true,
        autoHeight: true,
        valueGetter: (p) =>
          p.data?.rowKind === "main"
            ? (p.data.variables ?? []).map((v) => v.name).join(", ")
            : "",
      },
      {
        field: "expression",
        headerName: "Expression",
        width: 104,
        minWidth: 96,
        maxWidth: 120,
        wrapText: true,
        autoHeight: true,
        cellRenderer: (p: ICellRendererParams<ExpressionGridRow>) => {
          const row = p.data;
          if (row?.rowKind !== "main") return null;
          const text = row.expression ?? "";
          const has = Boolean(text.trim());
          return (
            <div className="flex items-start justify-center py-2">
              <button
                type="button"
                disabled={!has}
                onClick={(e) => {
                  e.stopPropagation();
                  openExpressionModal(text, row.name);
                }}
                className="inline-flex rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
                title={has ? "View expression" : "No expression"}
                aria-label="View expression"
              >
                <Code2 className="h-5 w-5 shrink-0" />
              </button>
            </div>
          );
        },
      },
      {
        field: "createdAt",
        headerName: "Created",
        width: 168,
        wrapText: true,
        autoHeight: true,
        valueGetter: (p) => (p.data?.rowKind === "main" ? p.data.createdAt : undefined),
        valueFormatter: (p) => fmtTime(p.value as string | undefined),
      },
      {
        field: "updatedAt",
        headerName: "Updated",
        width: 168,
        wrapText: true,
        autoHeight: true,
        valueGetter: (p) => (p.data?.rowKind === "main" ? p.data.updatedAt : undefined),
        valueFormatter: (p) => fmtTime(p.value as string | undefined),
      },
      {
        colId: "edit",
        headerName: "",
        width: 56,
        minWidth: 52,
        maxWidth: 56,
        sortable: false,
        suppressSizeToFit: true,
        cellRenderer: (p: ICellRendererParams<ExpressionGridRow>) => {
          const row = p.data;
          if (row?.rowKind !== "main") return null;
          return (
            <div className="flex items-start justify-center py-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(row);
                }}
                className="inline-flex rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Edit expression"
                aria-label="Edit expression"
              >
                <Pencil className="h-5 w-5 shrink-0" />
              </button>
            </div>
          );
        },
      },
    ];
  }, [openExpressionModal, openEdit]);

  const defaultExpressionColDef = useMemo(
    () => ({
      sortable: false,
      resizable: true,
      filter: false,
      floatingFilter: false,
      wrapText: true,
      autoHeight: true,
    }),
    []
  );

  const variableSidebar = (
    <aside
      className="w-full xl:w-[22rem] shrink-0 flex flex-col border border-gray-200 rounded-lg bg-white shadow-sm xl:sticky xl:top-6 xl:max-h-[min(85vh,calc(100vh-5rem))] overflow-hidden"
      aria-label="Variables for selected category"
    >
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain px-3 py-3">
        {pageMode === "edit" && (
          <p className="mb-3 text-sm text-gray-500 leading-relaxed">
            Variable names are locked in edit mode; only adjust description or expression above.
          </p>
        )}
        {variablesLoading && (
          <p className="text-sm text-gray-600">Loading variables…</p>
        )}
        {variablesError && !variablesLoading && (
          <p className="text-sm text-red-600" role="alert">
            {variablesError}
          </p>
        )}
        {!variablesLoading && !variablesError && !category && (
          <p className="text-sm text-gray-500 text-center leading-relaxed">
            Select a category in the form to see variables for that category.
          </p>
        )}
        {!variablesLoading && !variablesError && category && filteredCatalogVariables.length > 0 && (
          <ul className="m-0 list-none space-y-1 p-0 w-full">
            {filteredCatalogVariables.map((row) => (
              <li key={row.id} className="m-0 p-0 w-full">
                <button
                  type="button"
                  disabled={pageMode === "edit"}
                  draggable={pageMode !== "edit"}
                  onDragStart={(e) => handleVariableDragStart(e, row.name)}
                  onClick={() =>
                    setVariableNamesInput((prev) => appendVariableName(prev, row.name))
                  }
                  title={`${row.description}\n\nDrag onto Expression to insert and add to Variable names, or onto Variable names only, or click to add.`}
                  className={`box-border flex w-full min-w-0 flex-col items-start rounded-md border border-transparent px-3 py-2 text-left ${
                    pageMode === "edit"
                      ? "cursor-not-allowed opacity-50"
                      : "hover:border-gray-200 hover:bg-gray-50 cursor-grab active:cursor-grabbing"
                  }`}
                >
                  <div className="w-full min-w-0 break-all font-mono text-sm text-gray-900">
                    {row.name}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!variablesLoading && !variablesError && category && filteredCatalogVariables.length === 0 && (
          <p className="text-center text-sm text-gray-500">No variables in this category.</p>
        )}
      </div>
    </aside>
  );

  if (pageMode === "list") {
    return (
      <div className="h-full p-6">
        <div className="w-full min-w-0">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Transformation Provider</h1>
              <p className="mt-1 text-sm text-gray-600">
                Expressions from the catalog. Use Create to add a new rule.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Create
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            {expressionsLoading && (
              <p className="px-4 py-3 text-sm text-gray-600">Loading expressions…</p>
            )}
            {expressionsError && !expressionsLoading && (
              <p className="px-4 py-3 text-sm text-red-600" role="alert">
                {expressionsError}
              </p>
            )}
            {!expressionsLoading && !expressionsError && (
              <div className="w-full p-4">
                <div className="ag-theme-alpine w-full">
                  <ClientOnlyAgGrid
                    rowData={expressionGridRows}
                    columnDefs={expressionColumnDefs}
                    defaultColDef={defaultExpressionColDef}
                    domLayout="autoHeight"
                    getRowId={getExpressionRowId}
                    isFullWidthRow={isExpressionFullWidthRow}
                    fullWidthCellRenderer={fullWidthDescriptionRenderer}
                  />
                </div>
              </div>
            )}
          </div>

          {expressionModalOpen && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="expr-modal-title"
              onClick={closeExpressionModal}
            >
              <div
                className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                  <h2 id="expr-modal-title" className="text-lg font-semibold text-gray-900">
                    {expressionModalTitle}
                  </h2>
                  <button
                    type="button"
                    onClick={closeExpressionModal}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Close
                  </button>
                </div>
                <pre className="flex-1 overflow-auto whitespace-pre-wrap break-all border-t border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-900">
                  {expressionModalText}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-6">
      <div className="w-full min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Transformation Provider</h1>
          <p className="text-sm text-gray-600">
            {pageMode === "edit"
              ? "Only description and expression can be edited; name, category, and variable names stay fixed for this rule."
              : "Define SCIM-style transformations: name, description, category, expression, and variable names referenced in the expression."}
          </p>
        </div>

        {pageMode === "edit" &&
          editId !== null &&
          !expressionsLoading &&
          !expressions.some((e) => e.id === editId) && (
            <div
              className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              This expression is not in the loaded list (invalid id or it was removed). Return to the list and try
              again.
            </div>
          )}

        <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
          <div className="min-w-0 flex-1">
          <form
            onSubmit={handleSubmit}
            className="space-y-6 border border-gray-200 rounded-lg bg-white p-6 shadow-sm"
          >
          <div>
            <label htmlFor="tp-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="tp-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              readOnly={pageMode === "edit"}
              aria-readonly={pageMode === "edit"}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                pageMode === "edit" ? "cursor-not-allowed bg-gray-50 text-gray-700" : ""
              }`}
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="tp-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="tp-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="tp-category" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              id="tp-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={variablesLoading || pageMode === "edit"}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {variablesLoading ? "Loading categories…" : "Select category…"}
              </option>
              {!variablesLoading &&
                uniqueCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label htmlFor="tp-expression" className="block text-sm font-medium text-gray-700 mb-1">
              Expression
            </label>
            <textarea
              ref={expressionRef}
              id="tp-expression"
              value={expression}
              onChange={(e) => {
                setExpression(e.target.value);
                expressionCursorRef.current = e.target.selectionStart;
              }}
              onSelect={syncExpressionCursor}
              onClick={syncExpressionCursor}
              onKeyUp={syncExpressionCursor}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setExpressionDragOver(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setExpressionDragOver(true);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget === e.target) setExpressionDragOver(false);
              }}
              onDrop={handleExpressionDrop}
              rows={8}
              spellCheck={false}
              className={`w-full min-h-[180px] px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                expressionDragOver
                  ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-200"
                  : "border-gray-300"
              }`}
            />
          </div>

          <div>
            <label htmlFor="tp-variables" className="block text-sm font-medium text-gray-700 mb-1">
              Variable names
            </label>
            <input
              id="tp-variables"
              type="text"
              value={variableNamesInput}
              onChange={(e) => setVariableNamesInput(e.target.value)}
              disabled={pageMode === "edit"}
              onDragOver={(e) => {
                if (pageMode === "edit") return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setVariableNamesDragOver(true);
              }}
              onDragEnter={(e) => {
                if (pageMode === "edit") return;
                e.preventDefault();
                setVariableNamesDragOver(true);
              }}
              onDragLeave={(e) => {
                if (pageMode === "edit") return;
                if (e.currentTarget === e.target) setVariableNamesDragOver(false);
              }}
              onDrop={pageMode === "edit" ? undefined : appendDraggedVariableToNames}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-700 ${
                variableNamesDragOver && pageMode !== "edit"
                  ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-200"
                  : "border-gray-300"
              }`}
            />
          </div>

          {submitMessage && (
            <p
              className={`text-sm ${
                submitApiError || submitMessage.includes("required")
                  ? "text-red-600"
                  : "text-green-700"
              }`}
            >
              {submitMessage}
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={submitPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitPending
                ? pageMode === "edit"
                  ? "Saving…"
                  : "Submitting…"
                : pageMode === "edit"
                  ? "Save"
                  : "Submit"}
            </button>
          </div>
        </form>
        </div>

        {variableSidebar}
        </div>
      </div>
    </div>
  );
}
