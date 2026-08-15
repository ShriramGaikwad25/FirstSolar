"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { useCertifications, fetchAccessDetails, useCertificationDetails } from "@/hooks/useApi";
import {
  CertificationRow,
  RawCertification,
  UserRowData,
} from "@/types/certification";
import { PaginatedResponse } from "@/types/api";
import { getCertificationDetails, getCertifications } from "@/lib/api";
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
import { getReviewerId, getCookie, COOKIE_NAMES } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import ProxyActionModal from "@/components/ProxyActionModal";
import SignOffModal from "@/components/SignOffModal";
import { validatePassword, signOffCertification, getAccessDetails, getLineItemDetails, executeQuery } from "@/lib/api";
import ExcelJS from "exceljs";
import "./AccessReview.css"
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";

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

/** Demo list row; empty reviewerId so row click does not navigate to a real certification. */
function getDummyQ3NhiAccessReviewRow(): CertificationRow & {
  progress: number;
  description: string;
  reviewerName: string;
  dueIn: string;
  estimatedTimeToCompletion: string;
  totalActions: number;
  totalActionsCompleted: number;
} {
  return {
    id: "dummy-access-review-q3-nhi-production",
    taskId: "",
    reviewerId: "",
    certificationId: "dummy-q3-nhi-production-access-review",
    campaignId: "",
    certificationName:
      "Access Review Campaign: Q3 NHI Production Access Review",
    certificationType: "Access Review",
    certificationCreatedOn: "2026-03-15",
    certificationExpiration: "2026-09-30",
    status: "Active",
    certificationSignedOff: false,
    certificateRequester: "Priya Shah",
    certificateOwner: "Priya Shah",
    percentageCompleted: 14,
    totalActions: 84,
    totalActionsCompleted: 12,
    progress: 14,
    description: "Demonstration campaign (dummy data).",
    reviewerName: "",
    dueIn: "",
    estimatedTimeToCompletion: "",
  };
}

