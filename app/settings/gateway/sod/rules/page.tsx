"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { themeQuartz } from "ag-grid-community";
import Link from "next/link";
import { Eye, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import SodTabs from "@/components/SodTabs";
import dynamic from "next/dynamic";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-enterprise";
import "@/lib/ag-grid-setup";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

const BUSINESS_PROCESS_NAME_BY_ID: Record<string, string> = {
  BP1: "Procure to Pay",
  BP2: "Revenue and Credit Management",
  BP3: "Directory Access Administration",
  BP4: "Identity Governance and Access App",
  BP5: "HR Lifecycle Management",
  BP6: "HCM Platform Operations",
};

const DUMMY_OWNERS = ["SysAdm", "RiskAdmin", "AccessOps", "AuditLead"];
const DUMMY_CREATED_ON = [
  "01/08/2026",
  "01/22/2026",
  "02/03/2026",
  "02/17/2026",
  "03/01/2026",
  "03/10/2026",
];
const SOD_RULE_VIEW_STORAGE_KEY = "sodRuleViewDraft";
const SOD_RULE_EDIT_STORAGE_KEY = "sodRuleEditDraft";

export default function SodRulesPage() {
  type SodRuleRow = {
    ruleId: string;
    name: string;
    description: string;
    owner: string;
    createdOn: string;
    businessProcess: string;
  };

  type SodRuleJson = {
    Rule_ID?: string;
    Rule_Name?: string;
    Description?: string;
    Owner?: string;
    "Created On"?: string;
    "Business Process ID"?: string;
    "Business Process Name"?: string;
  };

  const router = useRouter();
  const { isVisible, sidebarWidthPx } = useLeftSidebar();
  const gridApiRef = useRef<GridApi | null>(null);
  const [rowData, setRowData] = useState<SodRuleRow[]>([]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Rule Id",
        field: "ruleId",
        minWidth: 110,
        width: 110,
        suppressSizeToFit: true,
      },
      {
        headerName: "Rule Name",
        field: "name",
        minWidth: 260,
        flex: 2.8,
      },
      {
        headerName: "Description",
        field: "description",
        minWidth: 380,
        flex: 4.2,
        wrapText: true,
        autoHeight: true,
      },
      {
        headerName: "Owner",
        field: "owner",
        minWidth: 120,
        flex: 0.9,
      },
      {
        headerName: "Created On",
        field: "createdOn",
        minWidth: 130,
        flex: 0.9,
      },
      {
        headerName: "Business Process Name",
        field: "businessProcess",
        minWidth: 230,
        flex: 2.5,
        wrapText: true,
        autoHeight: true,
      },
      {
        headerName: "Action",
        field: "actions",
        width: 150,
        minWidth: 150,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: (params: { data?: SodRuleRow }) => (
          <div className="h-full w-full flex items-center justify-center gap-4">
            <button
              type="button"
              className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
              aria-label="View rule"
              title="View"
              onClick={() => {
                if (!params.data) return;
                try {
                  localStorage.setItem(SOD_RULE_VIEW_STORAGE_KEY, JSON.stringify(params.data));
                } catch (error) {
                  console.error("Unable to save rule review draft:", error);
                }
                router.push("/settings/gateway/sod/rules/review");
              }}
            >
              <Eye className="w-6 h-6" />
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
              aria-label="Edit rule"
              title="Edit"
              onClick={() => {
                if (!params.data) return;
                try {
                  localStorage.setItem(SOD_RULE_EDIT_STORAGE_KEY, JSON.stringify(params.data));
                } catch (error) {
                  console.error("Unable to save rule edit draft:", error);
                }
                router.push("/settings/gateway/sod/rules/new?mode=edit");
              }}
            >
              <Pencil className="w-6 h-6" />
            </button>
          </div>
        ),
      },
    ],
    [router]
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: false,
      resizable: true,
    }),
    []
  );

  const fitColumns = useCallback(() => {
    if (!gridApiRef.current) return;
    gridApiRef.current.sizeColumnsToFit();
  }, []);

  const handleGridReady = useCallback(
    (params: GridReadyEvent) => {
      gridApiRef.current = params.api;
      fitColumns();
    },
    [fitColumns]
  );

  useEffect(() => {
    let cancelled = false;

    const loadRules = async () => {
      try {
        const response = await fetch("/SOdRules.json");
        if (!response.ok) {
          throw new Error(`Failed to load SOdRules.json: ${response.status}`);
        }

        const json = (await response.json()) as SodRuleJson[];
        if (cancelled) return;

        const mappedRows: SodRuleRow[] = json.map((rule, index) => {
          const businessProcess =
            rule["Business Process Name"] ||
            (rule["Business Process ID"]
              ? BUSINESS_PROCESS_NAME_BY_ID[rule["Business Process ID"]] || rule["Business Process ID"]
              : "");
          const ruleName = (rule.Rule_Name ?? "").trim();
          const description = (rule.Description ?? "").trim();
          const owner = (rule.Owner ?? "").trim();
          const createdOn = (rule["Created On"] ?? "").trim();

          return {
            ruleId: rule.Rule_ID ?? "",
            name: ruleName,
            description:
              description ||
              `Controls access for ${ruleName || "this rule"} within ${businessProcess || "the assigned business process"}.`,
            owner: owner || DUMMY_OWNERS[index % DUMMY_OWNERS.length],
            createdOn: createdOn || DUMMY_CREATED_ON[index % DUMMY_CREATED_ON.length],
            businessProcess,
          };
        });

        setRowData(mappedRows);
      } catch (error) {
        console.error("Error loading SOd rules:", error);
      }
    };

    loadRules();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!gridApiRef.current) return;
    const timer = window.setTimeout(() => {
      fitColumns();
    }, 320);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fitColumns, isVisible, sidebarWidthPx]);

  return (
    <div className="h-[calc(100vh-60px)] w-full">
      <div className="h-full w-full flex flex-col space-y-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SoD</h1>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col">
          <SodTabs />

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Rules</h2>
            <Link
              href="/settings/gateway/sod/rules/new"
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New</span>
            </Link>
          </div>

          <div className="flex-1 min-h-0">
            <div className="ag-theme-alpine w-full">
              <AgGridReact
                rowData={rowData}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                theme={themeQuartz}
                rowSelection="multiple"
                rowModelType="clientSide"
                animateRows={true}
                domLayout="autoHeight"
                onGridReady={handleGridReady}
                onGridSizeChanged={fitColumns}
                onFirstDataRendered={fitColumns}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

