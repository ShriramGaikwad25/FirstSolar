"use client";
import { ColDef, GridApi } from "ag-grid-enterprise";
import { themeQuartz } from "ag-grid-community";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then(mod => mod.AgGridReact), { ssr: false });
import { useRouter } from "next/navigation"; // Updated import
import React, { useMemo, useRef, useState, useEffect } from "react";
import { executeQuery } from "@/lib/api";
import "@/lib/ag-grid-setup";
import CustomPagination from "@/components/agTable/CustomPagination";
import { Plus, Search, Pencil, X } from "lucide-react";
import HorizontalTabs from "@/components/HorizontalTabs";
import UserDisplayName from "@/components/UserDisplayName";
import { useAuth } from "@/contexts/AuthContext";


interface UserData {
  name: string;
  email: string;
  title: string;
  department: string;
  managerEmail: string;
  status: string;
  tags: string;
  managerName?: string;
  managerStatus?: string;
}

// Users Tab Component
function UsersTab() {
  const router = useRouter();
  const gridApiRef = useRef<GridApi | null>(null);
  const [rowData, setRowData] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState<string>("");
  const { isAuthenticated } = useAuth();

  // Pagination state
  const pageSizeSelector = [20, 50, 100];
  const [pageSize, setPageSize] = useState(pageSizeSelector[0]);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Default data for fallback
  const defaultRowData: UserData[] = [
    {
      name: "Aamod Radwan",
      email: "aamod.radwan@zillasecurity.io",
      title: "Staff",
      department: "Sales",
      managerEmail: "charlene.brattka@zillasecurity.io",
      status: "Active",
      tags: "",
    },
    {
      name: "Abdulah Thibadeau",
      email: "abdulah.thibadeau@zillasecurity.io",
      title: "Manager - IT & Security",
      department: "IT & Security",
      managerEmail: "huan.lortz@zillasecurity.io",
      status: "Active",
      tags: "",
    },
  ];


  // Run the search only when the user explicitly triggers it (button click or Enter)
  const handleSearch = () => {
    setAppliedSearchTerm(searchTerm.trim());
    setPageNumber(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setAppliedSearchTerm("");
    setPageNumber(1);
  };

  // Fetch a single page of users from the API (server-side pagination + search)
  useEffect(() => {
    const fetchUsers = async () => {
      // Check if user is authenticated before making API call
      if (!isAuthenticated) {
        console.log("Users: User not authenticated, skipping API call");
        setLoading(false);
        setRowData([]);
        setTotalItems(0);
        setTotalPages(0);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const offset = (pageNumber - 1) * pageSize;

        let whereClause = "";
        let searchParams: string[] = [];
        if (appliedSearchTerm) {
          const term = `%${appliedSearchTerm}%`;
          whereClause =
            " WHERE username ILIKE ? OR email::text ILIKE ? OR displayname ILIKE ? OR firstname ILIKE ? OR lastname ILIKE ? OR title ILIKE ? OR department ILIKE ?";
          searchParams = [term, term, term, term, term, term, term];
        }

        const dataQuery = `SELECT * FROM usr${whereClause} ORDER BY username LIMIT ? OFFSET ?`;
        const countQuery = `SELECT COUNT(*) as count FROM usr${whereClause}`;

        const [dataResponse, countResponse] = await Promise.all([
          executeQuery<any>(dataQuery, [...searchParams, pageSize, offset]),
          executeQuery<any>(countQuery, searchParams),
        ]);

        const sourceArray: any[] = Array.isArray((dataResponse as any)?.resultSet)
          ? (dataResponse as any).resultSet
          : Array.isArray(dataResponse)
          ? (dataResponse as any[])
          : [];

        if (sourceArray.length > 0) {
          const transformedData: UserData[] = sourceArray.map((user: any) => ({
            name:
              user.displayname ||
              user.displayName ||
              [user.firstname, user.lastname].filter(Boolean).join(" ").trim() ||
              "Unknown",
            email: user.email?.work || user.customattributes?.emails?.[0]?.value || user.username || "Unknown",
            title: user.title || user.customattributes?.title || "Unknown",
            department: user.department || user.customattributes?.enterpriseUser?.department || "Unknown",
            managerEmail: user.managername || user.customattributes?.enterpriseUser?.manager?.value || "",
            status: user.status || (user.customattributes?.active ? "Active" : "Inactive"),
            tags: user.employeetype || user.customattributes?.userType || "",
            managerName: user.managername || user.customattributes?.enterpriseUser?.manager?.value || "",
            managerStatus: "Active" // Default status for manager
          }));
          setRowData(transformedData);

          const countRow = Array.isArray((countResponse as any)?.resultSet)
            ? (countResponse as any).resultSet[0]
            : Array.isArray(countResponse)
            ? (countResponse as any[])[0]
            : null;
          const total = Number(countRow?.count ?? countRow?.COUNT ?? transformedData.length) || 0;
          setTotalItems(total);
          setTotalPages(Math.max(1, Math.ceil(total / pageSize)));

          // Persist a lookup map of raw users by email/username for detail page consumption
          try {
            const rawByKey: Record<string, any> = {};
            for (const u of sourceArray) {
              const key = (u.email?.work || u.customattributes?.emails?.[0]?.value || u.username || u.displayname || u.displayName || "").toString();
              if (key) rawByKey[key] = u;
            }
            localStorage.setItem("usersRawByKey", JSON.stringify(rawByKey));
          } catch {}
        } else if (!appliedSearchTerm && pageNumber === 1) {
          // Fallback to default data if the API returned nothing and there's no active search
          setRowData(defaultRowData);
          setTotalItems(defaultRowData.length);
          setTotalPages(Math.ceil(defaultRowData.length / pageSize));
        } else {
          setRowData([]);
          setTotalItems(0);
          setTotalPages(1);
        }
      } catch (err) {
        console.error("Error fetching users:", err);

        // Handle authentication errors gracefully
        if (err instanceof Error && (
          err.message.includes("No JWT token") ||
          err.message.includes("401") ||
          err.message.includes("403") ||
          err.message.includes("400")
        )) {
          console.log("Users: Authentication error, user may have logged out");
          setRowData([]);
          setTotalItems(0);
          setTotalPages(0);
          setError(null); // Don't show error if user logged out
        } else {
          setError(err instanceof Error ? err.message : "Failed to fetch users");
          // Fallback to default data on error
          setRowData(defaultRowData);
          setTotalItems(defaultRowData.length);
          setTotalPages(Math.ceil(defaultRowData.length / pageSize));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isAuthenticated, pageNumber, pageSize, appliedSearchTerm]);

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    if (newPage !== pageNumber) {
      setPageNumber(newPage);
    }
  };

const columnDefs = useMemo<ColDef[]>(
  () => [
    {
      headerName: "Display Name",
      field: "name",
      flex: 1.5,
      cellRenderer: (params: any) => {
        const rawName = params.value == null ? "Unknown" : String(params.value);
        const initials = rawName
          .trim()
          .split(/\s+/)
          .map((n: string) => n[0])
          .filter(Boolean)
          .join("")
          .toUpperCase();
        const colors = ["#7f3ff0", "#0099cc", "#777", "#d7263d", "#ffae00"];
        const bgColor = colors[params.rowIndex % colors.length];
        const status = params.data.status; // Access status from data
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                backgroundColor: bgColor,
                color: "darkblue",
                borderRadius: "50%",
                width: 28,
                height: 28,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {initials}
            </div>
            <UserDisplayName
              displayName={params.value}
              tags={params.data.tags}
              className="text-blue-600"
              style={{ color: "#1677ff", cursor: "pointer" }}
            />
          </div>
        );
      },
    },
    { headerName: "Job Title", field: "title", flex: 1.5 },
    { headerName: "Department", field: "department", flex: 1.5 },
    {
      headerName: "Manager",
      field: "managerName",
      flex: 1.5,
      cellRenderer: (params: any) => {
        const managerName = params.value || "N/A";
        const managerStatus = params.data.managerStatus || "Unknown"; // Access managerStatus from data
        return (
          <span>
            {managerName} ({managerStatus})
          </span>
        );
      },
    },
    { headerName: "Tags", field: "tags", flex: 1 },
  ],
  []
);


  const handleRowClick = (event: any) => {
    try {
      // Persist the raw record for the detail page
      const raw = event?.data ?? {};
      // Attempt to enrich with full raw user from the last API result map
      try {
        const mapStr = localStorage.getItem("usersRawByKey");
        if (mapStr) {
          const map = JSON.parse(mapStr);
          const key = raw.email || raw.name;
          if (key && map && typeof map === 'object' && map[key]) {
            localStorage.setItem("selectedUserRawFull", JSON.stringify(map[key]));
          }
        }
      } catch {}
      // Save a single selected row and also a tiny array form for any legacy reader
      localStorage.setItem("selectedUserRaw", JSON.stringify(raw));
      localStorage.setItem("sharedRowData", JSON.stringify([{ // legacy shape consumed by profile page
        fullName: raw.name,
        id: raw.email, // using email as a stable id-like alias if no id
        status: raw.status,
        manager: raw.managerName,
        department: raw.department,
        jobtitle: raw.title,
        userType: raw.tags,
        email: raw.email,
      }]));
      try { window.dispatchEvent(new Event("localStorageChange")); } catch {}
    } catch {}
    const appId = event.data.name;
    router.push(`/user/${encodeURIComponent(appId)}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ height: 600 }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center" style={{ height: 600 }}>
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-red-600 mb-2">Error loading users</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header with Create new User */}
      <div className="mb-4 flex justify-between items-start gap-4">
        <div className="flex-1 max-w-md">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="text-gray-400 w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Search users by name, email, title, department, tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-10 pr-9 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleSearch}
              className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              Search
            </button>
          </div>
          {appliedSearchTerm && (
            <p className="text-sm text-gray-600 mt-1">
              Showing {totalItems} result(s) for "{appliedSearchTerm}"
            </p>
          )}
        </div>

        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={() => router.push("/user/create-user")}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-2 py-2 rounded-md text-sm transition-colors"
          >
            <Plus className="w-2 h-2" />
            Create New User
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
              setPageNumber(1); // Reset to first page when changing page size
            }
          }}
          pageSizeOptions={pageSizeSelector}
        />
      </div>

      <div style={{ minHeight: '400px' }}>
        <AgGridReact
          theme={themeQuartz}
          columnDefs={columnDefs}
          rowData={rowData}
          domLayout="autoHeight"
          onRowClicked={handleRowClick}
        />
      </div>

      {/* Bottom pagination */}
      <div className="mt-4 mb-4">
        <CustomPagination
          totalItems={totalItems}
          currentPage={pageNumber}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={(newPageSize) => {
            if (typeof newPageSize === "number") {
              setPageSize(newPageSize);
              setPageNumber(1); // Reset to first page when changing page size
            }
          }}
          pageSizeOptions={pageSizeSelector}
        />
      </div>
    </div>
    </div>
  );
}

// User Groups Tab Component
interface UserGroupData {
  userGroup: string;
  description: string;
  owner: string;
  noOfUsers: number;
  tags: string;
}

function UserGroupsTab() {
  const router = useRouter();
  const gridApiRef = useRef<GridApi | null>(null);
  const [rowData, setRowData] = useState<UserGroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTermGroups, setSearchTermGroups] = useState<string>("");
  const { isAuthenticated } = useAuth();
  
  // Pagination state
  const pageSizeSelector = [20, 50, 100];
  const [pageSize, setPageSize] = useState(pageSizeSelector[0]);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Dummy default data for User Groups (fallback)
  const defaultGroupData: UserGroupData[] = [
    {
      userGroup: "Operations - Managers",
      description: "Managers within the Operations department responsible for approvals and escalations.",
      owner: "ops.manager@acme.com",
      noOfUsers: 12,
      tags: "Operations",
    },
  ];

  // Fetch user groups data from API
  useEffect(() => {
    const fetchUserGroups = async () => {
      // Check if user is authenticated before making API call
      if (!isAuthenticated) {
        console.log("UserGroups: User not authenticated, skipping API call");
        setLoading(false);
        setRowData([]);
        setTotalItems(0);
        setTotalPages(0);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Execute query to get all user groups
        const query = "SELECT * FROM kf_groups";
        const parameters: string[] = [];
        
        const response = await executeQuery(query, parameters);
        
        // Transform API response to match our UserGroupData interface
        if (response && typeof response === 'object' && 'resultSet' in response && Array.isArray((response as any).resultSet)) {
          const sourceArray: any[] = (response as any).resultSet;
          const transformedData: UserGroupData[] = sourceArray.map((group: any) => ({
            userGroup: group.name || group.group_name || group.userGroup || "Unknown Group",
            description: group.description || group.desc || "",
            owner: group.owner || group.owner_email || group.created_by || "",
            noOfUsers: group.no_of_users || group.user_count || group.member_count || 0,
            tags: group.tags || group.category || group.type || "",
          }));
          setRowData(transformedData);
          setTotalItems(transformedData.length);
          setTotalPages(Math.ceil(transformedData.length / pageSize));
        } else if (response && Array.isArray(response)) {
          // Handle case where response is directly an array
          const transformedData: UserGroupData[] = response.map((group: any) => ({
            userGroup: group.name || group.group_name || group.userGroup || "Unknown Group",
            description: group.description || group.desc || "",
            owner: group.owner || group.owner_email || group.created_by || "",
            noOfUsers: group.no_of_users || group.user_count || group.member_count || 0,
            tags: group.tags || group.category || group.type || "",
          }));
          setRowData(transformedData);
          setTotalItems(transformedData.length);
          setTotalPages(Math.ceil(transformedData.length / pageSize));
        } else {
          // Fallback to default data if API response is empty
          setRowData(defaultGroupData);
          setTotalItems(defaultGroupData.length);
          setTotalPages(Math.ceil(defaultGroupData.length / pageSize));
        }
      } catch (err) {
        console.error("Error fetching user groups:", err);
        
        // Handle authentication errors gracefully
        if (err instanceof Error && (
          err.message.includes("No JWT token") || 
          err.message.includes("401") || 
          err.message.includes("403") ||
          err.message.includes("400")
        )) {
          console.log("UserGroups: Authentication error, user may have logged out");
          setRowData([]);
          setTotalItems(0);
          setTotalPages(0);
          setError(null); // Don't show error if user logged out
        } else {
          setError(err instanceof Error ? err.message : "Failed to fetch user groups");
          // Fallback to default data on error
          setRowData(defaultGroupData);
          setTotalItems(defaultGroupData.length);
          setTotalPages(Math.ceil(defaultGroupData.length / pageSize));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserGroups();
  }, [isAuthenticated]);

  // Filter data based on search term
  const filteredGroupData = useMemo(() => {
    if (!searchTermGroups.trim()) {
      return rowData;
    }
    const searchLower = searchTermGroups.toLowerCase();
    return rowData.filter((group) => {
      return (
        group.userGroup?.toLowerCase().includes(searchLower) ||
        group.description?.toLowerCase().includes(searchLower) ||
        group.tags?.toLowerCase().includes(searchLower) ||
        group.owner?.toLowerCase().includes(searchLower)
      );
    });
  }, [rowData, searchTermGroups]);

  // Paginate base group rows (not the description rows)
  const paginatedBaseGroups = useMemo(() => {
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredGroupData.slice(startIndex, endIndex);
  }, [filteredGroupData, pageNumber, pageSize]);

  // For display: each group row followed by a separate description row
  const paginatedData = useMemo(() => {
    const rows: any[] = [];
    for (const group of paginatedBaseGroups) {
      rows.push(group);
      rows.push({ ...group, __isDescRow: true });
    }
    return rows;
  }, [paginatedBaseGroups]);

  // Update total pages when page size or search changes
  useEffect(() => {
    const newTotalItems = filteredGroupData.length;
    setTotalItems(newTotalItems);
    setTotalPages(Math.ceil(newTotalItems / pageSize));
    setPageNumber(1); // Reset to first page when page size or search changes
  }, [pageSize, filteredGroupData.length]);

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    if (newPage !== pageNumber) {
      setPageNumber(newPage);
    }
  };

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "User Group",
        field: "userGroup",
        flex: 2,
        wrapText: true,
        colSpan: (params: any) => {
          // Make the description row span all columns
          if (params.data?.__isDescRow) {
            // Number of visible columns in this grid (User Group + Category + Tags + Owner + No of users + Actions)
            return 6;
          }
          return 1;
        },
        cellRenderer: (params: any) => {
          const description = params.data?.description;

          // Description-only row
          if (params.data?.__isDescRow) {
            const isEmpty =
              !description || (typeof description === "string" && description.trim().length === 0);
            return (
              <div className="h-full w-full flex items-center">
                <div
                  className={`text-sm w-full break-words line-clamp-2 leading-5 ${
                    isEmpty ? "text-gray-400 italic" : "text-gray-600"
                  }`}
                >
                  {isEmpty ? "No description available" : description}
                </div>
              </div>
            );
          }

          // Main group row
          return (
            <span style={{ color: "#1677ff", cursor: "pointer", fontWeight: 500 }}>
              {params.value}
            </span>
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
        field: "tags",
        flex: 1,
      },
      {
        headerName: "Owner",
        field: "owner",
        flex: 1.5,
      },
      {
        headerName: "No of users",
        field: "noOfUsers",
        flex: 1,
        cellRenderer: (params: any) => {
          return (
            <span>
              {params.value || 0}
            </span>
          );
        },
      },
      {
        headerName: "Actions",
        field: "actions",
        flex: 1,
        cellRenderer: (params: any) => {
          // Hide actions on description-only rows
          if (params.data?.__isDescRow) {
            return null;
          }

          const handleModifyClick = () => {
            const groupName = params.data?.userGroup;
            try {
              // Persist selected group so the form can be prefilled
              if (params.data) {
                localStorage.setItem("selectedUserGroup", JSON.stringify(params.data));
              }
            } catch {
              // Ignore localStorage errors; navigation will still work
            }

            // Navigate to create-group page in edit mode
            if (groupName) {
              router.push(`/user/create-group?mode=edit&group=${encodeURIComponent(groupName)}`);
            } else {
              router.push("/user/create-group?mode=edit");
            }
          };

          return (
            <button
              type="button"
              onClick={handleModifyClick}
              className="inline-flex items-center justify-center px-2 py-1 text-sm rounded-md border border-gray-300 text-blue-600 hover:bg-blue-50"
            >
              <Pencil className="w-4 h-4" />
            </button>
          );
        },
      },
    ],
    []
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ height: 600 }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user groups...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center" style={{ height: 600 }}>
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-red-600 mb-2">Error loading user groups</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header with Create User Group Button */}
      <div className="mb-4 flex justify-between items-center gap-4">
        {/* Search Bar */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="text-gray-400 w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="Search user groups by name, description, tags, owner..."
              value={searchTermGroups}
              onChange={(e) => setSearchTermGroups(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          {searchTermGroups && (
            <p className="text-sm text-gray-600 mt-1">
              Showing {filteredGroupData.length} result(s) for "{searchTermGroups}"
            </p>
          )}
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={() => router.push("/user/create-group")}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create User Group
          </button>
        </div>
      </div>

      <div className="ag-theme-alpine" style={{ width: "100%" }}>
        {/* Top pagination */}
        <div className="mb-2">
          <CustomPagination
            totalItems={filteredGroupData.length}
            currentPage={pageNumber}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={(newPageSize) => {
              if (typeof newPageSize === "number") {
                setPageSize(newPageSize);
                setPageNumber(1); // Reset to first page when changing page size
              }
            }}
            pageSizeOptions={pageSizeSelector}
          />
        </div>
        
        <div style={{ minHeight: '400px' }}>
          <AgGridReact
            theme={themeQuartz}
            columnDefs={columnDefs}
            rowData={paginatedData}
            domLayout="autoHeight"
          />
        </div>
        
        {/* Bottom pagination */}
        <div className="mt-4 mb-4">
          <CustomPagination
            totalItems={filteredGroupData.length}
            currentPage={pageNumber}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={(newPageSize) => {
              if (typeof newPageSize === "number") {
                setPageSize(newPageSize);
                setPageNumber(1); // Reset to first page when changing page size
              }
            }}
            pageSizeOptions={pageSizeSelector}
          />
        </div>
      </div>
    </div>
  );
}

// Main User Component with Tabs
export default function User() {
  const tabs = [
    {
      label: "Users",
      component: UsersTab,
    },
    {
      label: "User Groups",
      component: UserGroupsTab,
    },
  ];

  return <HorizontalTabs tabs={tabs} defaultIndex={0} />;
}
