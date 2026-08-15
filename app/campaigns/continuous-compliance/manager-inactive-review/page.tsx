"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ColDef } from "ag-grid-enterprise";
import { themeQuartz } from "ag-grid-community";
import { Search } from "lucide-react";
import "@/lib/ag-grid-setup";
import UserDisplayName from "@/components/UserDisplayName";
import DelegateActionModal from "@/components/DelegateActionModal";

const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);

type ReportRow = {
  id: string;
  lineItemId: string;
  name: string;
  email: string;
  title: string;
  department: string;
  /** Inactive manager corporate / account id (e.g. emma.lewis) */
  managerId: string;
  managerName: string;
  managerStatus: string;
  status: string;
  tags: string;
};

function buildMockReports(inactiveManagerLabel: string): ReportRow[] {
  const mgr = inactiveManagerLabel || "Inactive manager";
  const mgrId = (inactiveManagerLabel || "manager.id").trim().toLowerCase();
  return [
    {
      id: "mi-1",
      lineItemId: "li-cc-mi-1",
      name: "Jordan Hayes",
      email: "jordan.hayes@example.com",
      title: "Senior Analyst",
      department: "Finance",
      managerId: mgrId,
      managerName: mgr,
      managerStatus: "Inactive",
      status: "Active",
      tags: "Employee",
    },
    {
      id: "mi-2",
      lineItemId: "li-cc-mi-2",
      name: "Priya Nair",
      email: "priya.nair@example.com",
      title: "Operations Lead",
      department: "Operations",
      managerId: mgrId,
      managerName: mgr,
      managerStatus: "Inactive",
      status: "Active",
      tags: "Employee",
    },
    {
      id: "mi-3",
      lineItemId: "li-cc-mi-3",
      name: "Marcus Lee",
      email: "marcus.lee@example.com",
      title: "IT Specialist",
      department: "IT",
      managerId: mgrId,
      managerName: mgr,
      managerStatus: "Inactive",
      status: "Active",
      tags: "Contractor",
    },
    {
      id: "mi-4",
      lineItemId: "li-cc-mi-4",
      name: "Elena Rossi",
      email: "elena.rossi@example.com",
      title: "Finance Partner",
      department: "Finance",
      managerId: mgrId,
      managerName: mgr,
      managerStatus: "Inactive",
      status: "Active",
      tags: "Employee",
    },
    {
      id: "mi-5",
      lineItemId: "li-cc-mi-5",
      name: "Noah Bennett",
      email: "noah.bennett@example.com",
      title: "Support Engineer",
      department: "Support",
      managerId: mgrId,
      managerName: mgr,
      managerStatus: "Inactive",
      status: "Active",
      tags: "Employee",
    },
  ];
}

/** Inline SVG (lucide `user-round-check` paths) — avoids Turbopack scope bugs with Lucide inside AG Grid cell renderers. */
function ReassignIconSvg() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#b146cc"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 pointer-events-none"
      aria-hidden
    >
      <path d="M2 21a8 8 0 0 1 13.292-6" />
      <circle cx="10" cy="8" r="5" />
      <path d="m16 19 2 2 4-4" />
    </svg>
  );
}

function TeamsIconButton({ email, userName }: { email: string; userName: string }) {
  const gradId = React.useId().replace(/:/g, "");
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        const safeEmail = email || "";
        const message = `Please coordinate manager reassignment for ${userName} (${safeEmail}).`;
        const teamsUrl = `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(
          safeEmail
        )}&message=${encodeURIComponent(message)}`;
        window.open(teamsUrl, "_blank", "noopener,noreferrer");
      }}
      title="Open in Microsoft Teams"
      aria-label="Open in Microsoft Teams"
      className="p-1 rounded transition-colors duration-200 hover:bg-gray-100 flex-shrink-0 cursor-pointer inline-flex items-center justify-center"
    >
      <svg
        width="28px"
        height="28px"
        viewBox="0 0 16 16"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        aria-hidden
      >
        <path
          fill="#5059C9"
          d="M10.765 6.875h3.616c.342 0 .619.276.619.617v3.288a2.272 2.272 0 01-2.274 2.27h-.01a2.272 2.272 0 01-2.274-2.27V7.199c0-.179.145-.323.323-.323zM13.21 6.225c.808 0 1.464-.655 1.464-1.462 0-.808-.656-1.463-1.465-1.463s-1.465.655-1.465 1.463c0 .807.656 1.462 1.465 1.462z"
        />
        <path
          fill="#7B83EB"
          d="M8.651 6.225a2.114 2.114 0 002.117-2.112A2.114 2.114 0 008.65 2a2.114 2.114 0 00-2.116 2.112c0 1.167.947 2.113 2.116 2.113zM11.473 6.875h-5.97a.611.611 0 00-.596.625v3.75A3.669 3.669 0 008.488 15a3.669 3.669 0 003.582-3.75V7.5a.611.611 0 00-.597-.625z"
        />
        <path
          fill={`url(#${gradId})`}
          d="M1.597 4.925h5.969c.33 0 .597.267.597.596v5.958a.596.596 0 01-.597.596h-5.97A.596.596 0 011 11.479V5.521c0-.33.267-.596.597-.596z"
        />
        <path
          fill="#ffffff"
          d="M6.152 7.193H4.959v3.243h-.76V7.193H3.01v-.63h3.141v.63z"
        />
        <defs>
          <linearGradient
            id={gradId}
            x1="2.244"
            x2="6.906"
            y1="4.46"
            y2="12.548"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#5A62C3" />
            <stop offset=".5" stopColor="#4D55BD" />
            <stop offset="1" stopColor="#3940AB" />
          </linearGradient>
        </defs>
      </svg>
    </button>
  );
}

