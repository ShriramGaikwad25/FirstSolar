"use-client";
import React, { useMemo, useState } from "react";
import { themeQuartz } from "ag-grid-community";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then(mod => mod.AgGridReact), { ssr: false });
import "@/lib/ag-grid-setup";
import { BellIcon, DownloadIcon } from "lucide-react";
import { IDetailCellRendererParams, ColDef } from "ag-grid-enterprise";
import { formatDateMMDDYY } from "@/utils/utils";

// Detail Cell Renderer for App View

//           Revocation Details:
//         </span>
//       </div>
//         {details.length > 0 ? (
//           details.map((detail: any, index: number) => (
//               {detail.description}
//               {detail.status && (
//                 <span
//                   className={`ml-2 px-2 py-1 rounded text-xs ${
//                     detail.status === "Completed"
//                       ? "bg-green-100 text-green-800"
//                       : detail.status === "Pending"
//                       ? "bg-yellow-100 text-yellow-800"
//                       : "bg-red-100 text-red-800"
//                   }`}
//                 >
//                   {detail.status}
//                 </span>
//               )}
//             </div>
//           ))
//         ) : (
//             No revocation details available
//           </span>
//         )}
//       </div>
//     </div>
//   );
// };

// Identity | Account | Entitlement | Type | Status | Ticket#  | Evidence
// Detail Cell Renderer Parameters
//   detailGridOptions: {
//     columnDefs: [
//       {
//         field: "identity",
//         headerName: "Identity",
//         flex: 1,
//         cellStyle: { fontWeight: "bold" },
//       },
//       {
//         field: "account",
//         headerName: "Account",
//         flex: 2,
//         wrapText: true,
//         autoHeight: true,
//       },
//             {
//         field: "entitlement",
//         headerName: "Entitlement",
//         flex: 2,
//         wrapText: true,
//         autoHeight: true,
//       },
//             {
//         field: "type",
//         headerName: "Type",
//         flex: 2,
//         wrapText: true,
//         autoHeight: true,
//       },
//       {
//         field: "status",
//         headerName: "Status",
//         flex: 2,
//         wrapText: true,
//         autoHeight: true,
//       },
//             {
//         field: "ticket",
//         headerName: "#Ticket",
//         flex: 2,
//         wrapText: true,
//         autoHeight: true,
//       },
//             {
//         field: "evidence",
//         headerName: "Evidence",
//         flex: 2,
//         wrapText: true,
//         autoHeight: true,
//       },
//     ],
//     defaultColDef: {
//       flex: 1,
//       sortable: true,
//       filter: true,
//       resizable: true,
//     },
//       console.log("Detail grid ready:", params.api);
//       params.api.sizeColumnsToFit();
//     },
//     domLayout: "autoHeight",
//     headerHeight: 40,
//     rowHeight: 50,
//     suppressRowClickSelection: true,
//     rowSelection: "single",
//   },
//     console.log("getDetailRowData called with:", params.data);
//     console.log("Details to show:", details);
//     if (details.length > 0) {
//       console.log("Successfully providing detail data");
//       params.successCallback(details);
//     } else {
//       console.log("No detail data available");
//       params.successCallback([]);
//     }
//   },
// };

