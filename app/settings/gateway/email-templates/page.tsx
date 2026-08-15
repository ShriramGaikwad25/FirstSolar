"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Mail, Plus, Archive } from "lucide-react";
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

  // Column definitions for AG Grid
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: "Template Code",
      field: "templateCode",
      width: 200,
      sortable: true,
      filter: true,
    },
    {
      headerName: "Template Name",
      field: "templateName",
      width: 300,
      sortable: true,
      filter: true,
      wrapText: true,
      autoHeight: true,
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
      width: 150,
      sortable: true,
      filter: true,
    },
    {
      headerName: "Status",
      field: "active",
      width: 120,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        return params.value ? (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
            Active
          </span>
        ) : (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
            Inactive
          </span>
        );
      },
    },
  ], []);

  return (
    <div className="h-full flex flex-col">
      {/* Green Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 h-16 text-white" style={{ backgroundColor: '#27B973' }}>
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-white" />
          <h1 className="text-2xl font-semibold text-white">Email Templates</h1>
        </div>
        <button
          onClick={handleAddTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-white text-[#27B973] rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Email Template
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-gray-50 p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
              <p className="font-medium">Error loading templates</p>
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#27B973] mx-auto mb-4"></div>
                <p className="text-gray-600">Loading templates...</p>
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Archive className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-400 text-base">No templates found</p>
            </div>
          ) : (
            <div className="w-full h-full p-6">
              <div className="h-full w-full">
                <AgGridReact
                  rowData={templates}
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
    </div>
  );
}