export default function ManagerInactiveReviewPage() {
  const searchParams = useSearchParams();

  const inactiveManager =
    searchParams.get("inactiveManager") ||
    searchParams.get("details") ||
    "";

  const [searchTerm, setSearchTerm] = useState("");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<ReportRow | null>(null);

  const rowData = useMemo(
    () => buildMockReports(inactiveManager),
    [inactiveManager]
  );

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rowData;
    return rowData.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.managerId.toLowerCase().includes(q) ||
        r.tags.toLowerCase().includes(q)
    );
  }, [rowData, searchTerm]);

  const openReassign = useCallback((row: ReportRow) => {
    setReassignTarget(row);
    setReassignOpen(true);
  }, []);

  const columnDefs = useMemo<ColDef[]>(() => {
    return [
      {
        headerName: "Display Name",
        field: "name",
        flex: 1.65,
        minWidth: 200,
        cellRenderer: (params: { value?: string; data?: ReportRow; rowIndex?: number }) => {
          const rawName = params.value == null ? "Unknown" : String(params.value);
          const initials = rawName
            .trim()
            .split(/\s+/)
            .map((n: string) => n[0])
            .filter(Boolean)
            .join("")
            .toUpperCase();
          const avatarGrays = ["#e5e7eb", "#d1d5db", "#cbd5e1", "#e7e5e4", "#f3f4f6"];
          const bgColor = avatarGrays[(params.rowIndex ?? 0) % avatarGrays.length];
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  backgroundColor: bgColor,
                  color: "#374151",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  fontSize: 12,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {initials}
              </div>
              <UserDisplayName
                displayName={params.value}
                tags={params.data?.tags}
                className="text-gray-700"
                style={{ color: "#374151" }}
              />
            </div>
          );
        },
      },
      {
        headerName: "Job Title",
        field: "title",
        flex: 1.65,
        minWidth: 140,
      },
      {
        headerName: "Department",
        field: "department",
        flex: 1.65,
        minWidth: 140,
      },
      {
        headerName: "Manager",
        field: "managerName",
        flex: 2,
        minWidth: 220,
        wrapHeaderText: true,
        autoHeaderHeight: true,
        cellRenderer: (params: { value?: string; data?: ReportRow }) => {
          const managerId = params.data?.managerId?.trim() || String(params.value || "").trim() || "—";
          return (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-900">{managerId}</span>
              <span className="inline-flex items-center rounded bg-amber-50 px-1 py-px text-[9px] font-medium leading-none text-amber-800 border border-amber-200/80">
                Inactive
              </span>
            </div>
          );
        },
      },
      { headerName: "Tags", field: "tags", flex: 1.15, minWidth: 100 },
      {
        headerName: "Actions",
        field: "actions",
        flex: 1.35,
        minWidth: 140,
        sortable: false,
        filter: false,
        cellRenderer: (params: { data?: ReportRow }) => {
          const row = params.data;
          if (!row) {
            return null;
          }
          return (
            <div
              className="flex items-center gap-2 h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                title="Reassign"
                aria-label="Reassign"
                className="p-1 rounded transition-colors duration-200 hover:bg-purple-50 cursor-pointer"
                onClick={() => openReassign(row)}
              >
                <ReassignIconSvg />
              </button>
              <TeamsIconButton email={row.email} userName={row.name} />
            </div>
          );
        },
      },
    ];
  }, [openReassign]);

  return (
    <div className="min-h-screen bg-[#f4f5f8] py-5 px-0 md:px-0">
      <div className="w-full max-w-[1600px] mx-auto px-4 md:px-6">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manager inactive — direct reports under review ({filteredRows.length} of{" "}
            {rowData.length} shown).
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-5">
          <div className="mb-4">
            <div className="relative max-w-md">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="text-gray-400 w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Search users by name, email, title, department, tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          </div>

          <div className="ag-theme-alpine" style={{ width: "100%" }}>
            <AgGridReact
              theme={themeQuartz}
              columnDefs={columnDefs}
              rowData={filteredRows}
              domLayout="autoHeight"
              suppressRowClickSelection
              getRowId={(p) => p.data.id}
            />
          </div>
        </div>
      </div>

      <DelegateActionModal
        isModalOpen={reassignOpen}
        closeModal={() => {
          setReassignOpen(false);
          setReassignTarget(null);
        }}
        heading={
          reassignTarget
            ? `Reassign manager (${reassignTarget.name})`
            : "Reassign manager"
        }
        users={[
          { username: "john", email: "john@example.com", role: "admin" },
          { username: "jane", email: "jane@example.com", role: "user" },
        ]}
        groups={[
          { name: "admins", email: "admins@corp.com", role: "admin" },
          { name: "devs", email: "devs@corp.com", role: "developer" },
        ]}
        userAttributes={[
          { value: "username", label: "Username" },
          { value: "email", label: "Email" },
        ]}
        groupAttributes={[
          { value: "name", label: "Group Name" },
          { value: "role", label: "Role" },
        ]}
        onSelectDelegate={() => {
          setReassignOpen(false);
          setReassignTarget(null);
        }}
      />
    </div>
  );
}