const Revocations: React.FC = () => {
  const [view, setView] = useState<"user" | "app">("app");

  // User View Dashboard Column Definitions
  //   { headerName: "Dept Name", field: "deptName", flex: 1 },
  //   { headerName: "Dept Owner", field: "deptOwner", flex: 1 },
  //   { headerName: "# Revocations", field: "revocations", flex: 1 },
  //   { headerName: "# Completed", field: "completed", flex: 1 },
  //   { headerName: "Insights", field: "insights", flex: 2 },
  // ];

  const detailCellRendererParams = useMemo(() => {
    return {
      detailGridOptions: {
        columnDefs: [
          { field: "identity", headerName: "Identity", flex: 1 },
          { field: "Account", headerName: "Account", flex: 1 },
          { field: "Entitlement", headerName: "Entitlement", flex: 1 },
          { field: "Type", headerName: "Type", flex: 1 },
          { field: "Status", headerName: "Status", flex: 1 },
          { field: "Ticket", headerName: "#Ticket", flex: 1 },
          { field: "Evidence", headerName: "Evidence", flex: 1 },
        ],
        defaultColDef: {
          flex: 2,
        },
      },
      getDetailRowData: (params: any) => {
        const details = Array.isArray(params.data?.details)
          ? params.data.details
          : [];
        params.successCallback(details);
      },
    };
  }, []);
  // App View Dashboard Column Definitions
  //   { headerName: "Application", field: "appName", flex: 1 },
  //   { headerName: "App Owner", field: "appOwner", flex: 1 },
  //   { headerName: "# Revocations", field: "revocations", flex: 1 },
  //   { headerName: "# Completed", field: "completed", flex: 1 },
  //   { headerName: "Revoke Method", field: "revokeMethod", flex: 1 },
  //   {
  //     headerName: "Actions",
  //     field: "actions",
  //     cellRenderer: () => (
  //         <button
  //           title="Remind"
  //           className="text-yellow-400 hover:text-yellow-600 p-1 cursor-pointer"
  //         >
  //         </button>
  //         <button
  //           title="Escalate"
  //           className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
  //         >
  //           <svg
  //             xmlns="http://www.w3.org/2000/svg"
  //             width="24"
  //             height="24"
  //             viewBox="0 0 24 24"
  //             fill="none"
  //             stroke="currentColor"
  //             strokeWidth="1"
  //             strokeLinecap="round"
  //             strokeLinejoin="round"
  //             className="lucide lucide-arrow-up-narrow-wide-icon lucide-arrow-up-narrow-wide"
  //           >
  //           </svg>
  //         </button>
  //       </div>
  //     ),
  //     flex: 1,
  //   },
  // ];

  // User View Table Column Definitions
  //   {
  //     headerName: "User Name",
  //     field: "userName",
  //     valueFormatter: (params: any) =>
  //       `${params.value} (${params.data.userStatus})`,
  //     flex: 2,
  //   },
  //   { headerName: "#Access", field: "access", flex: 1 },
  //   { headerName: "#Approved", field: "approved", flex: 1 },
  //   { headerName: "#Revoked", field: "revoked", flex: 1 },
  //   { headerName: "#Revokes Completed", field: "revokesCompleted", flex: 1 },
  //   { headerName: "Last Data Sync", field: "lastSync", flex: 1 },
  // ];

  // App View Table Column Definitions
  const appColumnDefs: ColDef[] = [
    {
      headerName: "Application",
      field: "appName",
      cellRenderer: "agGroupCellRenderer",
      flex: 2,
    },
    { headerName: "Owner", field: "appOwner", flex: 2 },
    { headerName: "#Access", field: "access", flex: 2 },
    { headerName: "#Approved", field: "approved", flex: 2 },
    { headerName: "#Revoked", field: "revoked", flex: 2 },
    { headerName: "#Revokes Completed", field: "revokesCompleted", flex: 2 },
    {
      headerName: "Last Sync",
      field: "lastSync",
      flex: 2,
      valueFormatter: (params) => formatDateMMDDYY(params.value),
    },

    {
      headerName: "Actions",
      field: "actions",
      cellRenderer: () => (
        <div className="flex gap-2">
          <button
            title="Remind"
            className="text-yellow-400 hover:text-yellow-600 p-1 cursor-pointer"
          >
            <BellIcon />
          </button>
          <button
            title="Escalate"
            className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-arrow-up-narrow-wide-icon lucide-arrow-up-narrow-wide"
            >
              <path d="m3 8 4-4 4 4" />
              <path d="M7 4v16" />
              <path d="M11 12h4" />
              <path d="M11 16h7" />
              <path d="M11 20h10" />
            </svg>
          </button>
          <button
            title="Download Excel"
            aria-label="Sign off selected rows"
            className="p-1 rounded transition-colors duration-200"
          >
            <DownloadIcon
              className="curser-pointer"
              strokeWidth="1"
              size="24"
            />
          </button>
        </div>
      ),
      flex: 2,
    },
  ];

  // Check if a cell is a full width cell (for detail rows)
  const isFullWidthCell = (rowNode: any) => {
    return rowNode.detail;
  };

  // Sample Data for Dashboard
  //   {
  //     deptName: "IT Department",
  //     deptOwner: "Sarah Johnson",
  //     revocations: 20,
  //     completed: 15,
  //     insights: "75% completion rate, 5 pending revocations",
  //   },
  // ];

  //   {
  //     appName: "Core System",
  //     appOwner: "Alice Brown",
  //     revocations: 30,
  //     completed: 25,
  //     revokeMethod: "Direct Sync",
  //   },
  // ];

  // Sample Data for Main Tables
  //   {
  //     userName: "John Doe",
  //     userStatus: "Active",
  //     access: 10,
  //     approved: 8,
  //     revoked: 2,
  //     revokesCompleted: 2,
  //     lastSync: "2025-08-20",
  //   },
  //   {
  //     userName: "Jane Smith",
  //     userStatus: "Inactive",
  //     access: 5,
  //     approved: 3,
  //     revoked: 1,
  //     revokesCompleted: 1,
  //     lastSync: "2025-08-19",
  //   },
  // ];

  const defaultColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };

  const appRowData = [
    {
      appName: "SAP",
      appRisk: "High",
      access: 170,
      approved: 145,
      revoked: 25,
      revokesCompleted: 6,
      lastSync: "2025-08-20",
      appOwner: "Alice Brown",
      details: [
        {
          identity: "John Doe",
          Account: "jdoe@sap.local",
          Entitlement: "SAP FI: Post Journal Entries",
          Type: "Role",
          Status: "Pending",
          Ticket: "INC-100234",
          Evidence: "Manager approval attached",
        },
        {
          identity: "Mary Johnson",
          Account: "mjohnson@sap.local",
          Entitlement: "SAP MM: Approve Purchase Orders",
          Type: "Role",
          Status: "In Progress",
          Ticket: "REQ-55890",
          Evidence: "Access review decision",
        },
      ],
    },
    {
      appName: "Sales Force",
      appRisk: "Medium",
      access: 130,
      approved: 112,
      revoked: 18,
      revokesCompleted: 4,
      lastSync: "2025-08-19",
      appOwner: "Bob Wilson",
      details: [
        {
          identity: "Alex Smith",
          Account: "asmith@sf.local",
          Entitlement: "Salesforce: Export Reports",
          Type: "Permission",
          Status: "Completed",
          Ticket: "CHG-77421",
          Evidence: "Revocation confirmed by system",
        },
        {
          identity: "Priya Patel",
          Account: "ppatel@sf.local",
          Entitlement: "Salesforce: Modify Opportunities",
          Type: "Profile",
          Status: "Pending",
          Ticket: "INC-100311",
          Evidence: "Awaiting CAB approval",
        },
      ],
    },
  ];

  return (
    <div className="p-4">
      {/* Toggle Button */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          {}
          {}
        </div>
      </div>

      {view === "user" ? (
        <>
          {/* User View Dashboard AG-Grid */}
          {}

          {/* User View Main AG-Grid Table */}
          {}
        </>
      ) : (
        <>
          {/* App View Dashboard AG-Grid */}
          {}

          {/* App View Main AG-Grid Table */}
          <div
            className="ag-theme-alpine"
            style={{ width: "100%" }}
          >
            {}
            <AgGridReact
              theme={themeQuartz}
              rowData={appRowData}
              columnDefs={appColumnDefs}
              defaultColDef={defaultColDef}
              // rowSelection={rowSelection}
              masterDetail={true}
              detailCellRendererParams={detailCellRendererParams}
              detailRowAutoHeight={true}
              domLayout="autoHeight"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default Revocations;