const OpenTab: React.FC = () => {
  const reviewerId = getReviewerId() || "";
  const { user } = useAuth();
  const { isVisible: isLeftSidebarVisible } = useLeftSidebar();
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
  const [filterStatus, setFilterStatus] = useState<string>("Active");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [showCompletionToast, setShowCompletionToast] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [selectedCertificationRow, setSelectedCertificationRow] = useState<CertificationRow | null>(null);
  const [isSignOffModalOpen, setIsSignOffModalOpen] = useState(false);
  const [selectedSignOffRow, setSelectedSignOffRow] = useState<CertificationRow | null>(null);
  const [signOffError, setSignOffError] = useState<string | null>(null);
  
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
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const activeColumnDefs = useMemo<ColDef[]>(() =>[
    {
      headerName: "Campaign Name",
      field: "certificationName",
      width: 400,
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
      field: "certificateOwner", 
      width: 140,
    },
    {
      headerName: "Progress",
      field: "progress",
      width: 180,
      cellRenderer: HorizontalProgressRenderer,
    },
    { headerName: "Due On", field: "certificationExpiration", width: 140,valueFormatter: (params) => formatDateMMDDYY(params.value), },
    {
      headerName: "Estimated time to completion",
      field: "estimatedTimeToCompletion",
      width: 250,
      hide: true,
    },
    { headerName: "Tags", field: "tags", width: 250, hide: true },
    {
      headerName: "Created On",
      field: "certificationCreatedOn",
      width: 160,
      valueFormatter: (params) => formatDateMMDDYY(params.value),
    },
    {
      headerName: "Actions",
      width: 200,
      cellRenderer: (params: any) => (
        <div
          className="flex space-x-4 h-full items-start"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            title="Reassign"
            aria-label="Reassign selected rows"
            className="p-1 rounded transition-colors duration-200"
            onClick={() => handleReassign(params.data)}
            disabled={isActionLoading}
          >
            <UserRoundCheckIcon
              className="cursor-pointer"
              color="#b146ccff"
              strokeWidth="1"
              size="24"
            />
          </button>
          <button
            title="Sign Off"
            aria-label="Sign off selected rows"
            className="p-1 rounded transition-colors duration-200"
            onClick={() => handleSignOff(params.data)}
            disabled={isActionLoading}
          >
            <CheckCircleIcon
              className="cursor-pointer"
              strokeWidth="1"
              size="24"
              color="#e73c3cff"
            />
          </button>
          <button
            title="Download Excel"
            aria-label="Download Excel"
            className="p-1 rounded transition-colors duration-200"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("Download Excel button clicked!");
              console.log("isActionLoading:", isActionLoading);
              console.log("Button should not be disabled");
              try {
                const certificationId = params.data?.certificationId;
                if (!certificationId) {
                  alert("Certification ID not found");
                  return;
                }
                await handleDownloadExcel(certificationId);
              } catch (error) {
                console.error("Error in handleDownloadExcel:", error);
                alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
              }
            }}
            disabled={isActionLoading}
          >
            <DownloadIcon
              className="cursor-pointer"
              strokeWidth="1"
              size="24"
            />
          </button>
          <button
            title="Upload"
            aria-label="Upload file"
            className="p-1 rounded transition-colors duration-200"
            onClick={handleUpload}
            disabled={isActionLoading}
          >
            <Upload
              className="cursor-pointer"
              strokeWidth="1"
              size="24"
            />
          </button>
          <button
            ref={menuButtonRef}
            onClick={toggleMenu}
            title="More Actions"
            className={`cursor-pointer rounded-sm hover:opacity-80 ${
              isMenuOpen ? "bg-[#6D6E73]/20" : ""
            }`}
            aria-label="More actions"
          >
            <MoreVertical
              color="#35353A"
              size="32"
              className="transform scale-[0.6]"
            />
          </button>
          <div className="relative flex items-center">
            {isMenuOpen &&
              createPortal(
                <div
                  ref={menuRef}
                  className="absolute bg-white border border-gray-300 shadow-lg rounded-md z-50"
                  style={{
                    position: "fixed",
                    top: `${menuPosition.top}px`,
                    left: `${menuPosition.left}px`,
                    minWidth: "160px",
                    padding: "8px",
                  }}
                >
                  <ul className="py-2 text-sm text-gray-700">
                    <li 
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={handleReleaseClaim}
                    >
                      Release/Claim
                    </li>
                  </ul>
                </div>,
                document.body
              )}
          </div>
        </div>
      ),
    },
    ],
    []
  );

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

  const handleReassign = (rowData: CertificationRow) => {
    setSelectedCertificationRow(rowData);
    setIsReassignModalOpen(true);
  };

  const handleSignOff = (rowData: CertificationRow) => {
    setSelectedSignOffRow(rowData);
    setSignOffError(null);
    setIsSignOffModalOpen(true);
  };

  const handleSignOffConfirm = async (password: string, comments: string) => {
    if (!selectedSignOffRow) {
      setSignOffError("No certification selected");
      return;
    }

    try {
      setIsActionLoading(true);
      setSignOffError(null);
      showApiLoader?.(true, "Validating password...");

      // Get current user's username from logged-in user
      // Try auth context first (user.email contains the userid/username)
      let userName = user?.email;
      
      // Fallback to cookie if auth context doesn't have it
      if (!userName) {
        try {
          const uidTenant = getCookie(COOKIE_NAMES.UID_TENANT);
          if (uidTenant) {
            const parsed = JSON.parse(uidTenant);
            userName = parsed?.userid;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      // Final fallback to reviewerId
      if (!userName) {
        userName = reviewerId;
      }
      
      if (!userName) {
        throw new Error("Unable to determine user name");
      }

      // Step 1: Validate password
      const isPasswordValid = await validatePassword(userName, password);
      
      if (!isPasswordValid) {
        setSignOffError("Invalid password. Please try again.");
        setIsActionLoading(false);
        hideApiLoader?.();
        return;
      }

      // Step 2: Sign off certification
      showApiLoader?.(true, "Signing off certification...");
      await signOffCertification(
        selectedSignOffRow.reviewerId,
        selectedSignOffRow.certificationId,
        comments
      );

      // Success
      setIsSignOffModalOpen(false);
      setSelectedSignOffRow(null);
      setSignOffError(null);
      setShowCompletionToast(true);
      
      // Optionally refresh the data
      // You might want to refetch certifications here
    } catch (error) {
      console.error("Error signing off certification:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to sign off certification";
      setSignOffError(errorMessage);
    } finally {
      setIsActionLoading(false);
      hideApiLoader?.();
    }
  };

  const handleDownloadExcel = async (certificationId: string) => {
    console.log("=== handleDownloadExcel START ===");
    console.log("certificationId:", certificationId);
    
    try {
      setIsActionLoading(true);
      showApiLoader?.(true, "Downloading certification data...");

      // Call the executeQuery API
      const query = "select * from vw_download_cert_access_by_certid where certificationid = ?::uuid LIMIT 3000";
      const parameters = [certificationId];
      
      console.log("Calling executeQuery with:", { query, parameters });
      const response = await executeQuery<any>(query, parameters);
      
      console.log("executeQuery response:", response);
      console.log("Response type:", typeof response);
      console.log("Is array:", Array.isArray(response));
      
      // Handle different response structures
      let dataArray: any[] = [];
      
      if (response) {
        // Check if response has resultSet property (common in SQL query responses)
        if (response.resultSet && Array.isArray(response.resultSet)) {
          dataArray = response.resultSet;
          console.log("Using resultSet from response, length:", dataArray.length);
        } 
        // Check if response is directly an array
        else if (Array.isArray(response)) {
          dataArray = response;
          console.log("Response is direct array, length:", dataArray.length);
        }
        // Check if response has data property
        else if (response.data && Array.isArray(response.data)) {
          dataArray = response.data;
          console.log("Using data property from response, length:", dataArray.length);
        }
        // If response is a single object, wrap it in an array
        else if (typeof response === 'object' && response !== null) {
          dataArray = [response];
          console.log("Response is single object, wrapping in array");
        }
      }
      
      if (dataArray.length === 0) {
        alert("No data found for this certification.");
        return;
      }

      console.log(`Processing ${dataArray.length} rows from query result`);
      console.log("First row sample:", dataArray[0]);

      // Create Excel workbook using ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Certification Access Data");
      
      // Extract headers and data rows
      let headers: string[] = [];
      let rows: any[][] = [];
      
      const firstRow = dataArray[0];
      
      if (firstRow && typeof firstRow === 'object' && firstRow !== null && !Array.isArray(firstRow)) {
        // Response is an array of objects - use object keys as headers
        const allHeaders = Object.keys(firstRow);
        console.log("All headers from object keys:", allHeaders);
        
        // Filter out unwanted columns (case-insensitive)
        const excludedColumns = ['lineitemid', 'certificationid', 'taskid'];
        headers = allHeaders.filter(header => 
          !excludedColumns.some(excluded => header.toLowerCase() === excluded.toLowerCase())
        );
        console.log("Filtered headers (excluding lineitemid, certificationid, taskid):", headers);
        
        // Filter rows where comment is "NONE" (case-insensitive) and map to values
        rows = dataArray
          .filter((row: any) => {
            // Check if comment column exists and is not "NONE"
            const commentKey = allHeaders.find(h => h.toLowerCase() === 'comment');
            if (commentKey) {
              const commentValue = String(row[commentKey] || '').trim().toUpperCase();
              return commentValue !== 'NONE';
            }
            return true; // Include row if no comment column found
          })
          .map((row: any) => {
            return headers.map(header => {
              const value = row[header];
              // Handle null, undefined, and complex objects
              if (value === null || value === undefined) {
                return "";
              }
              // If value is an object or array, stringify it
              if (typeof value === 'object') {
                return JSON.stringify(value);
              }
              return value;
            });
          });
      } else if (Array.isArray(firstRow)) {
        // Response is an array of arrays - first row might be headers
        // Check if first row looks like headers (all strings) or data
        const allStrings = firstRow.every((cell: any) => typeof cell === 'string');
        if (allStrings && dataArray.length > 1) {
          const allHeaders = firstRow as string[];
          // Filter out unwanted columns (case-insensitive)
          const excludedColumns = ['lineitemid', 'certificationid', 'taskid'];
          const excludedIndices: number[] = [];
          headers = allHeaders.filter((header, index) => {
            const shouldExclude = excludedColumns.some(excluded => header.toLowerCase() === excluded.toLowerCase());
            if (shouldExclude) {
              excludedIndices.push(index);
            }
            return !shouldExclude;
          });
          
          // Filter rows where comment is "NONE" and exclude unwanted columns
          const commentIndex = allHeaders.findIndex(h => h.toLowerCase() === 'comment');
          rows = dataArray.slice(1)
            .filter((row: any[]) => {
              if (commentIndex >= 0 && commentIndex < row.length) {
                const commentValue = String(row[commentIndex] || '').trim().toUpperCase();
                return commentValue !== 'NONE';
              }
              return true;
            })
            .map((row: any[]) => {
              return row.filter((_, index) => !excludedIndices.includes(index));
            });
        } else {
          // No headers, generate generic ones
          headers = firstRow.map((_: any, index: number) => `Column ${index + 1}`);
          rows = dataArray;
        }
      } else {
        // Fallback: single column
        headers = ["Data"];
        rows = dataArray.map(row => [String(row)]);
      }
      
      console.log("Final headers:", headers);
      console.log("Number of data rows after filtering:", rows.length);
      
      // Add header row
      const headerRow = worksheet.addRow(headers);
      
      // Style the header row
      headerRow.font = { bold: true, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      
      // Add borders to header row
      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      
      // Add data rows
      rows.forEach((rowData) => {
        const row = worksheet.addRow(rowData);
        // Add borders to data rows
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        });
      });
      
      // Set column widths based on content
      headers.forEach((header, index) => {
        const column = worksheet.getColumn(index + 1);
        
        // Calculate max width based on header and data
        let maxLength = header.length;
        rows.forEach(row => {
          const cellValue = String(row[index] || '');
          if (cellValue.length > maxLength) {
            maxLength = cellValue.length;
          }
        });
        
        // Set width with min/max constraints
        column.width = Math.min(Math.max(maxLength + 2, 10), 50);
      });
      
      // Freeze header row
      worksheet.views = [
        {
          state: 'frozen',
          ySplit: 1
        }
      ];
      
      // Generate Excel file buffer
      console.log("Generating Excel buffer...");
      const excelBuffer = await workbook.xlsx.writeBuffer();

      console.log(`Excel buffer size: ${excelBuffer.byteLength} bytes`);

      // Create blob and download
      const blob = new Blob([excelBuffer], { 
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
      });
      
      console.log(`Blob created, size: ${blob.size} bytes`);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fileName = `certification-access-${certificationId}-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.download = fileName;
      document.body.appendChild(a);
      console.log(`Triggering download: ${fileName}`);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      console.log("Download completed successfully");
      setShowCompletionToast(true);
    } catch (error) {
      console.error("Error downloading Excel file:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      alert(`Failed to download Excel file: ${error instanceof Error ? error.message : "Unknown error"}\n\nCheck console for details.`);
    } finally {
      setIsActionLoading(false);
      hideApiLoader?.();
    }
  };

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

      const withDummy =
        pageNumber === 1
          ? [getDummyQ3NhiAccessReviewRow(), ...mapped]
          : mapped;
      setRowData(withDummy as unknown as UserRowData[]);
      localStorage.setItem("sharedRowData", JSON.stringify(withDummy));
      try { window.dispatchEvent(new Event("localStorageChange")); } catch {}
      setTotalItems(certificationData.total_items || 0);
      setTotalPages(certificationData.total_pages || 1);
      
      // Progress data will be sent to header when a certification row is clicked
    }
  }, [certificationData, reviewerId, pageNumber]);

  useEffect(() => {
    let filtered = rowData;

    // Show all non-signed-off items, regardless of status,
    // so types like "Entitlement Owner" are visible here.
    filtered = filtered.filter((row) => row.certificationSignedOff !== true);

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

  // Resize grid when left sidebar visibility changes or container size changes
  useEffect(() => {
    if (!gridApi || !gridContainerRef.current) return;

    let resizeTimeout: NodeJS.Timeout | null = null;

    // Use ResizeObserver to detect container size changes (including sidebar expand/collapse)
    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize calls to avoid excessive updates
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        try {
          gridApi.sizeColumnsToFit();
        } catch (error) {
          console.error("Error resizing grid:", error);
        }
      }, 100);
    });

    resizeObserver.observe(gridContainerRef.current);

    // Also trigger resize when sidebar visibility changes (for immediate feedback)
    const timeouts: NodeJS.Timeout[] = [];
    
    // Immediate resize attempt
    timeouts.push(setTimeout(() => {
      try {
        gridApi.sizeColumnsToFit();
      } catch (error) {
        console.error("Error resizing grid:", error);
      }
    }, 50));
    
    // Resize after transition completes (300ms + buffer)
    timeouts.push(setTimeout(() => {
      try {
        gridApi.sizeColumnsToFit();
      } catch (error) {
        console.error("Error resizing grid:", error);
      }
    }, 400));
    
    return () => {
      resizeObserver.disconnect();
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [isLeftSidebarVisible, gridApi]);

  const handlePageChange = (newPage: number) => {
    if (newPage !== pageNumber) {
      setPageNumber(newPage);
    }
  };

  async function handleRowClick(e: RowClickedEvent<CertificationRow>) {
    const clickedReviewerId = e.data?.reviewerId;
    const clickedCertificationId = e.data?.certificationId;
    const certificationType = e.data?.certificationType;

    const isNhiDummy =
      e.data?.id === "dummy-access-review-q3-nhi-production" ||
      e.data?.certificationId === "dummy-q3-nhi-production-access-review";

    if (isNhiDummy && e.data) {
      const total = e.data.totalActions ?? 0;
      const approved = e.data.totalActionsCompleted ?? 0;
      const pending = Math.max(0, total - approved);
      window.dispatchEvent(
        new CustomEvent("progressDataChange", {
          detail: {
            total,
            approved,
            pending,
            percentage: e.data.progress ?? 0,
          },
        })
      );
      const campaignSummary = {
        reviewerId: e.data.reviewerId ?? "",
        certificationId: e.data.certificationId,
        campaignName: e.data.certificationName,
        status: e.data.status,
        snapshotAt: e.data.certificationCreatedOn,
        dueDate: e.data.certificationExpiration,
        progress: e.data.progress ?? 0,
        totalItems: total,
        approvedCount: approved,
        pendingCount: pending,
      };
      localStorage.setItem(
        "selectedCampaignSummary",
        JSON.stringify(campaignSummary)
      );
      try {
        window.dispatchEvent(new Event("localStorageChange"));
      } catch {
        /* ignore */
      }
      router.push("/access-review/nhi-q3-production-review");
      return;
    }

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
    
    // Store campaign summary data for navigation to App Owner, User Access Review, or Entitlement Owner
    if (e.data && (certificationType === "App Owner" || certificationType === "User Manager" || certificationType === "Entitlement Owner")) {
      const campaignSummary = {
        reviewerId: clickedReviewerId,
        certificationId: clickedCertificationId,
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
      } else if (certificationType === "Entitlement Owner") {
        console.log('Fetching Entitlement Owner catalog details with parameters:', {
          reviewerId: clickedReviewerId,
          certificationId: clickedCertificationId
        });

        try {
          showApiLoader?.(true, "Loading entitlement owner details...");

          const response = await fetch(
            `https://preview.keyforge.ai/certification/api/v1/ACMECOM/getCatalogCertificationDetails/${clickedReviewerId}/${clickedCertificationId}`
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch catalog certification details: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          // Store details for the Entitlement Owner page (or other consumers)
          localStorage.setItem(
            "entitlementOwnerCatalogCertificationDetails",
            JSON.stringify(data)
          );
        } catch (error) {
          console.error("Error fetching Entitlement Owner catalog details:", error);
        } finally {
          hideApiLoader?.();
        }

        router.push(`/entitlement-owner?reviewerId=${clickedReviewerId}&certificationId=${clickedCertificationId}`);
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
                    className={`px-4 py-2 hover:bg-gray-100 cursor-pointer ${filterStatus === "Active" ? "bg-blue-50 text-blue-600" : ""}`}
                    onClick={() => {
                      setFilterStatus("Active");
                      setIsFilterMenuOpen(false);
                    }}
                  >
                    Active
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
                  <li 
                    className={`px-4 py-2 hover:bg-gray-100 cursor-pointer ${filterStatus === "Preview" ? "bg-blue-50 text-blue-600" : ""}`}
                    onClick={() => {
                      setFilterStatus("Preview");
                      setIsFilterMenuOpen(false);
                    }}
                  >
                    Preview
                  </li>
                </ul>
              </div>,
              document.body
            )}
        </div>
        
        <div className="flex items-center gap-3">
          <ColumnSettings
            columnDefs={activeColumnDefs}
            gridApi={gridApi}
            visibleColumns={() => {
              const visibleCols: string[] = [];
              activeColumnDefs.forEach((colDef) => {
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
        <div className="ag-theme-quartz ag-main" ref={gridContainerRef}>
        <AgGridReact
          theme={themeQuartz}
          rowData={filteredRowData}
          getRowId={(params: GetRowIdParams) => params.data.id}
          columnDefs={activeColumnDefs}
          defaultColDef={defaultColDef}
          domLayout="autoHeight"
          masterDetail={true}
          detailCellRenderer={DetailCellRenderer}
          detailRowAutoHeight={true}
          detailRowHeight={80}
          onGridReady={(params) => {
            console.log("Grid initialized:", {
              api: !!params.api,
              columnApi: !!params.columnApi,
              enterpriseModules: params.api.isEnterprise?.() ? "Loaded" : "Not loaded",
            });
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
          onFirstDataRendered={(params) => {
            // Expand all rows so description is visible on the next row by default
            params.api.forEachNode((node) => node.setExpanded(true));
          }}
          onRowDataUpdated={(params) => {
            // Keep description rows expanded when data updates (e.g. pagination, search)
            params.api.forEachNode((node) => node.setExpanded(true));
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

      {/* Reassign Modal */}
      <ProxyActionModal
        isModalOpen={isReassignModalOpen}
        closeModal={() => {
          setIsReassignModalOpen(false);
          setSelectedCertificationRow(null);
        }}
        heading="Reassign"
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
        onSelectOwner={async (owner) => {
          if (!selectedCertificationRow) {
            console.error("No certification row selected");
            return;
          }

          try {
            setIsActionLoading(true);
            showApiLoader?.(true, "Reassigning certification...");

            // Determine owner type and ID
            // Check if owner has username (User) or name (Group)
            const ownerType = owner.username ? "User" : "Group";
            // For users, prefer the actual internal user identifier (userid/id),
            // then fall back to username/email only if necessary.
            // For groups, use the stable group id, then name.
            const ownerId =
              ownerType === "User"
                ? ((owner as any).userid || (owner as any).id || owner.username || owner.email || "")
                : (owner.id || (owner as any).group_id || owner.name || "");

            // Construct the payload
            const rowData = selectedCertificationRow as any; // Type assertion to access reviewerName
            const payload = {
              reviewerName: rowData.reviewerName || "",
              reviewerId: selectedCertificationRow.reviewerId,
              certificationId: selectedCertificationRow.certificationId,
              taskId: selectedCertificationRow.taskId || selectedCertificationRow.campaignId || "",
              // At certification level, backend expects certificationId in lineItemId
              lineItemId: selectedCertificationRow.certificationId,
              assignmentEntity: "Cert",
              newOwnerDetails: {
                id: ownerId,
                type: ownerType,
              },
              justification: "Reassignment requested", // Default justification
            };

            // Make the API call
            const response = await fetch(
              `https://preview.keyforge.ai/certification/api/v1/ACMECOM/reassign/${selectedCertificationRow.reviewerId}/${selectedCertificationRow.certificationId}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              }
            );

            if (!response.ok) {
              throw new Error(`Reassign failed: ${response.statusText}`);
            }

            // Success
            setIsReassignModalOpen(false);
            setSelectedCertificationRow(null);
            setShowCompletionToast(true);
            
            // Optionally refresh the data
            // You might want to refetch certifications here
          } catch (error) {
            console.error("Error reassigning certification:", error);
            alert(`Failed to reassign: ${error instanceof Error ? error.message : "Unknown error"}`);
          } finally {
            setIsActionLoading(false);
            hideApiLoader?.();
          }
        }}
      />

      {/* Sign Off Modal */}
      <SignOffModal
        isOpen={isSignOffModalOpen}
        onClose={() => {
          setIsSignOffModalOpen(false);
          setSelectedSignOffRow(null);
          setSignOffError(null);
        }}
        onConfirm={handleSignOffConfirm}
        userName={
          (() => {
            // Try auth context first (user.email contains the userid/username)
            if (user?.email) return user.email;
            
            // Fallback to cookie if auth context doesn't have it
            try {
              const uidTenant = getCookie(COOKIE_NAMES.UID_TENANT);
              if (uidTenant) {
                const parsed = JSON.parse(uidTenant);
                if (parsed?.userid) return parsed.userid;
              }
            } catch (e) {
              // Ignore parsing errors
            }
            
            // Final fallback to reviewerId
            return reviewerId || "";
          })()
        }
        isLoading={isActionLoading}
        error={signOffError}
      />
    </>
  );
};

export default OpenTab;
