"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Droplet } from "lucide-react";
import ClientOnlyAgGrid from "@/components/ClientOnlyAgGrid";
import CustomPagination from "@/components/agTable/CustomPagination";
import { useRightSidebar } from "@/contexts/RightSidebarContext";

interface CustomSchemaRow {
  id: string;
  name: string;
  description: string;
  dataType: string;
  scimAttribute: string;
}

export default function GatewayCustomSchemaSettings() {
  const [rows, setRows] = useState<CustomSchemaRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { openSidebar, closeSidebar } = useRightSidebar();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(
          "https://preview.keyforge.ai/scimattribute/ACMECOM/customfield",
          { signal: controller.signal }
        );
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        const data: Array<{ name: string; description: string; customAttr: string }> = await res.json();
        const mapped: CustomSchemaRow[] = data.map((item, idx) => ({
          id: String(idx + 1),
          name: item.name,
          description: item.description,
          dataType: "String", // default as in screenshot
          scimAttribute: item.customAttr,
        }));
        setRows(mapped);
      } catch (e: any) {
        if (e.name !== "AbortError") {
          setError(e?.message || "Failed to load data");
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  const handleAdd = () => {
    const AddForm = () => {
      const [name, setName] = useState("");
      const [description, setDescription] = useState("");
      const [submitting, setSubmitting] = useState(false);
      const isValid = name.trim().length > 0;

      const handleOk = async () => {
        if (!isValid || submitting) return;
        const nextIndex = rows.length + 1;
        const newRow: CustomSchemaRow = {
          id: String(nextIndex),
          name: name.trim(),
          description: description.trim(),
          dataType: "String",
          scimAttribute: `customAttr${nextIndex}`,
        };

        // Build payload from existing rows + new row
        const payload = [...rows, newRow].map((r, idx) => ({
          name: r.name,
          description: r.description,
          customAttr: r.scimAttribute,
          key: idx,
        }));

        try {
          setSubmitting(true);
          const res = await fetch(
            "https://preview.keyforge.ai/scimattribute/ACMECOM/customfield",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          );
          if (!res.ok) {
            throw new Error(`POST failed: ${res.status}`);
          }
          // After a successful POST, optimistically update local state
          setRows(prev => [...prev, newRow]);
          closeSidebar();
        } catch (e) {
          console.error(e);
        } finally {
          setSubmitting(false);
        }
      };

      return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Add Schema</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <label className="text-sm text-gray-700">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
                placeholder="Name"
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-3">
              <label className="text-sm text-gray-700 mt-2">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full h-24"
                placeholder="Description"
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <label className="text-sm text-gray-700">Data Type</label>
              <select className="border rounded px-3 py-2 text-sm w-full bg-gray-100 text-gray-600" disabled>
                <option>String</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-8">
            <button
              type="button"
              className="px-4 py-2 border rounded text-sm"
              onClick={closeSidebar}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded text-sm text-white ${isValid && !submitting ? '' : 'opacity-60 cursor-not-allowed'}`}
              style={{ backgroundColor: '#0EA5E9' }}
              onClick={handleOk}
              disabled={!isValid || submitting}
            >
              {submitting ? 'Saving...' : 'OK'}
            </button>
          </div>
        </div>
      );
    };

    openSidebar(<AddForm />, { widthPx: 520 });
  };

  const handleEdit = (id: string) => {
    const row = rows.find(r => r.id === id);
    if (!row) return;

    const EditForm = () => {
      const [name, setName] = useState(row.name);
      const [description, setDescription] = useState(row.description);

      const handleOk = () => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, name, description } : r));
        closeSidebar();
      };

      return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Edit Schema</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <label className="text-sm text-gray-700">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
                placeholder="Name"
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-3">
              <label className="text-sm text-gray-700 mt-2">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full h-24"
                placeholder="Description"
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <label className="text-sm text-gray-700">Data Type</label>
              <select className="border rounded px-3 py-2 text-sm w-full bg-gray-100 text-gray-600" disabled>
                <option>String</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-8">
            <button
              type="button"
              className="px-4 py-2 border rounded text-sm"
              onClick={closeSidebar}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded text-sm text-white"
              style={{ backgroundColor: '#0EA5E9' }}
              onClick={handleOk}
            >
              OK
            </button>
          </div>
        </div>
      );
    };

    openSidebar(<EditForm />, { widthPx: 520 });
  };

  const handleDelete = async (id: string) => {
    const remaining = rows.filter((r) => r.id !== id);
    const payload = remaining.map((r, idx) => ({
      name: r.name,
      description: r.description,
      customAttr: r.scimAttribute,
      key: idx,
    }));

    try {
      const res = await fetch(
        "https://preview.keyforge.ai/scimattribute/ACMECOM/customfield",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        throw new Error(`POST failed: ${res.status}`);
      }
      setRows(remaining);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-full p-6">
      <div className="mx-auto">
        <div className="bg-white rounded-md shadow overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 text-white" style={{ backgroundColor: '#27B973' }}>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(39, 185, 115, 0.6)' }}>
                <Droplet className="w-4 h-4" />
              </div>
              <h2 className="font-semibold">Custom Schema Management</h2>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded text-sm font-medium"
              style={{ color: '#27B973' }}
            >
              <span>+ Add</span>
            </button>
          </div>

          <div className="overflow-x-auto mt-3">
            {isLoading && (<div className="px-5 py-3 text-sm text-gray-600">Loading...</div>)}
            {error && (<div className="px-5 py-3 text-sm text-red-600">{error}</div>)}
            <div className="ag-theme-alpine w-full">
              <ClientOnlyAgGrid
                rowData={(pageSize==='all'? rows : rows.slice((currentPage-1)*(pageSize as number), (currentPage)*(pageSize as number)))}
                columnDefs={[
                  { headerName: 'Name', field: 'name', flex: 1 },
                  { headerName: 'Description', field: 'description', flex: 1.5 },
                  { headerName: 'Data Type', field: 'dataType', width: 140 },
                  { headerName: 'SCIM Attribute', field: 'scimAttribute', width: 160 },
                  {
                    headerName: 'Actions', width: 120, cellRenderer: (params: any) => {
                      return (
                        <div className="flex items-center gap-3 text-gray-700">
                          <button type="button" onClick={() => handleEdit(params.data.id)} title="Edit" className="hover:text-gray-900"><Pencil className="w-4 h-4" /></button>
                          <button type="button" onClick={() => handleDelete(params.data.id)} title="Delete" className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      );
                    }
                  }
                ]}
                domLayout="autoHeight"
              />
            </div>
            <div className="mt-1">
              <CustomPagination
                totalItems={rows.length}
                currentPage={currentPage}
                totalPages={pageSize==='all' ? 1 : Math.max(1, Math.ceil(rows.length / (pageSize as number)))}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(sz)=>{ setPageSize(sz); setCurrentPage(1); }}
              />
            </div>
          </div>

          
        </div>
      </div>
    </div>
  );
}


