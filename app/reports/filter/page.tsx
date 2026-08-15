"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Control, FieldValues, UseFormSetValue, UseFormWatch } from "react-hook-form";
import ReportFilterBuilder from "@/components/ReportFilterBuilder";
import { Play, Download } from "lucide-react";
import { executeQuery } from "@/lib/api";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then(mod => mod.AgGridReact), { ssr: false });
import { ColDef, GridApi, themeQuartz } from "ag-grid-community";
import "@/lib/ag-grid-setup";
// Proxied report signatures API
const GET_ALL_SIGNATURE_URL = "/api/reports/getallsignature";

export default function ReportFilterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportType = searchParams.get("reportType") || "";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  const { control, setValue, watch } = useForm<FieldValues>({
    defaultValues: {
      reportFilters: [],
    },
  });

  // Default / fallback report filter attributes
  const DEFAULT_FILTER_ATTRIBUTES = useMemo(
    () => [
      { label: "User", value: "user" },
      { label: "User Status", value: "user_status" },
      { label: "Application", value: "app" },
      { label: "Entitlement", value: "entitlement" },
      { label: "Department", value: "department" },
    ],
    []
  );

  // Attributes shown in "Select Attribute" – by default use static list,
  // but override with searchAttributes from the selected report (getallsignature API)
  const [filterAttributes, setFilterAttributes] = useState<
    { label: string; value: string }[]
  >(DEFAULT_FILTER_ATTRIBUTES);

  // Load searchAttributes for the selected reportType
  useEffect(() => {
    let cancelled = false;
    if (!reportType) return;

    const loadAttributes = async () => {
      try {
        const res = await fetch(GET_ALL_SIGNATURE_URL, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const obj =
          data && typeof data === "object" && data !== null
            ? (data as { signatures?: unknown })
            : null;
        const sigs = Array.isArray(obj?.signatures) ? obj.signatures : [];

        type Signature = {
          reportName?: string;
          viewName?: string;
          searchAttributes?: { name?: string; display?: string }[];
        };

        const match = (sigs as Signature[]).find(
          (s) => (s.reportName || "").toLowerCase() === reportType.toLowerCase()
        );

        if (!match || !Array.isArray(match.searchAttributes)) {
          return;
        }

        const attrs = match.searchAttributes
          .filter((a) => a && (a.name || a.display))
          .map((a) => ({
            label: (a.display || a.name || "").toString(),
            value: (a.name || a.display || "").toString(),
          }));

        if (!cancelled && attrs.length > 0) {
          setFilterAttributes(attrs);
        }
      } catch {
        // On error, keep existing/default attributes
      }
    };

    loadAttributes();

    return () => {
      cancelled = true;
    };
  }, [reportType, DEFAULT_FILTER_ATTRIBUTES]);

  const handleBack = () => {
    router.push("/reports");
  };

  const buildWhereClause = (filters: any[]): string => {
    if (!filters || filters.length === 0) {
      return "";
    }

    const conditions = filters
      .filter((filter) => filter?.attribute?.value && filter?.operator?.value && (filter.value ?? "") !== "")
      .map((filter, index) => {
        const attribute = filter.attribute.value;
        const operator = filter.operator.value;
        const value = String(filter.value).trim();
        const logicalOp = index > 0 ? (filter.logicalOp || "AND") : "";

        // Map attribute values to actual column names (as used in the view)
        const columnMap: Record<string, string> = {
          user: "user_name",
          user_status: "user_status",
          app: "applications",
          entitlement: "entitlements",
          department: "department",
        };
        const columnName = columnMap[attribute] || attribute;

        // Map UI operators to API operator tokens
        const operatorTokenMap: Record<string, string> = {
          equals: "=",
          not_equals: "ne",
          contains: "co",
          excludes: "nc",   // not-contains shorthand
          in: "in",
          not_in: "not in",
        };
        const opToken = operatorTokenMap[operator] || "eq";

        // Construct expression without SQL quoting to match required payload style:
        // e.g., column eq value, column co value
        let condition: string;
        if (opToken === "in" || opToken === "not in") {
          const list = value
            .split(",")
            .map((v: string) => v.trim())
            .filter((v: string) => v.length > 0)
            .join(", ");
          condition = `${columnName} ${opToken} (${list})`;
        } else {
          condition = `${columnName} ${opToken} ${value}`;
        }

        return logicalOp ? `${logicalOp} ${condition}` : condition;
      });

    return conditions.length > 0 ? conditions.join(" ") : "";
  };

  const handleGenerate = async () => {
    const filters = watch("reportFilters");
    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      // Base query
      const baseQuery = "select * from vw_user_with_applications_entitlements where applications is not null AND applications::jsonb <> '[]'::jsonb";
      
      // Build WHERE clause from filters
      const whereClause = buildWhereClause(filters);
      
      // Combine base query with WHERE clause
      const finalQuery = whereClause 
        ? `${baseQuery} AND ${whereClause}`
        : baseQuery;

      // Call the API
      const response = await executeQuery<any>(finalQuery, []);

      // Handle the response - response could be an array or an object with data property
      let data: any[] = [];

      // Helper: deep search for the first array of objects
      const findFirstArrayOfObjects = (node: any, seen = new Set<any>()): any[] | null => {
        if (!node || typeof node !== "object") return null;
        if (seen.has(node)) return null;
        seen.add(node);

        // If node itself is an array
        if (Array.isArray(node)) {
          if (node.length === 0) return node; // empty array is still valid
          // Prefer arrays of objects
          if (typeof node[0] === "object") return node;
          // If primitives, still return to show something
          return node;
        }

        // Try common keys first
        const prioritizedKeys = [
          "data","items","results","rows","records","result","payload","content","value","values"
        ];
        for (const key of prioritizedKeys) {
          if (key in node) {
            const found = findFirstArrayOfObjects((node as any)[key], seen);
            if (found) return found;
          }
        }

        // Fallback: iterate all values
        for (const value of Object.values(node)) {
          const found = findFirstArrayOfObjects(value, seen);
          if (found) return found;
        }
        return null;
      };

      // First, check if response is directly an array
      if (Array.isArray(response)) {
        data = response;
      } else if (response && typeof response === "object") {
        // Try direct keys
        const directKeys = ["data","items","results","rows","records","result","value","values","content","payload"];
        for (const k of directKeys) {
          if (k in response) {
            const v = (response as any)[k];
            if (Array.isArray(v)) { data = v; break; }
            if (v && typeof v === "object") {
              const nested = findFirstArrayOfObjects(v);
              if (nested) { data = nested; break; }
            }
          }
        }

        // If still empty, check numeric-keyed object
        if (data.length === 0) {
          const keys = Object.keys(response);
          if (keys.length > 0 && keys.every(k => !isNaN(Number(k)))) {
            data = Object.values(response) as any[];
          }
        }

        // If still empty, deep search
        if (data.length === 0) {
          const deepArr = findFirstArrayOfObjects(response);
          if (deepArr) data = deepArr;
        }

        // If still empty, but response looks like a single row, wrap it
        if (data.length === 0) {
          const keys = Object.keys(response);
          const hasDataFields = keys.some(k =>
            ['firstname','firstName','username','userName','lastname','lastName','application','applications','entitlement','entitlements']
              .includes(k.toLowerCase())
          );
          if (hasDataFields) {
            data = [response];
          }
        }
      }

      // If data is still empty but response exists, keep results empty
      
      // Transform into one row per entitlement
      const flattened: any[] = [];
      for (const item of Array.isArray(data) ? data : []) {
        const username = getFieldValue(item, ['username','userName','user_name','USERNAME']);
        const firstname = getFieldValue(item, ['firstname','firstName','first_name','FIRSTNAME']);
        const lastname = getFieldValue(item, ['lastname','lastName','last_name','LASTNAME']);
        const department = getFieldValue(item, ['department','DEPARTMENT']);
        const userStatus = getFieldValue(item, ['status','STATUS','user_status','userStatus']);
        const applications = (item as any)?.applications || (item as any)?.application || [];
        const appsArray = Array.isArray(applications) ? applications : [applications];
        for (const app of appsArray) {
          if (!app) continue;
          const application = getFieldValue(app, ['application','applicationName','appName','APPLICATION']);
          const accountname = getFieldValue(app, ['accountname','accountName','account_name','ACCOUNTNAME','account']);
          const accountType = getFieldValue(app, ['accounttype','accountType','account_type','ACCOUNTTYPE']);
          const lastlogin = getFieldValue(app, ['lastlogin','lastLogin','last_login','LASTLOGIN']);
          const entitlements = (app as any)?.entitlements || [];
          if (Array.isArray(entitlements) && entitlements.length > 0) {
            for (const ent of entitlements) {
              const entitlement = getFieldValue(ent, ['entitlementname','entitlementName']);
              const entType = getFieldValue(ent, ['entitlementType','entitlementtype','entType','ent_type']);
              const entDesc = getFieldValue(ent, ['entitlementDescription','entitlementdescription','entDesc','ent_desc']);
              flattened.push({
                username,
                firstname,
                lastname,
                department,
                application,
                accountname,
                accountType,
                entitlement,
                entType,
                entDesc,
                lastlogin,
                status: userStatus,
              });
            }
          }
        }
      }

      const finalRows = flattened.length > 0 ? flattened : data;
      setResults(finalRows);
      
    } catch (err: any) {
      console.error("Error executing query:", err);
      setError(err.message || "Failed to execute query");
    } finally {
      setIsLoading(false);
    }
  };

  const isDevelopment = process.env.NODE_ENV === 'development';

  // Export helpers
  const getDisplayedRows = (): any[] => {
    if (!gridApi) return results || [];
    const rows: any[] = [];
    try {
      gridApi.forEachNodeAfterFilterAndSort((node) => {
        if (node?.data) rows.push(node.data);
      });
      return rows;
    } catch {
      return results || [];
    }
  };

  const downloadBlob = (content: BlobPart, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const buildFileBaseName = () => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const rt = (reportType || "user-access-report").replace(/\s+/g, "-").toLowerCase();
    return `${rt}-${ts}`;
    };

  const handleExportCSV = () => {
    if (gridApi?.exportDataAsCsv) {
      gridApi.exportDataAsCsv({
        fileName: `${buildFileBaseName()}.csv`,
        onlySelected: false,
        skipColumnHeaders: false,
      });
      return;
    }
    const rows = getDisplayedRows();
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(",")].concat(
      rows.map(r => headers.map(h => {
        const v = r[h];
        const s = v === undefined || v === null ? "" : String(v);
        const escaped = `"${s.replace(/"/g, '""')}"`;
        return escaped;
      }).join(","))
    ).join("\n");
    downloadBlob(csv, `${buildFileBaseName()}.csv`, "text/csv;charset=utf-8;");
  };

  const handleExportExcel = () => {
    if (gridApi?.exportDataAsExcel) {
      gridApi.exportDataAsExcel({
        fileName: `${buildFileBaseName()}.xlsx`,
      } as any);
      return;
    }
    // Fallback to CSV if Excel export not available
    handleExportCSV();
  };

  const handleExportJSON = () => {
    const rows = getDisplayedRows();
    downloadBlob(JSON.stringify(rows, null, 2), `${buildFileBaseName()}.json`, "application/json");
  };

  const [showExportMenu, setShowExportMenu] = useState(false);
  const toggleExportMenu = () => setShowExportMenu((v) => !v);
  const closeExportMenu = () => setShowExportMenu(false);

  // Helper function to get field value with multiple possible keys
  const getFieldValue = (row: any, keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key];
      }
    }
    return '-';
  };

  // Helper to normalize application value (string | array | object)
  const getApplicationValue = (row: any) => {
    const raw = getFieldValue(row, [
      'application',
      'applications',
      'applicationName',
      'applicationname',
      'appName',
      'app',
      'APPLICATION',
    ]);
    if (raw === '-' || raw === null || raw === undefined) return '-';
    try {
      // If it's a JSON string, try parsing
      const value = typeof raw === 'string' && (raw.startsWith('[') || raw.startsWith('{'))
        ? JSON.parse(raw)
        : raw;
      // If array -> join meaningful fields
      if (Array.isArray(value)) {
        if (value.length === 0) return '-';
        // Array of objects
        if (typeof value[0] === 'object') {
          const names = value.map((v: any) => (
            v?.applicationName || v?.name || v?.appName || v?.application || v?.APPLICATION || v?.App || ''
          )).filter(Boolean);
          return names.length ? names.join(', ') : JSON.stringify(value);
        }
        // Array of primitives
        return value.join(', ');
      }
      // If object -> pick a likely name field
      if (typeof value === 'object') {
        const name =
          value.applicationName ||
          value.name ||
          value.appName ||
          value.application ||
          value.APPLICATION;
        return name ? String(name) : JSON.stringify(value);
      }
      // Primitive string/number
      return String(value);
    } catch {
      // Fallback to raw string
      return typeof raw === 'string' ? raw : String(raw);
    }
  };

  // Helper to normalize account name value
  const getAccountNameValue = (row: any) => {
    const raw = getFieldValue(row, [
      'accountname',
      'accountName',
      'account_name',
      'ACCOUNTNAME',
      'account',
      'accountInfo',
      'accountDetails',
      'acctName',
    ]);
    if (raw === '-' || raw === null || raw === undefined) return '-';
    try {
      const value = typeof raw === 'string' && (raw.startsWith('[') || raw.startsWith('{'))
        ? JSON.parse(raw)
        : raw;
      if (Array.isArray(value)) {
        if (value.length === 0) return '-';
        if (typeof value[0] === 'object') {
          const names = value.map((v: any) => (
            v?.accountName || v?.accountname || v?.name || v?.account || ''
          )).filter(Boolean);
          return names.length ? names.join(', ') : JSON.stringify(value);
        }
        return value.join(', ');
      }
      if (typeof value === 'object') {
        const name =
          value.accountName ||
          value.accountname ||
          value.name ||
          value.account;
        return name ? String(name) : JSON.stringify(value);
      }
      return String(value);
    } catch {
      return typeof raw === 'string' ? raw : String(raw);
    }
  };

  // Column definitions for ag-grid
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: "User Name",
      field: "username",
      valueGetter: (params: any) => {
        if (!params.data) return '-';
        return getFieldValue(params.data, ['username', 'userName', 'user_name', 'USERNAME']);
      },
      width: 120,
    },
    {
      headerName: "First Name",
      field: "firstname",
      valueGetter: (params: any) => {
        if (!params.data) return '-';
        return getFieldValue(params.data, ['firstname', 'firstName', 'first_name', 'FIRSTNAME']);
      },
      width: 130,
      hide:true
    },
    {
      headerName: "Last Name",
      field: "lastname",
      valueGetter: (params: any) => {
        if (!params.data) return '-';
        return getFieldValue(params.data, ['lastname', 'lastName', 'last_name', 'LASTNAME']);
      },
      width: 130,
      hide:true
    },
    {
      headerName: "Department",
      field: "department",
      valueGetter: (params: any) => {
        if (!params.data) return '-';
        return getFieldValue(params.data, ['department', 'DEPARTMENT']);
      },
      width: 120,
    },
    {
      headerName: "Application",
      field: "application",
      valueGetter: (params: any) => {
        if (!params.data) return '-';
        return getApplicationValue(params.data);
      },
      width: 130,
      cellStyle: { whiteSpace: 'normal', wordBreak: 'break-word' },
    },
    {
      headerName: "Account",
      field: "accountname",
      valueGetter: (params: any) => {
        if (!params.data) return '-';
        return getAccountNameValue(params.data);
      },
      width: 120,
    },
    {
      headerName: "Account Type",
      field: "accountType",
      valueGetter: (params: any) => {
        if (!params.data) return '-';
        return getFieldValue(params.data, ['accountType', 'accounttype', 'account_type', 'ACCOUNTTYPE', 'accountStatus', 'accountstatus']);
      },
      width: 120,
    },
    {
      headerName: "Entitlement",
      field: "entitlement",
      valueGetter: (params: any) => {
        if (!params.data) return '-';
        return getFieldValue(params.data, ['entitlement', 'entitlementname', 'entitlementName']);
      },
      width: 140,
    },
    {
      headerName: "Entitlement Type",
      field: "entType",
      valueGetter: (params: any) => {
        if (!params.data) return '-';
        return getFieldValue(params.data, ['entType', 'ent_type', 'entitlementtype', 'entitlementType']);
      },
      width: 120,
    },
    {
      headerName: "Description",
      field: "entDesc",
      valueGetter: (params: any) => {
        if (!params.data) return '-';
        return getFieldValue(params.data, ['entDesc', 'ent_desc', 'entitlementdescription', 'entitlementDescription']);
      },
      width: 180,
      cellStyle: { whiteSpace: 'normal', wordBreak: 'break-word' },
    },
  ], []);

  // Default column definition
  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    flex: 1,
    minWidth: 100,
  }), []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full py-8 px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Header */}
          <div className="mb-4">
            {reportType && (
              <p className="text-sm text-gray-600 mt-1">
                Report Type: <span className="font-bold">{reportType}</span>
              </p>
            )}
          </div>

          {/* Filter Section */}
          <div className="space-y-4">
            <div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <ReportFilterBuilder
                  title="Report Filters"
                  control={control as unknown as Control<FieldValues>}
                  setValue={setValue as unknown as UseFormSetValue<FieldValues>}
                  watch={watch as unknown as UseFormWatch<FieldValues>}
                  fieldName="reportFilters"
                  attributesOptions={filterAttributes}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-3 border-t border-gray-200">
              <button
                onClick={handleBack}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                {isLoading ? "Running..." : "Run Now"}
              </button>
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Results Table */}
            {(!isLoading && results.length === 0 && !error) ? (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <p className="text-sm text-gray-500 text-center py-8">
                  No results to display. Click "Run Now" to execute the query.
                </p>
              </div>
            ) : (
              <div className="mt-6 border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  {results.length > 0 
                    ? `Report Results (${results.length} ${results.length === 1 ? 'record' : 'records'})`
                    : 'Report Results'
                  }
                </h2>
                <div className="relative" onMouseLeave={closeExportMenu}>
                  <button
                    onClick={toggleExportMenu}
                    className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={isLoading || (results?.length ?? 0) === 0}
                    aria-haspopup="menu"
                    aria-expanded={showExportMenu ? 'true' : 'false'}
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {showExportMenu && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10"
                    >
                      <button
                        role="menuitem"
                        onClick={() => { handleExportExcel(); closeExportMenu(); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        Excel (.xlsx)
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => { handleExportCSV(); closeExportMenu(); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        CSV (.csv)
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => { handleExportJSON(); closeExportMenu(); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        JSON (.json)
                      </button>
                    </div>
                  )}
                </div>
              </div>
                <div className="w-full" style={{ height: '600px' }}>
                  <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
                    <AgGridReact
                      rowData={results}
                      columnDefs={columnDefs}
                      defaultColDef={defaultColDef}
                      theme={themeQuartz}
                      pagination={true}
                      paginationPageSize={20}
                      paginationPageSizeSelector={[10, 20, 50, 100]}
                      animateRows={true}
                      domLayout="normal"
                      onGridReady={(params: any) => {
                        setGridApi(params.api);
                        params.api.sizeColumnsToFit();
                      }}
                      onFirstDataRendered={(params: any) => {
                        params.api.sizeColumnsToFit();
                      }}
                      loading={isLoading}
                      noRowsOverlayComponentParams={{
                        message: isLoading ? 'Loading results...' : 'No results found',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          
        </div>
      </div>
    </div>
  );
}

