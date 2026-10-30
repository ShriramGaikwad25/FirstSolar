"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, Pencil, Plus, Search, Trash2, Info } from "lucide-react";
import CustomPagination from "@/components/agTable/CustomPagination";
import ActionCompletedToast from "@/components/ActionCompletedToast";
import Modal from "@/components/Modal";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import { getJwtAuthHeaders, resolveTenantIdForHeader } from "@/lib/auth";
import { getBackendOrigin } from "@/lib/backendOrigin";

interface CustomSchemaRow {
  id: string;
  name: string;
  description: string;
  dataType: string;
  scimAttribute: string;
}

const inputClass =
  "border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelClass = "block text-sm text-gray-700 mb-1";
const secondaryButtonClass =
  "rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass =
  "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const dangerButtonClass =
  "rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60";

const customFieldUrl = () =>
  `${getBackendOrigin()}/scimattribute/${resolveTenantIdForHeader()}/customfield`;

/** The API replaces the whole list on every POST, so add/edit/delete all send the full set. */
async function saveRows(rows: CustomSchemaRow[]) {
  const payload = rows.map((r, idx) => ({
    name: r.name,
    description: r.description,
    customAttr: r.scimAttribute,
    key: idx,
  }));
  const res = await fetch(customFieldUrl(), {
    method: "POST",
    headers: getJwtAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Save failed: ${res.status}`);
  }
}

/** Next free customAttrN, so a deleted slot's attribute is never reused by a different field. */
function nextScimAttribute(rows: CustomSchemaRow[]): string {
  const used = new Set(rows.map(r => r.scimAttribute));
  let n = rows.length + 1;
  while (used.has(`customAttr${n}`)) n++;
  return `customAttr${n}`;
}

/** Shared Add / Edit form shown in the right sidebar. */
function SchemaForm({
  initial,
  scimAttribute,
  takenNames,
  submitLabel,
  onSave,
  onCancel,
}: {
  initial?: { name: string; description: string };
  scimAttribute: string;
  /** Lower-cased names of the other attributes, for the duplicate check. */
  takenNames: Set<string>;
  submitLabel: string;
  onSave: (name: string, description: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const isDuplicate = takenNames.has(trimmedName.toLowerCase());
  const isUnchanged =
    !!initial && trimmedName === initial.name && description.trim() === initial.description;
  const canSave = trimmedName.length > 0 && !isDuplicate && !isUnchanged && !submitting;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      setSubmitting(true);
      setSaveError(null);
      await onSave(trimmedName, description.trim());
    } catch (e: any) {
      setSaveError(e?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={labelClass}>
          Name <span className="text-red-500">*</span>
        </label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
          className={`${inputClass} ${isDuplicate ? "border-red-400" : ""}`}
          placeholder="e.g. Cost Center"
          maxLength={100}
        />
        {isDuplicate && (
          <p className="mt-1 text-xs text-red-600">An attribute with this name already exists.</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          className={`${inputClass} h-24 resize-none`}
          placeholder="What this attribute holds and where it is used"
          maxLength={500}
        />
        <p className="mt-1 text-right text-xs text-gray-400">{description.length}/500</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Data Type</label>
          <input value="String" disabled className={`${inputClass} bg-gray-100 text-gray-600`} />
        </div>
        <div>
          <label className={labelClass}>SCIM Attribute</label>
          <input value={scimAttribute} disabled className={`${inputClass} bg-gray-100 font-mono text-gray-600`} />
        </div>
      </div>

      <div className="flex gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          The SCIM attribute is assigned automatically and stays the same when the attribute is renamed,
          so existing mappings keep working.
        </span>
      </div>

      {saveError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {saveError}
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
        <button type="button" className={secondaryButtonClass} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={primaryButtonClass} onClick={handleSave} disabled={!canSave}>
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </div>
  );
}

export default function GatewayCustomSchemaSettings() {
  const [rows, setRows] = useState<CustomSchemaRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(10);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomSchemaRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { openSidebar, closeSidebar } = useRightSidebar();

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(customFieldUrl(), { signal: controller.signal, headers: getJwtAuthHeaders() });
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        const data: Array<{ name: string; description: string; customAttr: string }> = await res.json();
        const mapped: CustomSchemaRow[] = (Array.isArray(data) ? data : []).map((item, idx) => ({
          id: String(idx + 1),
          name: item.name ?? "",
          description: item.description ?? "",
          dataType: "String",
          scimAttribute: item.customAttr ?? "",
        }));
        setRows(mapped);
      } catch (e: any) {
        if (e.name !== "AbortError") {
          setError(e?.message || "Failed to load custom attributes");
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.name, r.description, r.scimAttribute].some(v => v.toLowerCase().includes(q))
    );
  }, [rows, query]);

  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedRows =
    pageSize === "all" ? filtered : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const namesExcept = (id?: string) =>
    new Set(rows.filter(r => r.id !== id).map(r => r.name.trim().toLowerCase()));

  const handleAdd = () => {
    const scimAttribute = nextScimAttribute(rows);
    openSidebar(
      <SchemaForm
        scimAttribute={scimAttribute}
        takenNames={namesExcept()}
        submitLabel="Add Attribute"
        onCancel={closeSidebar}
        onSave={async (name, description) => {
          const next = [
            ...rows,
            { id: `new-${Date.now()}`, name, description, dataType: "String", scimAttribute },
          ];
          await saveRows(next);
          setRows(next);
          closeSidebar();
          setToast(`Attribute "${name}" added.`);
        }}
      />,
      { title: "Add Custom Attribute", widthPx: 520 }
    );
  };

  const handleEdit = (row: CustomSchemaRow) => {
    openSidebar(
      <SchemaForm
        initial={{ name: row.name, description: row.description }}
        scimAttribute={row.scimAttribute}
        takenNames={namesExcept(row.id)}
        submitLabel="Save Changes"
        onCancel={closeSidebar}
        onSave={async (name, description) => {
          const next = rows.map(r => (r.id === row.id ? { ...r, name, description } : r));
          await saveRows(next);
          setRows(next);
          closeSidebar();
          setToast(`Attribute "${name}" updated.`);
        }}
      />,
      { title: "Edit Custom Attribute", widthPx: 520 }
    );
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const remaining = rows.filter(r => r.id !== pendingDelete.id);
    try {
      setDeleting(true);
      setDeleteError(null);
      await saveRows(remaining);
      setRows(remaining);
      setCurrentPage(p => Math.min(p, Math.max(1, Math.ceil(remaining.length / (pageSize === "all" ? 1 : pageSize)))));
      setToast(`Attribute "${pendingDelete.name}" deleted.`);
      setPendingDelete(null);
    } catch (e: any) {
      setDeleteError(e?.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="h-full">
      <div className="w-full px-6 py-6">
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 pointer-events-none" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search name, description, attribute..."
              className="w-full pl-9 pr-3 py-2.5 rounded-md border border-blue-500 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isLoading || !!error}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            Add Attribute
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
          {error && (
            <div className="mx-5 my-3 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {error}
            </div>
          )}

          {!error && !isLoading && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-sm font-semibold text-gray-900">No custom attributes yet</div>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                Add an attribute to store user data that the standard schema doesn&apos;t cover.
              </p>
              <button type="button" onClick={handleAdd} className={`${primaryButtonClass} mt-5 inline-flex items-center gap-2`}>
                <Plus className="w-4 h-4" />
                Add Attribute
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 w-[22%]">Name</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 w-32">Data Type</th>
                    <th className="px-4 py-3 w-44">SCIM Attribute</th>
                    <th className="px-4 py-3 w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading &&
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={`skeleton-${i}`} className="animate-pulse">
                        <td className="px-4 py-4"><div className="h-3.5 w-28 rounded bg-gray-200" /></td>
                        <td className="px-4 py-4"><div className="h-3.5 w-64 rounded bg-gray-100" /></td>
                        <td className="px-4 py-4"><div className="h-5 w-14 rounded-full bg-gray-100" /></td>
                        <td className="px-4 py-4"><div className="h-5 w-24 rounded bg-gray-100" /></td>
                        <td className="px-4 py-4" />
                      </tr>
                    ))}
                  {!isLoading && paginatedRows.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 align-top text-sm font-semibold text-gray-900">
                        {r.name || <span className="italic font-normal text-gray-400">Unnamed</span>}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700">
                        {r.description || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
                          {r.dataType}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
                          {r.scimAttribute}
                        </code>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Edit"
                            aria-label={`Edit ${r.name}`}
                            onClick={() => handleEdit(r)}
                            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            aria-label={`Delete ${r.name}`}
                            onClick={() => setPendingDelete(r)}
                            className="rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && !error && rows.length > 0 && paginatedRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                        No attributes match the current search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > 0 && (
            <div className="border-t border-gray-200 px-5 py-3">
              <CustomPagination
                totalItems={filtered.length}
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={sz => { setPageSize(sz); setCurrentPage(1); }}
                pageSizeOptions={[10, 20, 50, 100, "all"]}
              />
            </div>
          )}
        </div>
      </div>

      <Modal
        open={!!pendingDelete}
        title="Delete custom attribute?"
        onClose={closeDeleteDialog}
        footer={
          <>
            <button type="button" className={secondaryButtonClass} onClick={closeDeleteDialog} disabled={deleting}>
              Cancel
            </button>
            <button type="button" className={dangerButtonClass} onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </>
        }
      >
        {pendingDelete && (
          <div className="space-y-3">
            <p>
              <span className="font-semibold text-gray-900">{pendingDelete.name}</span>{" "}
              (<code className="font-mono text-xs">{pendingDelete.scimAttribute}</code>) will be removed from the schema.
              Integrations or policies that map to this attribute will stop receiving its value.
            </p>
            {deleteError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                {deleteError}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ActionCompletedToast
        isVisible={!!toast}
        message={toast || ""}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
