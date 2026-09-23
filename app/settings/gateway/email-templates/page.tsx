"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Mail, Plus, Archive, Search, FileCode2 } from "lucide-react";
import AgGridReact from "@/components/ClientOnlyAgGrid";
import "@/lib/ag-grid-setup";
import { ColDef, GridApi, GetRowIdParams, RowClickedEvent } from "ag-grid-enterprise";
import { defaultColDef } from "@/components/dashboard/columnDefs";
import { useLoading } from "@/contexts/LoadingContext";

interface EmailTemplate {
  id: number;
  templateCode: string;
  templateName: string;
  description: string;
  subject: string;
  body: string;
  templateType: string;
  active: boolean;
  parameters: string[];
  mandatoryEmailParameters: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data: EmailTemplate[];
  timestamp: string;
}

export default function GatewayEmailTemplatesSettings() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { showApiLoader, hideApiLoader } = useLoading();

  // Fetch templates from API
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        showApiLoader?.(true, "Loading email templates...");

        const response = await fetch(
          "https://preview.keyforge.ai/kfmailserver/templates/api/v1/ACMECOM/getall"
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch templates: ${response.statusText}`);
        }

        const result: ApiResponse = await response.json();

        if (result.success && result.data) {
          setTemplates(result.data);
        } else {
          throw new Error(result.message || "Failed to load templates");
        }
      } catch (err) {
        console.error("Error fetching email templates:", err);
        setError(err instanceof Error ? err.message : "Failed to load templates");
      } finally {
        setLoading(false);
        hideApiLoader?.();
      }
    };

    fetchTemplates();
  }, [showApiLoader, hideApiLoader]);

  const handleAddTemplate = () => {
    router.push("/settings/gateway/email-templates/new");
  };

  const handleRowClick = (event: RowClickedEvent<EmailTemplate>) => {
    if (event.data) {
      router.push(`/settings/gateway/email-templates/${event.data.id}`);
    }
  };

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) =>
      [t.templateCode, t.templateName, t.description, t.templateType]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q))
    );
  }, [templates, searchQuery]);

  // Column definitions for AG Grid
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: "Template Code",
      field: "templateCode",
      width: 200,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <span className="inline-flex items-center gap-1.5 text-gray-700">
          <FileCode2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="truncate">{params.value}</span>
        </span>
      ),
    },
    {
      headerName: "Template Name",
      field: "templateName",
      width: 300,
      sortable: true,
      filter: true,
      wrapText: true,
      autoHeight: true,
      cellClass: "font-medium text-gray-900",
    },
    {
      headerName: "Description",
      field: "description",
      width: 300,
      sortable: true,
      filter: true,
      wrapText: true,
      autoHeight: true,
    },
    {
      headerName: "Template Type",
      field: "templateType",
      width: 160,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) =>
        params.value ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
            {params.value}
          </span>
        ) : null,
    },
    {
      headerName: "Status",
      field: "active",
      width: 120,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        return params.value ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            Inactive
          </span>
        );
      },
    },
  ], []);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar: search + count + add */}
      <div className="border-b border-gray-200 px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-96 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code, name, description, type..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 whitespace-nowrap">
            <Mail className="w-3.5 h-3.5" />
            Templates: <span className="text-blue-900 font-semibold">{filteredTemplates.length}</span>
          </span>

          <div className="ml-auto">
            <button
              onClick={handleAddTemplate}
              className="flex items-center gap-2 rounded-full px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Email Template
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-gray-50 p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
            <p className="font-medium">Error loading templates</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600 text-sm">Loading templates...</p>
            </div>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24">
            <Archive className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-400 text-base">No templates found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="w-full h-full ag-theme-alpine">
              <AgGridReact
                rowData={filteredTemplates}
                getRowId={(params: GetRowIdParams) => params.data.id.toString()}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                domLayout="autoHeight"
                onRowClicked={handleRowClick}
                rowSelection="single"
                onGridReady={(params) => {
                  setGridApi(params.api);
                  params.api.sizeColumnsToFit();
                  const handleResize = () => {
                    try {
                      params.api.sizeColumnsToFit();
                    } catch {}
                  };
                  window.addEventListener("resize", handleResize);
                  params.api.addEventListener('gridPreDestroyed', () => {
                    window.removeEventListener("resize", handleResize);
                  });
                }}
                pagination={true}
                paginationPageSize={20}
                paginationPageSizeSelector={[10, 20, 50, 100]}
                overlayLoadingTemplate={`<span class="ag-overlay-loading-center">⏳ Loading templates...</span>`}
                overlayNoRowsTemplate={`<span class="ag-overlay-loading-center">No templates found.</span>`}
                className="ag-main"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
