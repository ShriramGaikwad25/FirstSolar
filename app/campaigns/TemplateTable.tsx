"use client";

import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then(mod => mod.AgGridReact), { ssr: false });
type AgGridReactType = any;
import "@/lib/ag-grid-setup";
import { ColDef, ICellRendererParams } from "ag-grid-enterprise";
import { Edit, Calendar, Trash2, Copy } from "lucide-react";
import { apiRequestWithAuth } from "@/lib/auth";

type TemplateRow = {
  id: string;
  name: string;
  type: string;
  owner: string;
  createdOn: string | null;
  lastRun: string | null;
  nextRun: string | null;
  templateData?: any; // Store full template data for editing
};

interface TemplateTableProps {
  onEdit: (template: TemplateRow) => void;
  onRunNow: (template: TemplateRow) => void;
  onDelete?: (template: TemplateRow) => void;
  onClone?: (template: TemplateRow) => void;
}

const TemplateTable: React.FC<TemplateTableProps> = ({ onEdit, onRunNow, onDelete, onClone }) => {
  const gridRef = React.useRef<AgGridReactType>(null);
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const data = await apiRequestWithAuth<any>(
          "https://preview.keyforge.ai/campaign/api/v1/ACMECOM/getAllCampaigns",
          {
            method: "GET",
          }
        );

        // Handle different response structures
        let campaignsArray: any[] = [];
        if (Array.isArray(data)) {
          campaignsArray = data;
        } else if (data && typeof data === "object") {
          campaignsArray = data.items || data.data || data.campaigns || data.results || [];
          if (campaignsArray.length === 0 && (data.id || data.name || data.campaignID)) {
            campaignsArray = [data];
          }
        }

        // Transform API response to TemplateRow format
        const transformedRows: TemplateRow[] = campaignsArray.map((campaign: any) => {
          // Extract owner information
          const ownerInfo = campaign.campaignOwner || campaign.owner || {};
          const ownerName = Array.isArray(ownerInfo.ownerName) 
            ? ownerInfo.ownerName.join(", ") 
            : ownerInfo.ownerName || ownerInfo.ownerType || "Unknown";

          return {
            id: campaign.id || campaign.campaignID || campaign.campaignId || String(campaign.id || ""),
            name: campaign.name || campaign.campaignName || campaign.templateName || "Unnamed Campaign",
            type: campaign.type || campaign.campaignType || campaign.templateType || "Standard",
            owner: ownerName,
            createdOn:
              campaign.campaignCreatedAt ??
              campaign.createdOn ??
              campaign.createdDate ??
              campaign.created ??
              null,
            lastRun: campaign.lastRun || campaign.lastRunDate || campaign.lastExecutionDate || null,
            nextRun: campaign.nextRun || campaign.nextRunDate || campaign.scheduledDate || null,
            templateData: campaign, // Store full campaign data for editing
          };
        });

        setRows(transformedRows);
      } catch (err: any) {
        console.error("Error fetching campaigns:", err);
        setError(err.message || "Failed to fetch campaigns");
        setRows([]); // Set empty array on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, []);


  const columnDefs = React.useMemo<ColDef[]>(
    () => [
      {
        headerName: "Name",
        field: "name",
        flex: 3,
        minWidth: 300,
        wrapText: true,
        autoHeight: true,
        sortable: true,
        filter: true,
        cellStyle: {
          whiteSpace: "normal",
          lineHeight: "1.3",
          display: "flex",
          alignItems: "center",
        },
      },
      {
        headerName: "Type",
        field: "type",
        flex: 2.25,
        minWidth: 220,
        wrapText: true,
        autoHeight: true,
        sortable: true,
        filter: true,
        cellStyle: {
          whiteSpace: "normal",
          lineHeight: "1.3",
          display: "flex",
          alignItems: "center",
        },
      },
      {
        headerName: "Owner",
        field: "owner",
        width: 160,
        minWidth: 140,
        sortable: true,
        filter: true,
      },
      {
        headerName: "Created On",
        field: "createdOn",
        width: 150,
        minWidth: 130,
        sortable: true,
        filter: true,
        valueFormatter: (params: any) => {
          if (!params.value) return "";
          return new Date(params.value).toLocaleDateString();
        },
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 180,
        minWidth: 160,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams) => {
          return (
            <div className="flex items-center gap-2 h-full">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(params.data);
                }}
                className="p-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-900 border border-blue-200 hover:border-blue-300 transition-colors"
                title="Edit"
                aria-label="Edit template"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRunNow(params.data);
                }}
                className="p-1.5 rounded-md bg-green-50 hover:bg-green-100 text-green-700 hover:text-green-900 border border-green-200 hover:border-green-300 transition-colors"
                title="Schedule"
                aria-label="Schedule template"
              >
                <Calendar className="w-4 h-4" />
              </button>
              {onClone && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClone(params.data);
                  }}
                  className="p-1.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 border border-purple-200 hover:border-purple-300 transition-colors"
                  title="Clone"
                  aria-label="Clone template"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(params.data);
                  }}
                  className="p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-900 border border-red-200 hover:border-red-300 transition-colors"
                  title="Delete"
                  aria-label="Delete template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [onEdit, onRunNow, onDelete, onClone]
  );

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-8">
        <div className="text-gray-600">Loading campaigns...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex items-center justify-center py-8">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ width: "100%", minWidth: 0 }}>
      <AgGridReact
        ref={gridRef}
        rowData={rows}
        columnDefs={columnDefs}
        rowSelection="multiple"
        rowModelType="clientSide"
        animateRows={true}
        domLayout="autoHeight"
        defaultColDef={{
          sortable: true,
          filter: true,
          resizable: true,
        }}
        suppressSizeToFit={true}
      />
    </div>
  );
};

export default TemplateTable;



