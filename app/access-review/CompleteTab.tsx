"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AgGridReact from "@/components/ClientOnlyAgGrid";
import "@/lib/ag-grid-setup";
import { useRouter } from "next/navigation";
import { formatDateMMDDYY as formatDateShared } from "@/utils/utils";
import { defaultColDef } from "@/components/dashboard/columnDefs";
import CustomPagination from "@/components/agTable/CustomPagination";
import ColumnSettings from "@/components/agTable/ColumnSettings";
import {
  GridApi,
  GetRowIdParams,
  RowClickedEvent,
  ColDef,
  IDetailCellRendererParams,
} from "ag-grid-enterprise";
import { useCertifications } from "@/hooks/useApi";
import {
  CertificationRow,
  RawCertification,
  UserRowData,
} from "@/types/certification";
import { PaginatedResponse } from "@/types/api";
import {
  CheckCircleIcon,
  DownloadIcon,
  MoreVertical,
  UserRoundCheckIcon,
  Search,
  Filter,
  Upload,
  Settings,
} from "lucide-react";
import { createPortal } from "react-dom";
import { MasterDetailModule } from "ag-grid-enterprise";
import { ModuleRegistry, themeQuartz } from "ag-grid-community";
import HorizontalProgressBar from "@/components/HorizontalProgressBar";
import { useLoading } from "@/contexts/LoadingContext";
import ActionCompletedToast from "@/components/ActionCompletedToast";
import { getReviewerId } from "@/lib/auth";
import "./AccessReview.css"

// Register AG Grid Enterprise modules
ModuleRegistry.registerModules([MasterDetailModule]);

// Horizontal Progress Renderer
const HorizontalProgressRenderer = (props: any) => {
  const value = props.value || 0;

  return (
    <div className="w-full px-2 flex justify-center items-center mt-4">
      <HorizontalProgressBar 
        value={value} 
        height={8} 
        showPercentage={true}
        className="w-full max-w-[150px]"
      />
    </div>
  );
};

// Detail Cell Renderer for Description (separate row, like Manage Campaigns)
const DetailCellRenderer = (props: IDetailCellRendererParams) => {
  const description = props.data?.description || "No description available";
  return (
    <div className="flex p-2 bg-gray-50 border-t border-gray-200">
      <div className="flex flex-row items-center gap-2">
        <span className="text-gray-800 ml-3 text-sm whitespace-pre-wrap break-words">
          {description}
        </span>
      </div>
    </div>
  );
};

// Date Formatter (delegates to shared util)
export const formatDateMMDDYY = (dateString?: string) =>
  formatDateShared(dateString);

