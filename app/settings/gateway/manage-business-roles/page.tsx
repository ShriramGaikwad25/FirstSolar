"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { themeQuartz } from "ag-grid-community";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Eye } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import CustomPagination from "@/components/agTable/CustomPagination";
import { executeQuery } from "@/lib/api";

const BUSINESS_ROLE_VIEW_STORAGE_KEY = "businessRoleViewDraft";

interface BusinessRoleRow {
  businessRoleId?: string;
  roleName: string;
  roleCode?: string;
  description: string;
  ownerId?: string;
  owner: string;
  noOfUsers: number;
  noOfPermissions?: number;
  tags: string;
  /** Optional: ids of access items that belong to this role (for editing) */
  selectedAccessIds?: string[];
}

const fallbackBusinessRoles: BusinessRoleRow[] = [
  {
    businessRoleId: "",
    roleName: "Finance - Approvers",
    roleCode: "FIN_APPROVERS",
    description:
      "Business role for Finance approvers responsible for purchase approvals and financial controls.",
    ownerId: "",
    owner: "finance.approver@acme.com",
    noOfUsers: 18,
    tags: "Finance",
  },
];

export default function ManageBusinessRolesSettings() {
  const pageSizeSelector = [10, 20, 50, 100];
  const router = useRouter();

  const [rows, setRows] = useState<BusinessRoleRow[]>(fallbackBusinessRoles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(pageSizeSelector[0]);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalItems, setTotalItems] = useState(fallbackBusinessRoles.length);
  const [totalPages, setTotalPages] = useState(
    Math.max(1, Math.ceil(fallbackBusinessRoles.length / pageSizeSelector[0]))
  );

  useEffect(() => {
    const fetchBusinessRoles = async () => {
      setLoading(true);
      setError(null);
      try {
        const query = "select * from vw_kf_br_role_list order by ?";
        const parameters: string[] = [" "];

        const response = await executeQuery<any>(query, parameters);

        let rawRows: any[] = [];

        if (Array.isArray(response)) {
          rawRows = response;
        } else if (response && typeof response === "object") {
          const possibleKeys = ["resultSet", "rows", "items", "data", "records"];
          for (const key of possibleKeys) {
            const value = (response as any)[key];
            if (Array.isArray(value)) {
              rawRows = value;
              break;
            }
          }
        }

        if (!rawRows.length) {
          setRows(fallbackBusinessRoles);
          return;
        }

        const mapped: BusinessRoleRow[] = rawRows.map((row: any) => {
          const businessRoleId =
            row.businessroleid ??
            row.business_role_id ??
            row.roleid ??
            row.role_id ??
            row.id ??
            "";

          const roleName =
            row.rolename ??
            row.role_name ??
            row.businessrolename ??
            row.business_role_name ??
            row.name ??
            "";

          const roleCode =
            row.rolecode ??
            row.role_code ??
            row.businessrolecode ??
            row.business_role_code ??
            row.code ??
            "";

          const description =
            row.description ??
            row.role_description ??
            row.businessroledescription ??
            row.business_role_description ??
            "";

          const owner =
            row.owner ??
            row.owner_email ??
            row.owneremail ??
            row.email ??
            row.owner_name ??
            "";

          const ownerId =
            row.ownerid ??
            row.owner_id ??
            row.userid ??
            row.user_id ??
            "";

          const noOfUsersRaw =
            row.no_of_users ?? row.noofusers ?? row.usercount ?? row.users_count;
          const noOfPermissionsRaw =
            row.access_count ??
            row.accesscount ??
            row.no_of_permissions ??
            row.noofpermissions ??
            row.permissioncount ??
            row.permissions_count;

          const tags =
            row.tags ?? row.category ?? row.business_role_category ?? row.role_category ?? "";

          let selectedAccessIds: string[] | undefined;
          const rawSelectedIds =
            row.selectedaccessids ??
            row.selected_access_ids ??
            row.accessids ??
            row.access_ids ??
            row.entitlement_ids ??
            null;
          if (typeof rawSelectedIds === "string") {
            selectedAccessIds = rawSelectedIds
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          } else if (Array.isArray(rawSelectedIds)) {
            selectedAccessIds = rawSelectedIds.map((v) => String(v ?? "").trim()).filter(Boolean);
          }

          return {
            businessRoleId: String(businessRoleId || "").trim(),
            roleName: String(roleName || "").trim() || "Unnamed Role",
            roleCode: String(roleCode || "").trim(),
            description: String(description || "").trim(),
            ownerId: String(ownerId || "").trim(),
            owner: String(owner || "").trim(),
            noOfUsers: Number(noOfUsersRaw ?? 0),
            noOfPermissions:
              noOfPermissionsRaw !== undefined && noOfPermissionsRaw !== null
                ? Number(noOfPermissionsRaw)
                : undefined,
            tags: String(tags || "").trim(),
            selectedAccessIds,
          };
        });

        setRows(mapped);
      } catch (e: any) {
        console.error("Failed to load business roles:", e);
        setError(
          e?.message || "Failed to load business roles from executeQuery API."
        );
        setRows(fallbackBusinessRoles);
      } finally {
        setLoading(false);
      }
    };

    fetchBusinessRoles();
  }, []);

  useEffect(() => {
    setTotalItems(rows.length);
    setTotalPages(Math.max(1, Math.ceil(rows.length / pageSize)));
    setPageNumber(1);
  }, [rows.length, pageSize]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.toLowerCase();
    return rows.filter((r) => {
      return (
        r.roleName.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q)
      );
    });
  }, [rows, searchTerm]);

  const paginatedRows = useMemo(() => {
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, pageNumber, pageSize]);

  useEffect(() => {
    const newTotal = filteredRows.length;
    setTotalItems(newTotal);
    setTotalPages(Math.max(1, Math.ceil(newTotal / pageSize)));
    setPageNumber(1);
  }, [filteredRows.length, pageSize]);

  const handleEdit = useCallback(
    (row: BusinessRoleRow) => {
      const search = new URLSearchParams({
        mode: "edit",
        businessRoleId: row.businessRoleId ?? "",
        roleName: row.roleName ?? "",
        roleCode: row.roleCode ?? "",
        description: row.description ?? "",
        ownerId: row.ownerId ?? "",
        owner: row.owner ?? "",
        tags: row.tags ?? "",
        selectedAccessIds: (row.selectedAccessIds ?? []).join(","),
      });

      router.push(`/settings/gateway/manage-business-roles/new?${search.toString()}`);
    },
    [router]
  );

  const handleView = useCallback(
    (row: BusinessRoleRow) => {
      try {
        const r = row as unknown as Record<string, unknown>;
        localStorage.setItem(
          BUSINESS_ROLE_VIEW_STORAGE_KEY,
          JSON.stringify({
            businessRoleId: row.businessRoleId ?? "",
            roleName: row.roleName ?? "",
            roleCode: row.roleCode ?? "",
            description: row.description ?? "",
            owner: row.owner ?? "",
            ownerId: row.ownerId ?? "",
            tags: row.tags ?? "",
            noOfUsers: row.noOfUsers,
            noOfPermissions: row.noOfPermissions,
            selectedAccessIds: row.selectedAccessIds ?? [],
            raw: r,
          })
        );
      } catch (error) {
        console.error("Unable to save business role view draft:", error);
      }
      router.push("/settings/gateway/manage-business-roles/review");
    },
    [router]
  );

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Business Role",
        field: "roleName",
        flex: 2,
        autoHeight: true,
        wrapText: true,
        cellRenderer: (params: any) => {
          return (
            <button
              type="button"
              onClick={() => handleEdit(params.data as BusinessRoleRow)}
              style={{
                color: "#1677ff",
                cursor: "pointer",
                fontWeight: 500,
                background: "none",
                border: "none",
                padding: 0,
                textAlign: "left",
              }}
            >
              {params.value}
            </button>
          );
        },
      },
      {
        headerName: "Category",
        field: "tags",
        flex: 1,
      },
      {
        headerName: "Tags",
        field: "description",
        flex: 1,
      },
      {
        headerName: "Owner",
        field: "owner",
        flex: 1.5,
      },
      {
        headerName: "No of Permissions",
        field: "noOfPermissions",
        flex: 1,
      },
      {
        headerName: "Actions",
        field: "actions",
        flex: 1,
        cellRenderer: (params: any) => {
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleView(params.data as BusinessRoleRow)}
                className="inline-flex items-center justify-center p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="View business role"
                title="View"
              >
                <Eye className="w-4 h-4 text-gray-700" />
              </button>
              <button
                type="button"
                onClick={() => handleEdit(params.data as BusinessRoleRow)}
                className="inline-flex items-center justify-center p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="Edit business role"
                title="Edit"
              >
                <Pencil className="w-4 h-4 text-gray-700" />
              </button>
            </div>
          );
        },
      },
    ],
    [handleEdit, handleView]
  );

  const handlePageChange = (newPage: number) => {
    if (newPage !== pageNumber) {
      setPageNumber(newPage);
    }
  };

  const handleAddBusinessRole = () => {
    router.push("/settings/gateway/manage-business-roles/new");
  };

  return (
    <div className="h-full p-2">
      <div className="mx-auto">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">
              Manage Business Roles
            </h1>
          </div>

          <div className="bg-white rounded-md shadow p-4">
            {/* Header with Add Business Role button */}
            <div className="mb-4 flex justify-between items-center gap-4">
              {/* Search Bar */}
              <div className="flex-1 max-w-lg">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="text-gray-400 w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search business roles by name, description, tags, owner..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                {searchTerm && (
                  <p className="text-sm text-gray-600 mt-1">
                    Showing {filteredRows.length} result(s) for "{searchTerm}"
                  </p>
                )}
              </div>

              <div className="flex-shrink-0">
                <button
                  type="button"
                  onClick={handleAddBusinessRole}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Business Role
                </button>
              </div>
            </div>

            <div className="ag-theme-alpine" style={{ width: "100%" }}>
              {/* Top pagination */}
              <div className="mb-2">
                <CustomPagination
                  totalItems={totalItems}
                  currentPage={pageNumber}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  onPageChange={handlePageChange}
                  onPageSizeChange={(newPageSize) => {
                    if (typeof newPageSize === "number") {
                      setPageSize(newPageSize);
                      setPageNumber(1);
                    }
                  }}
                  pageSizeOptions={pageSizeSelector}
                />
              </div>

              <div style={{ minHeight: "400px" }}>
                <AgGridReact
                  columnDefs={columnDefs}
                  rowData={paginatedRows}
                  domLayout="autoHeight"
                  theme={themeQuartz}
                  rowHeight={60}
                />
              </div>

              {/* Bottom pagination */}
              <div className="mt-4 mb-2">
                <CustomPagination
                  totalItems={totalItems}
                  currentPage={pageNumber}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  onPageChange={handlePageChange}
                  onPageSizeChange={(newPageSize) => {
                    if (typeof newPageSize === "number") {
                      setPageSize(newPageSize);
                      setPageNumber(1);
                    }
                  }}
                  pageSizeOptions={pageSizeSelector}
                />
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
