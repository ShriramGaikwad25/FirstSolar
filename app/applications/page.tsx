"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then(mod => mod.AgGridReact), { ssr: false });
import "@/lib/ag-grid-setup";
import { ColDef, GridApi, PaginationChangedEvent } from "ag-grid-enterprise";
import Accordion from "@/components/Accordion";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { formatDateMMDDYY } from "../access-review/page";
import CustomPagination from "@/components/agTable/CustomPagination";
import { getCookie, COOKIE_NAMES } from "@/lib/auth";
import { getOriginalFetch } from "@/lib/authFetch";

ChartJS.register(ArcElement, Tooltip, Legend);


export default function Application() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [rowData, setRowData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [gridCurrentPage, setGridCurrentPage] = useState(1);
  const [gridTotalPages, setGridTotalPages] = useState(1);
  const [gridPageSize, setGridPageSize] = useState<number>(20);
  const [gridRowCount, setGridRowCount] = useState(0);

  const syncPaginationState = (api: GridApi) => {
    setGridCurrentPage(api.paginationGetCurrentPage() + 1);
    setGridTotalPages(Math.max(1, api.paginationGetTotalPages()));
    setGridPageSize(api.paginationGetPageSize());
    setGridRowCount(api.paginationGetRowCount());
  };

  const handlePaginationChanged = (event: PaginationChangedEvent) => {
    syncPaginationState(event.api);
  };

  // Fetch data from API
  useEffect(() => {
    setMounted(true);
    const fetchData = async () => {
      try {
        const response = await fetch(`https://preview.keyforge.ai/entities/api/v1/ACMECOM/getApplications/430ea9e6-3cff-449c-a24e-59c057f81e3d?page=1&page_size=1000`);
        // Fire parallel background requests alongside getApplications
        const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
        if (accessToken) {
          const headers = new Headers();
          headers.set('Authorization', `Bearer ${accessToken}`);
          const originalFetch = typeof window !== 'undefined' ? getOriginalFetch() : fetch;
          void originalFetch("https://preview.keyforge.ai/registerscimapp/registerfortenant/ACMECOM/getAllApplications", {
            headers: headers,
          }).catch(() => null);
        }
        void fetch("https://preview.keyforge.ai/schemamapper/getmappedschema/ACMECOM/16APLDOY").catch(() => null);
        const data = await response.json();
        if (data.executionStatus === "success") {
          const items = Array.isArray(data.items) ? data.items : [];
          setRowData(items);
          setTotalItems(data.total_items || items.length);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  // Filter data based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredData(rowData);
    } else {
      const filtered = rowData.filter((item: any) =>
        item.applicationinstancename?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredData(filtered);
    }
  }, [rowData, searchQuery]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Application",
        field: "applicationinstancename",
        width:260,
        cellRenderer: (params: any) => {
          const name = params.data.applicationinstancename;
          const LOGO_BY_NAME: Record<string, string> = {
            "Active Directory": "/ActiveDirectory.svg",
            "AcmeCorporateDirectory": "/ActiveDirectory.svg",
            "Oracle": "/Oracle.svg",
            "SAP": "/SAP.svg",
            "Workday": "/workday.svg",
          };
          const LOGO_BY_KEYWORD: Array<{ keyword: string; src: string }> = [
            { keyword: "active directory", src: "/ActiveDirectory.svg" },
            { keyword: "corporate directory", src: "/ActiveDirectory.svg" },
            { keyword: "oracle", src: "/Oracle.svg" },
            { keyword: "sap", src: "/SAP.svg" },
            { keyword: "workday", src: "/workday.svg" },
          ];
          const getLogoSrc = (appName: string) => {
            if (!appName) return "/window.svg";
            // 1) Exact match mapping (case-sensitive to allow precision)
            if (LOGO_BY_NAME[appName]) return LOGO_BY_NAME[appName];
            // 2) Keyword-based mapping (case-insensitive contains)
            const lower = appName.toLowerCase();
            const kw = LOGO_BY_KEYWORD.find((k) => lower.includes(k.keyword));
            if (kw) return kw.src;
            // 3) Deterministic fallback to a known existing asset to avoid hydration mismatch
            return "/window.svg";
          };
          const riskStatus = params.data.risk || "Unknown";
          const riskInitial =
            riskStatus === "High" ? "H" : riskStatus === "Medium" ? "M" : "L";
          const riskColor =
            riskStatus === "High" ? "red" : riskStatus === "Medium" ? "orange" : "green";
          
          // Special styling for High risk - show app name in red bubble
          if (riskStatus === "High") {
            return (
              <div className="flex items-center h-full">
                <img
                  src={getLogoSrc(name)}
                  alt={`${name} logo`}
                  width={28}
                  height={28}
                  className="mr-2"
                  loading="lazy"
                />
                <span
                  className="px-2 py-1 text-sm font-medium rounded-full inline-flex items-center cursor-help"
                  style={{ 
                    backgroundColor: "#ffebee", 
                    color: "#d32f2f",
                    border: "1px solid #ffcdd2",
                    minHeight: "24px"
                  }}
                  title="High Risk"
                >
                  {name}
                </span>
                {}
              </div>
            );
          }
          
          // Default styling for other risk levels
          return (
            <div className="flex items-center h-full">
              <img
                src={getLogoSrc(name)}
                alt={`${name} logo`}
                width={28}
                height={28}
                className="mr-2"
                loading="lazy"
              />
              <a
                // href={`#${params.data.applicationInstanceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium inline-flex items-center py-2"
              >
                {name}
              </a>
              {}
            </div>
          );
        },
      },
      { headerName: "Department", field: "businessUnit",width:200 },
      { headerName: "Owner", field: "ownername",width:200 },
      {
        headerName: "#Accounts",
        field: "numofaccounts",
        width:145,
        valueFormatter: (params: any) =>
          params.value?.toLocaleString("en-US") || "0",
      },
      {
        headerName: "Last Review",
        field: "lastAccessReview",
        width:140,
        valueFormatter: (params) => formatDateMMDDYY(params.value),
       
      },
      {
        headerName: "Last Sync",
        field: "lastSync",
        width:140,
      valueFormatter: (params) => formatDateMMDDYY(params.value),
      },
      {
        headerName: "Next Sync",
        field: "nextSync",
        width:140,
        valueFormatter: (params) => formatDateMMDDYY(params.value),
      },
      { headerName: "Sync Type", field: "syncType",width:180 },
      { headerName: "App Risk", field: "risk", hide: true,width:200, },
      { headerName: "App Type", field: "applicationtype", hide: true,width:200, },
      { headerName: "App Description", field: "applicationcategory", hide: true,width:200, },
    ],
    []
  );

  const handleRowClick = (event: any) => {
    const appId = event.data.applicationInstanceId;
    const applicationData = {
      applicationName: event.data.applicationinstancename || "N/A",
      owner: event.data.ownername || "N/A",
      lastSync: event.data.lastSync || "N/A"
    };
    
    console.log('Row clicked - Application data:', applicationData);
    console.log('Row clicked - App ID:', appId);
    
    // Store application data in localStorage for HeaderContent
    localStorage.setItem('applicationDetails', JSON.stringify(applicationData));
    
    // Dispatch custom event
    const customEvent = new CustomEvent('applicationDataChange', {
      detail: applicationData
    });
    window.dispatchEvent(customEvent);
    console.log('Custom event dispatched from applications page');
    
    // In parallel, resolve ApplicationID from Keyforge getAllApplications and call getApp/{ApplicationID}
    (async () => {
      try {
        const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
        if (!accessToken) return;
        const keyforgeAllUrl = "https://preview.keyforge.ai/registerscimapp/registerfortenant/ACMECOM/getAllApplications";
        const headers = new Headers();
        headers.set('Authorization', `Bearer ${accessToken}`);
        const originalFetch = typeof window !== 'undefined' ? getOriginalFetch() : fetch;
        const allResp = await originalFetch(keyforgeAllUrl, {
          headers: headers,
        });
        if (!allResp.ok) return;
        const allJson = await allResp.json();
        const targetName = (event.data.applicationinstancename || "").toString().trim().toLowerCase();
        const match = Array.isArray(allJson?.Applications)
          ? allJson.Applications.find((a: any) => (a?.ApplicationName || "").toString().trim().toLowerCase() === targetName)
          : null;
        const applicationID = match?.ApplicationID;
        if (!applicationID) return;
        try { localStorage.setItem("keyforgeApplicationID", applicationID); } catch {}
        const keyforgeGetAppUrl = `https://preview.keyforge.ai/registerscimapp/registerfortenant/ACMECOM/getApp/${encodeURIComponent(applicationID)}`;
        void fetch(keyforgeGetAppUrl, { method: "GET", keepalive: true }).catch(() => null);
      } catch {
        // ignore background errors
      }
    })();

    router.push(`/applications/${appId}`);
  };

  // Data for the doughnut chart (based on syncType)
  const syncTypeData = useMemo(() => {
    const syncTypes = [...new Set(filteredData.map((row: any) => row.syncType))];
    const counts = syncTypes.map(
      (type) => filteredData.filter((row: any) => row.syncType === type).length
    );
    return {
      labels: syncTypes,
      datasets: [
        {
          data: counts,
          backgroundColor: [
            "#FF6384",
            "#36A2EB",
            "#FFCE56",
            "#4BC0C0",
            "#9966FF",
            "#FF9F40",
          ],
          hoverOffset: 20,
        },
      ],
    };
  }, [filteredData]);


  return (
    !mounted ? null :
    <div className="ag-theme-alpine" style={{ width: "100%" }}>
      <div className="relative mb-2">
        <h1 className="text-2xl font-bold border-b border-gray-300 pb-2 text-blue-950">
          Applications
        </h1>
        <div className="mb-1">
          <div className="bg-gray-100 p-2 rounded-lg shadow-sm">
            <p className="text-sm font-semibold text-gray-700">
              Integrated Applications: <span className="text-blue-600">{totalItems}</span>
            </p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mb-4 pt-4">
          <div className="relative max-w-sm">
            <input
              type="text"
              placeholder="Search by Application Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
          {searchQuery && (
            <p className="text-sm text-gray-600 mt-1">
              Showing {filteredData.length} of {totalItems} applications
            </p>
          )}
        </div>
        {}
      </div>

      {/* Top pagination - mirrors the grid's own pagination state */}
      <div className="mb-2">
        <CustomPagination
          totalItems={gridRowCount}
          currentPage={gridCurrentPage}
          totalPages={gridTotalPages}
          pageSize={gridPageSize}
          onPageChange={(page) => gridApi?.paginationGoToPage(page - 1)}
          onPageSizeChange={(newPageSize) => {
            if (newPageSize !== "all") gridApi?.setGridOption("paginationPageSize", newPageSize);
          }}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      </div>

      <AgGridReact
        rowData={filteredData}
        columnDefs={columnDefs}
        pagination={true}
        paginationPageSize={20}
        paginationPageSizeSelector={[10, 20, 50, 100]}
        suppressPaginationPanel={true}
        domLayout="autoHeight"
        onRowClicked={handleRowClick}
        onGridReady={(event) => {
          setGridApi(event.api);
          syncPaginationState(event.api);
        }}
        onPaginationChanged={handlePaginationChanged}
        rowHeight={60}
        headerHeight={50}
      />

      {/* Bottom pagination - same custom bar, mirrors the grid's own pagination state */}
      <div className="mt-1">
        <CustomPagination
          totalItems={gridRowCount}
          currentPage={gridCurrentPage}
          totalPages={gridTotalPages}
          pageSize={gridPageSize}
          onPageChange={(page) => gridApi?.paginationGoToPage(page - 1)}
          onPageSizeChange={(newPageSize) => {
            if (newPageSize !== "all") gridApi?.setGridOption("paginationPageSize", newPageSize);
          }}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      </div>
    </div>
  );
}