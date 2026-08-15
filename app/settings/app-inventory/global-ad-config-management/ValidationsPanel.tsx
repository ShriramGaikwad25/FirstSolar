"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Code2, Pencil, Trash2, X } from "lucide-react";
import ClientOnlyAgGrid from "@/components/ClientOnlyAgGrid";
import "@/lib/ag-grid-setup";

const VARIABLES_FETCH_URL = "/api/celmodule/variables";

type CelModuleVariable = {
  id: number;
  name: string;
  type: string;
  category: string;
  description: string;
  createdAt: string;
};

type ValidationRow = {
  id: string;
  name: string;
  cel: string;
  create: boolean;
  update: boolean;
};

const SEED_VALIDATIONS: ValidationRow[] = [
  {
    id: "email-uniqueness",
    name: "Email Uniqueness",
    cel:
      '!emailExists(givenName + "." + familyName + "@" + emailDomain, all(applicationType))\n' +
      '  ? givenName + "." + familyName + "@" + emailDomain\n' +
      "  :\n" +
      "      .filter(i, i <= givenName.size())\n" +
      '      .map(i, givenName + "." + givenName.substring(0, i) + "." + familyName + "@" + emailDomain)\n' +
      "      .filter(email, !emailExists(email, all(applicationType)))",
    create: true,
    update: true,
  },
  {
    id: "upn",
    name: "UPN",
    cel:
      '!accountExists(givenName + "." + familyName + "@" + ADDomain, all(applicationType))\n' +
      '  ? givenName + "." + familyName + "@" + ADDomain\n' +
      "  :\n" +
      "      .filter(i, i <= givenName.size())\n" +
      '      .map(i, givenName + "." + givenName.substring(0, i) + "." + familyName + "@" + ADDomain)\n' +
      "      .filter(upn, !accountExists(upn, all(applicationType)))",
    create: true,
    update: true,
  },
  {
    id: "samaccountname",
    name: "SAMAccount Name",
    cel:
      '!accountExists(givenName + "." + familyName, all(applicationType))\n' +
      '  ? givenName + "." + familyName\n' +
      "  :\n" +
      "      .filter(i, i <= givenName.size())\n" +
      '      .map(i, givenName + "." + givenName.substring(0, i) + "." + familyName)\n' +
      "      .filter(acc, !accountExists(acc, all(applicationType)))",
    create: true,
    update: true,
  },
];

let validationIdCounter = 0;
function nextValidationId(): string {
  validationIdCounter += 1;
  return `validation-${validationIdCounter}`;
}

function notifySaved(message: string) {
  const toast = (window as unknown as { toast?: (msg: string) => void }).toast;
  if (typeof toast === "function") toast(message);
}

type ValidationFormState = {
  name: string;
  cel: string;
  create: boolean;
  update: boolean;
};

const EMPTY_FORM: ValidationFormState = { name: "", cel: "", create: false, update: false };