const CompleteTab: React.FC = () => {
  const reviewerId = getReviewerId() || "";
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [rowData, setRowData] = useState<UserRowData[]>([]);
  const [filteredRowData, setFilteredRowData] = useState<UserRowData[]>([]);
  const [detailGridApis, setDetailGridApis] = useState<Map<string, GridApi>>(
    new Map()
  );
  const router = useRouter();
  const pageSizeSelector = [10, 20, 50, 100];
  const [pageSize, setPageSize] = useState(pageSizeSelector[0]);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>("Completed");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [showCompletionToast, setShowCompletionToast] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  const { showApiLoader, hideApiLoader } = useLoading();
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [filterMenuPosition, setFilterMenuPosition] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });

  const completedColumnDefs: ColDef[] = [
    {
      headerName: "Campaign Name",
      field: "certificationName",
      width: 300,
      wrapText: true,
      autoHeight: true,
      cellStyle: { fontWeight: "bold" },
      cellRenderer: (params: any) => {
        const onClick = () =>
          handleRowClick({
            data: params.data,
          } as RowClickedEvent<CertificationRow>);

        return (
          <button
            type="button"
            className="text-left text-blue-600 hover:underline font-semibold"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClick();
            }}
          >
            {params.value}
          </button>
        );
      },
    },
    { 
      headerName: "Type", 
      field: "certificationType", 
      width: 150,
    },
    { 
      headerName: "Owner", 
      field: "certificateRequester", 
      width: 140,
    },
    {
      headerName: "Assigned On",
      field: "certificationCreatedOn",
      width: 150,
      valueFormatter: (params) => formatDateMMDDYY(params.value),
    },
    {
      headerName: "Completed On",
      field: "certificationSignedOff",
      width: 150,
      valueFormatter: (params) => formatDateMMDDYY(params.value),
    },
    { headerName: "Reports", field: "reports", width: 150 },
    { headerName: "Tags", field: "tags", width: 250, hide: true },
  ];

  const { data, error } = useCertifications(
    reviewerId,
    pageSize,
    pageNumber
  );
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const isAuthenticated = true; // Replace with actual auth check
    if (!isAuthenticated) {
      router.push("/");
    } else {
      setAuthChecked(true);
    }
  }, [router]);

  // Expand all detail rows once data is rendered (like campaigns page)
  const onFirstDataRendered = useCallback(
    (params: FirstDataRenderedEvent) => {
      try {
        params.api.forEachNode((node) => {
          if (node.master) {
            node.setExpanded(true);
          }
        });
        setTimeout(() => {
          try {
            params.api.sizeColumnsToFit();
          } catch {}
        }, 50);
      } catch (e) {
        console.error("Error expanding detail rows:", e);
      }
    },
    []
  );

  const toggleFilterMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFilterMenuOpen((prev) => !prev);
    if (filterButtonRef.current) {
      const rect = filterButtonRef.current.getBoundingClientRect();
      setFilterMenuPosition({
        top: rect.bottom,
        left: rect.left,
      });
    }
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);
    if (menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom,
        left: rect.left - 128,
      });
    }
  };

  // Generic action handler for all buttons
  const handleAction = async (actionName: string) => {
    try {
      setIsActionLoading(true);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // End local loading state quickly (no overlay)
      setTimeout(() => {
        setIsActionLoading(false);
      }, 100);
      
      // Show completion toast immediately
      setShowCompletionToast(true);
      
    } catch (error) {
      console.error(`Error performing ${actionName}:`, error);
      setIsActionLoading(false);
    }
  };

  const handleReassign = () => handleAction('Reassign');
  const handleSignOff = () => handleAction('Sign Off');
  const handleDownloadExcel = () => handleAction('Download Excel');
  const handleReleaseClaim = () => handleAction('Release/Claim');

  const handleUpload = () => {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        console.log('Uploading file:', file.name);
        // Here you would typically upload the file to your server
        // For now, we'll just show a success message
        setShowCompletionToast(true);
      }
    };
    input.click();
  };

  const handleDownload = () => {
    // Create a sample Excel file download
    const data = filteredRowData.map(row => ({
      'Campaign Name': row.certificationName,
      'Type': row.certificationType,
      'Owner': row.certificateOwner,
      'Completed On': row.certificationSignedOff,
      'Status': row.status
    }));
    
    // Convert to CSV
    const csvContent = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-review-complete-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const certificationData = data?.certifications;
  useEffect(() => {
    if (certificationData) {
      console.log("API Response:", certificationData); // Debug API response
      const mapped = certificationData.items.map(
        (item: RawCertification): CertificationRow => {
          const certInfo = item.reviewerCertificationInfo;
          const actionInfo = item.reviewerCertificateActionInfo;
          const totalActions = actionInfo?.totalActions ?? 0;
          const totalActionsCompleted = actionInfo?.totalActionsCompleted ?? 0;
          const progress =
            totalActions > 0
              ? Math.round((totalActionsCompleted / totalActions) * 100)
              : 0;
          return {
            id: `${item.reviewerId}-${item.certificationId}`,
            taskId: item.campaignId ?? "",
            reviewerId: item.reviewerId,
            certificationId: item.certificationId,
            campaignId: item.campaignId,
            certificationName: certInfo?.certificationName ?? "",
            certificationType: certInfo?.certificationType ?? "",
            certificationCreatedOn: certInfo?.certificationCreatedOn ?? "",
            certificationExpiration: certInfo?.certificationExpiration ?? "",
            status: certInfo?.status ?? "",
            certificationSignedOff: certInfo?.certificationSignedOff ?? false,
            certificateRequester: certInfo?.certificateRequester ?? "",
            certificateOwner: certInfo?.certificateRequester ?? "", // Map certificateRequester to certificateOwner for the Owner column
            percentageCompleted: actionInfo?.percentageCompleted ?? 0,
            totalActions: totalActions,
            totalActionsCompleted: totalActionsCompleted,
            progress: progress,
            description: certInfo?.certificationDescription ?? "No description provided",
            reviewerName: certInfo?.reviewerName ?? "",
            dueIn: certInfo?.dueIn ?? "",
            estimatedTimeToCompletion: certInfo?.estimatedTimeToCompletion ?? "",
          };
        }
      );
      console.log("Mapped Row Data:", mapped); // Debug mapped data
      setRowData(mapped as unknown as UserRowData[]);
      localStorage.setItem("sharedRowData", JSON.stringify(mapped));
      try { window.dispatchEvent(new Event("localStorageChange")); } catch {}
      setTotalItems(certificationData.total_items || 0);
      setTotalPages(certificationData.total_pages || 1);
      
      // Progress data will be sent to header when a certification row is clicked
    }
  }, [certificationData]);

  useEffect(() => {
    let filtered = rowData;
    
    // Filter by status - show Completed or SignedOff items
    filtered = filtered.filter((row) => 
      row.status === "Completed" || 
      row.status === "SignedOff" || 
      row.certificationSignedOff === true
    );
    
    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter((row) =>
        row.certificationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.certificationType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.reviewerName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredRowData(filtered);
  }, [rowData, searchTerm]);

  const handlePageChange = (newPage: number) => {
    if (newPage !== pageNumber) {
      setPageNumber(newPage);
    }
  };

  function handleRowClick(e: RowClickedEvent<CertificationRow>) {
    const clickedReviewerId = e.data?.reviewerId;
    const clickedCertificationId = e.data?.certificationId;
    const certificationType = e.data?.certificationType;
    
    // Send progress data to header for the clicked certification
    if (e.data) {
      const progressEvent = new CustomEvent('progressDataChange', {
        detail: {
          total: e.data.totalActions,
          approved: e.data.totalActionsCompleted,
          pending: e.data.totalActions - e.data.totalActionsCompleted,
          percentage: e.data.progress
        }
      });
      window.dispatchEvent(progressEvent);
    }
    
    // Store campaign summary data for navigation to App Owner or User Access Review
    if (e.data && (certificationType === "App Owner" || certificationType === "User Manager")) {
      const campaignSummary = {
        campaignName: e.data.certificationName,
        status: e.data.status,
        snapshotAt: e.data.certificationCreatedOn,
        dueDate: e.data.certificationExpiration,
        progress: e.data.progress, // Include campaign progress percentage
        // Add campaign-level progress details for app owner page
        totalItems: e.data.totalActions, // Total actions in the campaign
        approvedCount: e.data.totalActionsCompleted, // Completed actions
        pendingCount: e.data.totalActions - e.data.totalActionsCompleted, // Remaining actions
      };
      localStorage.setItem("selectedCampaignSummary", JSON.stringify(campaignSummary));
      try { window.dispatchEvent(new Event("localStorageChange")); } catch {}
    }
    
    if (clickedReviewerId && clickedCertificationId) {
      if (certificationType === "User Manager") {
        router.push(
          `/access-review/${clickedReviewerId}/${clickedCertificationId}`
        );
      } else if (certificationType === "App Owner") {
        console.log('Navigating to App Owner with parameters:', {
          reviewerId: clickedReviewerId,
          certificationId: clickedCertificationId
        });
        router.push(`/app-owner?reviewerId=${clickedReviewerId}&certificationId=${clickedCertificationId}`);
      }
    }
  }


  return (
    <>
      {error && (
        <div style={{ color: "red", padding: 10 }}>{String(error)}</div>
      )}
      <div className="bg-white rounded-lg px-4 py-3 mb-2 flex items-center justify-between border border-gray-200">
        <div className="flex items-center gap-3">
          <div 
            className="relative bg-white rounded-md border border-gray-300"
            style={{
              display: 'flex',
              padding: '6px 10px',
              alignItems: 'center',
              gap: '8px',
              alignSelf: 'stretch'
            }}
          >
            <Search className="text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 bg-transparent text-gray-700 focus:outline-none flex-1"
            />
          </div>
          <button 
            ref={filterButtonRef}
            onClick={toggleFilterMenu}
            className="p-2 hover:bg-gray-300 rounded-md transition-colors"
          >
            <Filter className="w-4 h-4 text-gray-600" />
          </button>
          {isFilterMenuOpen &&
            createPortal(
              <div
                ref={filterMenuRef}
                className="absolute bg-white border border-gray-300 shadow-lg rounded-md z-50"
                style={{
                  position: "fixed",
                  top: `${filterMenuPosition.top}px`,
                  left: `${filterMenuPosition.left}px`,
                  minWidth: "120px",
                  padding: "8px",
                }}
              >
                <ul className="py-2 text-sm text-gray-700">
                  <li 
                    className={`px-4 py-2 hover:bg-gray-100 cursor-pointer ${filterStatus === "Completed" ? "bg-blue-50 text-blue-600" : ""}`}
                    onClick={() => {
                      setFilterStatus("Completed");
                      setIsFilterMenuOpen(false);
                    }}
                  >
                    Completed
                  </li>
                  <li 
                    className={`px-4 py-2 hover:bg-gray-100 cursor-pointer ${filterStatus === "Expired" ? "bg-blue-50 text-blue-600" : ""}`}
                    onClick={() => {
                      setFilterStatus("Expired");
                      setIsFilterMenuOpen(false);
                    }}
                  >
                    Expired
                  </li>
                </ul>
              </div>,
              document.body
            )}
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleDownload}
            className="p-2 hover:bg-gray-300 rounded-md transition-colors"
            title="Download CSV"
          >
            <DownloadIcon className="w-4 h-4 text-gray-600" />
          </button>
          <ColumnSettings
            columnDefs={completedColumnDefs}
            gridApi={gridApi}
            visibleColumns={() => {
              const visibleCols: string[] = [];
              completedColumnDefs.forEach((colDef) => {
                if (colDef.field) {
                  visibleCols.push(colDef.field);
                }
              });
              return visibleCols;
            }}
            customButton={
              <button className="p-2 hover:bg-gray-300 rounded-md transition-colors">
                <Settings className="w-4 h-4 text-gray-600" />
              </button>
            }
          />
        </div>
      </div>
      
      {/* Top pagination */}
      <div className="mb-2">
        <CustomPagination
          totalItems={totalItems}
          currentPage={pageNumber}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setPageNumber(1); // Reset to first page when changing page size
          }}
          pageSizeOptions={pageSizeSelector}
        />
      </div>
      
      <div className="w-full">
        <div className="ag-theme-quartz ag-main">
          <AgGridReact
            theme={themeQuartz}
            rowData={filteredRowData}
            getRowId={(params: GetRowIdParams) => params.data.id}
            columnDefs={completedColumnDefs}
            defaultColDef={defaultColDef}
            domLayout="autoHeight"
            masterDetail={true}
            detailCellRenderer={DetailCellRenderer}
            detailRowAutoHeight={true}
            detailRowHeight={80}
            onGridReady={(params) => {
              setGridApi(params.api);
              params.api.sizeColumnsToFit();
              const handleResize = () => {
                try {
                  params.api.sizeColumnsToFit();
                } catch {}
              };
              window.addEventListener("resize", handleResize);
              // Clean up listener when grid is destroyed
              params.api.addEventListener('gridPreDestroyed', () => {
                window.removeEventListener("resize", handleResize);
              });
            }}
            pagination={false}
            paginationPageSize={pageSize}
            paginationPageSizeSelector={pageSizeSelector}
            cacheBlockSize={pageSize}
            paginateChildRows={true}
            overlayLoadingTemplate={`<span class="ag-overlay-loading-center">⏳ Loading certification data...</span>`}
            overlayNoRowsTemplate={`<span class="ag-overlay-loading-center">No data to display.</span>`}
          />
        </div>
        <div className="flex justify-center">
          <CustomPagination
            totalItems={totalItems}
            currentPage={pageNumber}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={(newPageSize) => {
              setPageSize(newPageSize);
              setPageNumber(1); // Reset to first page when changing page size
            }}
            pageSizeOptions={pageSizeSelector}
          />
        </div>
      </div>

      {/* Action Completed Toast */}
      <ActionCompletedToast
        isVisible={showCompletionToast}
        message={"Action completed"}
        onClose={() => setShowCompletionToast(false)}
        duration={1500}
      />
    </>
  );
};

export default CompleteTab;
