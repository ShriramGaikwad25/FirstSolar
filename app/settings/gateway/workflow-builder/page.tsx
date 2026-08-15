"use client";

import React, { useEffect, useMemo, useState } from "react";
import { themeQuartz } from "ag-grid-community";
import { Eye, Plus } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { ColDef } from "ag-grid-enterprise";
import { executeQuery } from "@/lib/api";
import { useRouter } from "next/navigation";

import "@/lib/ag-grid-setup";

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

type WorkflowPolicyRow = {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  business_object_type: string | null;
  status: string | null;
  code?: string | null;
  definition_json?: any | null;
};

// Demo records for the Agent Task workflows — not backed by kf_wf_template_t,
// merged in client-side so the two sample flows are always available to open in the builder.
const DUMMY_WORKFLOW_ROWS: WorkflowPolicyRow[] = [
  {
    id: "wf-dummy-ent-desc-gen",
    name: "Agent task workflow for Entitlement description generation",
    description:
      "Workflow assigned to identity and generate descriptions for entitlements",
    created_by: "tushar rao",
    business_object_type: "Assurance_Event",
    status: "Active",
    code: "CCE-1001",
    definition_json: {
      stages: [
        {
          id: "stage-1",
          name: "Validate",
          order: 1,
          steps: [{ code: "AGENT_TASK", name: "Entitlement Description Generator" }],
        },
        {
          id: "stage-2",
          name: "Approval",
          order: 2,
          steps: [
            {
              code: "APPROVAL_ENTITLEMENT_OWNER",
              name: "Entitlement Owner Approval",
              condition: { expression: "AgentTask.Confidence > 90" },
            },
          ],
        },
        {
          id: "stage-3",
          name: "Fulfillment",
          order: 3,
          steps: [{ code: "FULFILLMENT", name: "Fulfillment Event" }],
        },
      ],
    },
  },
  {
    id: "wf-dummy-svc-acct-owner",
    name: "Agent task workflow for Service Account owner resolution",
    description:
      "Workflow assigned to find owners for service accounts with no current ownership",
    created_by: "tushar rao",
    business_object_type: "Assurance_Event",
    status: "Active",
    code: "CCE-1008",
    definition_json: {
      stages: [
        {
          id: "stage-1",
          name: "Validate",
          order: 1,
          steps: [{ code: "AGENT_TASK", name: "Service Account Owner Resolver" }],
        },
        {
          id: "stage-2",
          name: "Approval",
          order: 2,
          steps: [
            {
              code: "APPROVAL_APPLICATION_OWNER",
              name: "Application Owner Approval",
              condition: { expression: "AgentTask.Confidence > 90" },
            },
          ],
        },
        {
          id: "stage-3",
          name: "Fulfillment",
          order: 3,
          steps: [{ code: "ITSM_CREATE_TICKET", name: "ITSM Create Ticket" }],
        },
      ],
    },
  },
];

export default function WorkflowBuilderPage() {
  const [rows, setRows] = useState<WorkflowPolicyRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const query = "select * from kf_wf_template_t order by ?";
        const parameters = [""];

        const response = await executeQuery<any>(query, parameters);
        const rowsFromApi: any[] =
          Array.isArray(response)
            ? response
            : Array.isArray((response as any).resultSet)
            ? (response as any).resultSet
            : Array.isArray((response as any).rows)
            ? (response as any).rows
            : [];

        const normalized: WorkflowPolicyRow[] = rowsFromApi.map((row, idx) => ({
          id:
            String(
              row.id ??
                row.policy_id ??
                row.policyid ??
                row.name ??
                idx
            ) || String(idx),
          name:
            row.name ??
            row.policy_name ??
            row.POLICY_NAME ??
            "Unnamed Workflow",
          description:
            row.description ??
            row.policy_description ??
            row.POLICY_DESCRIPTION ??
            null,
          created_by:
            row.created_by ??
            row.CREATED_BY ??
            row.owner ??
            null,
          business_object_type:
            row.business_object_type ??
            row.BUSINESS_OBJECT_TYPE ??
            row.type ??
            null,
          status:
            row.status ??
            row.STATUS ??
            row.policy_status ??
            row.state ??
            null,
          code: row.code ?? null,
          definition_json: row.definition_json ?? row.definitionJson ?? null,
        }));

        setRows([...DUMMY_WORKFLOW_ROWS, ...normalized]);
      } catch (e: any) {
        console.error("Failed to load workflow policies:", e);
        setRows(DUMMY_WORKFLOW_ROWS);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflows();
  }, []);

  const workflowColumnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Name",
        field: "name",
        minWidth: 280,
        flex: 2,
        wrapText: true,
        autoHeight: true,
      },
      {
        headerName: "Description",
        field: "description",
        minWidth: 320,
        flex: 3,
        wrapText: true,
        autoHeight: true,
      },
      {
        headerName: "Created By",
        field: "created_by",
        minWidth: 180,
        width: 180,
        suppressSizeToFit: true,
      },
      {
        headerName: "Type",
        field: "business_object_type",
        minWidth: 160,
        width: 160,
        suppressSizeToFit: true,
      },
      {
        headerName: "Status",
        field: "status",
        minWidth: 140,
        width: 140,
        suppressSizeToFit: true,
      },
      {
        headerName: "Action",
        field: "actions",
        minWidth: 140,
        width: 140,
        suppressSizeToFit: true,
        cellRenderer: (params: any) => {
          const row = params.data as WorkflowPolicyRow;
          return (
            <button
              type="button"
              className="p-1 rounded hover:bg-gray-100 flex items-center justify-center"
              title="View"
              aria-label="View"
              onClick={() => {
                try {
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(
                      "selectedWorkflowPolicy",
                      JSON.stringify(row)
                    );
                  }
                } catch {
                  // ignore storage errors
                }
                router.push(`/settings/gateway/workflow-builder/new?id=${encodeURIComponent(row.id)}&view=1`);
              }}
            >
              <Eye className="w-4 h-4 text-blue-600" />
            </button>
          );
        },
      },
    ],
    [router]
  );

  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Workflow Builder
            </h1>
            <p className="text-gray-600 text-sm">
              Manage and design approval workflows. Use the table to view existing configurations, or create a new workflow.
            </p>
          </div>
          <Link
            href="/settings/gateway/workflow-builder/new"
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            <Plus className="w-4 h-4" />
            <span>Create New</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="h-72 flex items-center justify-center text-sm text-gray-600">
            Loading workflows...
          </div>
        ) : error ? (
          <div className="h-72 flex items-center justify-center text-sm text-red-600">
            {error}
          </div>
        ) : (
          <div className="ag-theme-alpine w-full workflow-builder-grid">
            <AgGridReact
              theme={themeQuartz}
              rowData={rows}
              columnDefs={workflowColumnDefs}
              rowSelection="single"
              rowModelType="clientSide"
              animateRows={true}
              domLayout="autoHeight"
              getRowClass={(params) =>
                (params.node.rowIndex ?? 0) % 2 === 0
                  ? "workflow-row-even"
                  : "workflow-row-odd"
              }
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
              }}
              onGridReady={(params) => {
                params.api.sizeColumnsToFit();
              }}
            />
          </div>
        )}
      </div>
      <style jsx global>{`
        .workflow-builder-grid .ag-row {
          border-bottom: 1px solid #e5e7eb;
        }

        .workflow-builder-grid .ag-row.workflow-row-even {
          background-color: #ffffff;
        }

        .workflow-builder-grid .ag-row.workflow-row-odd {
          background-color: #f8fafc;
        }
      `}</style>
    </div>
  );
}