export default function ValidationsPanel() {
  const [validations, setValidations] = useState<ValidationRow[]>(SEED_VALIDATIONS);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ValidationFormState>(EMPTY_FORM);

  const [celModalOpen, setCelModalOpen] = useState(false);
  const [celModalText, setCelModalText] = useState("");
  const [celModalTitle, setCelModalTitle] = useState("");

  const [catalogVariables, setCatalogVariables] = useState<CelModuleVariable[]>([]);
  const [variablesLoading, setVariablesLoading] = useState(true);
  const [variablesError, setVariablesError] = useState<string | null>(null);
  const [variableFilter, setVariableFilter] = useState("");
  const [celDragOver, setCelDragOver] = useState(false);

  const celTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const celCursorRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setVariablesLoading(true);
      setVariablesError(null);
      try {
        const res = await fetch(VARIABLES_FETCH_URL, { signal: controller.signal });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data: unknown = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid variables response");
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

  const filteredCatalogVariables = useMemo(() => {
    const term = variableFilter.trim().toLowerCase();
    if (!term) return catalogVariables;
    return catalogVariables.filter(
      (v) => v.name.toLowerCase().includes(term) || v.category.toLowerCase().includes(term)
    );
  }, [catalogVariables, variableFilter]);

  const insertIntoCel = useCallback((insert: string) => {
    setForm((f) => {
      const len = f.cel.length;
      const pos = Math.max(0, Math.min(celCursorRef.current, len));
      const next = f.cel.slice(0, pos) + insert + f.cel.slice(pos);
      const caret = pos + insert.length;
      requestAnimationFrame(() => {
        const el = celTextareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(caret, caret);
          celCursorRef.current = caret;
        }
      });
      return { ...f, cel: next };
    });
  }, []);

  const handleVariableDragStart = useCallback((e: DragEvent<HTMLButtonElement>, name: string) => {
    e.dataTransfer.setData("text/plain", name);
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const handleCelDrop = useCallback(
    (e: DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      setCelDragOver(false);
      const insert = e.dataTransfer.getData("text/plain").trim();
      if (!insert) return;
      const el = e.currentTarget;
      celCursorRef.current = el.selectionStart ?? el.value.length;
      insertIntoCel(insert);
    },
    [insertIntoCel]
  );

  const openDrawer = useCallback((row?: ValidationRow) => {
    if (row) {
      setEditingId(row.id);
      setForm({ name: row.name, cel: row.cel, create: row.create, update: row.update });
    } else {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
    setVariableFilter("");
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const saveDrawer = useCallback(() => {
    const name = form.name.trim();
    if (!name) return;
    const cel = form.cel.trim();
    setValidations((prev) => {
      if (editingId) {
        return prev.map((v) =>
          v.id === editingId ? { ...v, name, cel, create: form.create, update: form.update } : v
        );
      }
      return [...prev, { id: nextValidationId(), name, cel, create: form.create, update: form.update }];
    });
    setDrawerOpen(false);
    notifySaved("Validation saved");
  }, [editingId, form]);

  const removeValidation = useCallback((id: string) => {
    setValidations((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const openCelModal = useCallback((row: ValidationRow) => {
    setCelModalText(row.cel);
    setCelModalTitle(`CEL Expression — ${row.name}`);
    setCelModalOpen(true);
  }, []);

  const closeCelModal = useCallback(() => setCelModalOpen(false), []);

  const columnDefs = useMemo<ColDef<ValidationRow>[]>(
    () => [
      {
        field: "name",
        headerName: "Validation Name",
        flex: 1,
        minWidth: 200,
        wrapText: true,
        autoHeight: true,
        cellRenderer: (p: ICellRendererParams<ValidationRow>) => (
          <div className="py-1.5 font-medium text-gray-900">{p.data?.name || "—"}</div>
        ),
      },
      {
        headerName: "CEL Expression",
        width: 150,
        minWidth: 130,
        cellRenderer: (p: ICellRendererParams<ValidationRow>) => {
          const row = p.data;
          if (!row) return null;
          const has = Boolean(row.cel.trim());
          return (
            <div className="flex items-center justify-center py-2">
              <button
                type="button"
                disabled={!has}
                onClick={(e) => {
                  e.stopPropagation();
                  openCelModal(row);
                }}
                className="inline-flex rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
                title={has ? "View expression" : "No expression set"}
                aria-label="View expression"
              >
                <Code2 className="h-5 w-5 shrink-0" />
              </button>
            </div>
          );
        },
      },
      {
        headerName: "Scope",
        width: 170,
        minWidth: 150,
        wrapText: true,
        autoHeight: true,
        cellRenderer: (p: ICellRendererParams<ValidationRow>) => {
          const row = p.data;
          if (!row) return null;
          const parts = [row.create ? "Create" : null, row.update ? "Update" : null].filter(
            Boolean
          ) as string[];
          if (!parts.length) return <span className="text-sm text-gray-400">No scope</span>;
          return (
            <div className="flex flex-wrap gap-1.5 py-2">
              {parts.map((part) => (
                <span
                  key={part}
                  className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600"
                >
                  {part}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        colId: "actions",
        headerName: "",
        width: 90,
        minWidth: 84,
        maxWidth: 96,
        sortable: false,
        suppressSizeToFit: true,
        cellRenderer: (p: ICellRendererParams<ValidationRow>) => {
          const row = p.data;
          if (!row) return null;
          return (
            <div className="flex items-center justify-center gap-1 py-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openDrawer(row);
                }}
                className="inline-flex rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Edit validation"
                aria-label="Edit validation"
              >
                <Pencil className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeValidation(row.id);
                }}
                className="inline-flex rounded-md p-2 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                title="Delete validation"
                aria-label="Delete validation"
              >
                <Trash2 className="h-4 w-4 shrink-0" />
              </button>
            </div>
          );
        },
      },
    ],
    [openCelModal, openDrawer, removeValidation]
  );

  const defaultColDef = useMemo(
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Validations</h2>
        </div>
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => openDrawer()}>
            Add Validation
          </button>
        </div>
      </div>

      <div className="section card section-card">
        <div className="ag-theme-alpine w-full">
          <ClientOnlyAgGrid
            rowData={validations}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            domLayout="autoHeight"
            getRowId={(p: { data: ValidationRow }) => p.data.id}
          />
        </div>
      </div>

      {celModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeCelModal}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-900">{celModalTitle}</h2>
              <button
                type="button"
                onClick={closeCelModal}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words border-t border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-900">
              {celModalText || "No expression set"}
            </pre>
          </div>
        </div>
      )}

      {drawerOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-stretch justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={closeDrawer}
        >
          <div
            className="flex h-full w-full max-w-[760px] flex-col overflow-hidden bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? "Edit Validation" : "Add Validation"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Define the CEL expression and scope for this validation.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-w-0 overflow-auto px-6 py-5 space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                    Validation Name
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Email Uniqueness"
                    className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                    CEL Expression
                  </label>
                  <textarea
                    ref={celTextareaRef}
                    rows={10}
                    value={form.cel}
                    onChange={(e) => {
                      celCursorRef.current = e.target.selectionStart ?? e.target.value.length;
                      setForm((f) => ({ ...f, cel: e.target.value }));
                    }}
                    onSelect={(e) => {
                      celCursorRef.current = e.currentTarget.selectionStart ?? 0;
                    }}
                    onKeyUp={(e) => {
                      celCursorRef.current = e.currentTarget.selectionStart ?? 0;
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                      setCelDragOver(true);
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setCelDragOver(true);
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget === e.target) setCelDragOver(false);
                    }}
                    onDrop={handleCelDrop}
                    placeholder="Enter CEL expression, or drag a variable from the panel on the right"
                    className="w-full resize-y rounded-md border px-3 py-2.5 font-mono text-[12px] leading-relaxed focus:outline-none"
                    style={
                      celDragOver
                        ? { borderColor: "#2563eb", boxShadow: "0 0 0 2px #dbeafe" }
                        : { borderColor: "#d1d5db" }
                    }
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-900">Scope</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.create}
                        onChange={(e) => setForm((f) => ({ ...f, create: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Create
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.update}
                        onChange={(e) => setForm((f) => ({ ...f, update: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Update
                    </label>
                  </div>
                </div>
              </div>

              <div className="w-64 shrink-0 border-l border-gray-200 flex flex-col px-4 py-5">
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Variables</label>
                <input
                  value={variableFilter}
                  onChange={(e) => setVariableFilter(e.target.value)}
                  placeholder="Search variables"
                  className="mb-2 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mb-2 text-[11px] text-gray-500">
                  Drag onto the expression, or click to insert.
                </p>
                <div className="flex-1 overflow-y-auto">
                  {variablesLoading && <p className="text-xs text-gray-500">Loading variables…</p>}
                  {variablesError && !variablesLoading && (
                    <p className="text-xs text-red-600">{variablesError}</p>
                  )}
                  {!variablesLoading && !variablesError && filteredCatalogVariables.length === 0 && (
                    <p className="text-xs text-gray-500">No variables found.</p>
                  )}
                  {!variablesLoading &&
                    !variablesError &&
                    filteredCatalogVariables.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        draggable
                        onDragStart={(e) => handleVariableDragStart(e, v.name)}
                        onClick={() => insertIntoCel(v.name)}
                        title={v.description}
                        className="block w-full rounded-md border border-transparent px-2 py-1.5 text-left hover:border-gray-200 hover:bg-gray-50 cursor-grab active:cursor-grabbing"
                      >
                        <div className="break-all font-mono text-xs text-gray-900">{v.name}</div>
                        <div className="text-[10px] text-gray-400">{v.category}</div>
                      </button>
                    ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDrawer}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Save Validation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
