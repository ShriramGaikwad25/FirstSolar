"use client";
import React, { useMemo, useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then(mod => mod.AgGridReact), { ssr: false });
import { ColDef, ICellRendererParams, GridApi, themeQuartz } from "ag-grid-community";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import "@/lib/ag-grid-setup";
import { formatDateMMDDYY } from "../access-review/page";
import {
  CircleCheck,
  CircleX,
  ChevronDown,
  ChevronRight,
  Download as DownloadIcon,
  UserRoundCheckIcon,
  SquarePen,
} from "lucide-react";
import { getReviewerId } from "@/lib/auth";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import CustomPagination from "@/components/agTable/CustomPagination";
import Filters from "@/components/agTable/Filters";
import ProxyActionModal from "@/components/ProxyActionModal";
import { useActionPanel } from "@/contexts/ActionPanelContext";
import { updateAction } from "@/lib/api";

const EntitlementOwnerPageContent = () => {
  const { openSidebar, closeSidebar } = useRightSidebar();
  const searchParams = useSearchParams();
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [rowData, setRowData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  // Track which row has Approve/Revoke selected (so only that row shows as selected)
  const [selectedRowAction, setSelectedRowAction] = useState<{ rowId: string; action: "Approve" | "Revoke" } | null>(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentCategory, setCommentCategory] = useState("");
  const [commentSubcategory, setCommentSubcategory] = useState("");
  const [isCommentDropdownOpen, setIsCommentDropdownOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [commentRow, setCommentRow] = useState<any | null>(null);
  const { queueAction } = useActionPanel();

  // Get reviewerId, certificationId, and appInstanceId from URL parameters
  const reviewerId =
    searchParams.get("reviewerId") || getReviewerId() || "";
  const certificationId =
    searchParams.get("certificationId") || "";
  const appInstanceId =
    searchParams.get("appinstanceid") || "b73ac8d7-f4cd-486f-93c7-3589ab5c5296";

  // Transform rowData to add description rows (separate row for each description)
  const filteredRowData = useMemo(() => {
    if (!rowData || rowData.length === 0) return [];

    let base = rowData;
    const normalizedFilter = (statusFilter || "All").toLowerCase();
    if (normalizedFilter !== "all") {
      base = rowData.filter((item) => {
        const rawStatus = String(item.status || item.action || "").toLowerCase();
        if (normalizedFilter === "pending") {
          return rawStatus === "pending";
        }
        if (normalizedFilter === "approve" || normalizedFilter === "certify") {
          return rawStatus.startsWith("approve") || rawStatus === "approved";
        }
        return true;
      });
    }

    const rows: any[] = [];
    for (const item of base) {
      rows.push(item);
      rows.push({ ...item, __isDescRow: true });
    }
    return rows;
  }, [rowData, statusFilter]);

  // Action handlers (rowId identifies which row so only that row shows Approve/Revoke as selected)
  const handleApprove = (rowId?: string, row?: any) => {
    setError(null);
    // Toggle: if this row already has Approve selected, clear the selection
    if (
      rowId != null &&
      selectedRowAction?.rowId === rowId &&
      selectedRowAction?.action === "Approve"
    ) {
      setSelectedRowAction(null);
      setLastAction(null);
      console.log("Approve action cleared", `for row ${rowId}`);
      return;
    }
    setLastAction("Approve");
    setSelectedRowAction(rowId != null ? { rowId, action: "Approve" } : null);
    console.log("Approve action triggered", rowId != null ? `for row ${rowId}` : "");

    // Queue approve action so floating submit button appears (ActionPanel)
    try {
      const syntheticId =
        row?.lineItemId ||
        row?.lineitemid ||
        row?.entitlementLineItemId ||
        row?.entitlementId ||
        row?.entitlementid ||
        rowId ||
        `${row?.applicationName || ""}|${row?.entitlementName || row?.["Ent Name"] || ""}`;

      if (syntheticId && certificationId && reviewerId) {
        const payload: any = {
          useraction: [],
          accountAction: [],
          entitlementAction: [
            {
              actionType: "Approve",
              lineItemIds: [syntheticId],
              justification: "",
            },
          ],
        };
        queueAction({
          reviewerId,
          certId: certificationId,
          payload,
          count: 0,
          isCertifyFilter: true,
        });
      }
    } catch (e) {
      console.error("Failed to queue approve action from Entitlement Owner:", e);
    }
  };

  const openReassignModal = (rowId?: string) => {
    setError(null);
    setLastAction("Reassign");
    console.log("Open reassign popup for row", rowId ?? "(unknown)");
    setIsReassignModalOpen(true);
  };

  const handleComment = () => {
    setCommentText(comment);
    setCommentCategory("");
    setCommentSubcategory("");
    setIsCommentDropdownOpen(false);
    setIsCommentModalOpen(true);
  };

  const handleSaveComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;

    setComment(trimmed);

    try {
      // Prefer the row that opened the comment popup
      let targetRow: any = commentRow;

      // Fallback: try to derive from currently selected "Approve" row
      if (!targetRow && gridApi && selectedRowAction) {
        gridApi.forEachNode((node: any) => {
          if (!node.data || node.data.__isDescRow) return;
          if (node.id === selectedRowAction.rowId) {
            targetRow = node.data;
          }
        });
      }

      const syntheticId =
        targetRow?.lineItemId ||
        targetRow?.lineitemid ||
        targetRow?.entitlementLineItemId ||
        targetRow?.entitlementId ||
        targetRow?.entitlementid ||
        (selectedRowAction?.rowId ?? "");

      if (syntheticId && certificationId && reviewerId) {
        const payload: any = {
          useraction: [],
          accountAction: [],
          entitlementAction: [
            {
              // Empty action; only justification/comment should be recorded
              actionType: "",
              lineItemIds: [syntheticId],
              justification: trimmed,
            },
          ],
        };
        await updateAction(reviewerId, certificationId, payload);
      }
    } catch (e) {
      console.error(
        "[Entitlement Owner] Failed to save comment via updateAction:",
        e
      );
    }

    setIsCommentModalOpen(false);
    setCommentText("");
    setCommentRow(null);
  };

  const handleCancelComment = () => {
    setIsCommentModalOpen(false);
    setCommentText("");
    setCommentCategory("");
    setCommentSubcategory("");
    setIsCommentDropdownOpen(false);
  };

  // Comment options data structure
  const commentOptions = {
    "Approve": [
      "Access required to perform current job responsibilities.",
      "Access aligns with user's role and department functions.",
      "Validated with manager/business owner – appropriate access.",
      "No SoD (Segregation of Duties) conflict identified.",
      "User continues to work on project/system requiring this access."
    ],
    "Revoke": [
      "User no longer in role requiring this access.",
      "Access redundant – duplicate with other approved entitlements.",
      "Access not used in last 90 days (inactive entitlement).",
      "SoD conflict identified – removing conflicting access.",
      "Temporary/project-based access – no longer required."
    ]
  };

  const handleCategoryChange = (category: string) => {
    setCommentCategory(category);
    setCommentSubcategory("");
    setCommentText("");
  };

  const handleSubcategoryChange = (subcategory: string) => {
    setCommentSubcategory(subcategory);
    setCommentText(`${commentCategory} - ${subcategory}`);
  };

  // Fetch data from cached Entitlement Owner catalog details (set on click)
  useEffect(() => {
    const loadFromCache = () => {
      try {
        setLoading(true);
        setApiError(null);

        const cached = typeof window !== "undefined"
          ? localStorage.getItem("entitlementOwnerCatalogCertificationDetails")
          : null;

        if (!cached) {
          console.warn("No cached entitlement owner catalog details found");
          setRowData([]);
          setTotalItems(0);
          setTotalPages(1);
          setLoading(false);
          return;
        }

        const parsed = JSON.parse(cached);
        const items =
          parsed?.items ||
          parsed?.data?.items ||
          (Array.isArray(parsed) ? parsed : [parsed]);

        if (!items || items.length === 0) {
          console.warn("No entitlements found in cached data");
          setRowData([]);
          setTotalItems(0);
          setTotalPages(1);
          setLoading(false);
          return;
        }

        // Transform cached data to match the expected format (same as catalog page)
        const transformedData =
          items.map((item: any) => {
            // New API wraps catalog details inside catalogDetails; fall back to flat item if needed
            const details = item.catalogDetails || item;
            const metadata = details.metadata || {};

            // Normalize snake_case and different APIs to the keys used by Applications sidebar
            const name =
              details.name ||
              details.entitlementName ||
              details.entitlementname ||
              "N/A";
            const description =
              details.description ||
              details.entitlementDescription ||
              details.details ||
              details.summary ||
              details.comment ||
              details.notes ||
              "N/A";
            const entType =
              details["Ent Type"] ||
              details.entitlementType ||
              details.entitlementtype ||
              details.type ||
              "N/A";
            const appName =
              details["App Name"] ||
              details.applicationName ||
              details.applicationname ||
              details.appName ||
              "N/A";
            const entOwner =
              details["Ent Owner"] ||
              details.entitlementOwner ||
              details.entitlementowner ||
              details.owner ||
              "N/A";
            const appOwner =
              details["App Owner"] ||
              details.applicationowner ||
              details.appOwner ||
              "N/A";
            const businessObjective =
              details["Business Objective"] ||
              details.businessObjective ||
              details.business_objective ||
              "N/A";
            const complianceType =
              details["Compliance Type"] ||
              details.complianceType ||
              details.regulatory_scope ||
              "N/A";
            const dataClassification =
              details["Data Classification"] ||
              details.data_classification ||
              "N/A";
            const businessUnit =
              details["Business Unit"] ||
              details.businessunit_department ||
              "N/A";
            const riskVal =
              details["Risk"] || details.risk || details.riskLevel || "N/A";
            const requestable =
              details.requestable ?? details["Requestable"] ? "Yes" : "No";
            const certifiable =
              details.certifiable ?? details["Certifiable"] ? "Yes" : "No";
            const lastReviewed =
              details["Last Reviewed on"] ||
              details.last_reviewed_on ||
              details.lastReviewedOn ||
              details.last_reviewed ||
              "N/A";
            const lastSync =
              details["Last Sync"] ||
              details.last_sync ||
              details.lastSync ||
              "N/A";
            const createdOn =
              details["Created On"] ||
              details.created_on ||
              details.createdOn ||
              details.createdDate ||
              details.createddate ||
              "N/A";
            const reviewSchedule =
              details["Review Schedule"] ||
              details.review_schedule ||
              details.reviewSchedule ||
              "N/A";
            const accessScope =
              details["Access Scope"] ||
              details.access_scope ||
              details.accessScope ||
              "N/A";

            // Normalize tags/dynamicTag so we never pass an object directly to React
            const rawTags =
              details["Dynamic Tag"] ?? details.tags ?? details.dynamicTag;
            let dynamicTag: string;
            if (Array.isArray(rawTags)) {
              dynamicTag = rawTags.join(", ");
            } else if (rawTags && typeof rawTags === "object") {
              dynamicTag = Object.entries(rawTags)
                .map(([key, value]) => `${key}: ${String(value)}`)
                .join(", ");
            } else if (rawTags != null && rawTags !== "") {
              dynamicTag = String(rawTags);
            } else {
              dynamicTag = "N/A";
            }
            const revokeOnDisable =
              details["Revoke on Disable"] ??
              details.revoke_on_disable ??
              details.revokeOnDisable
                ? "Yes"
                : "No";
            const sharedPwd =
              details["Shared Pwd"] ?? details.shared_pwd ?? details.sharedPassword;
            const sharedPwdText =
              sharedPwd === true || sharedPwd === "true"
                ? "Yes"
                : sharedPwd === false || sharedPwd === "false"
                ? "No"
                : sharedPwd || "N/A";
            const mfaStatus =
              details["MFA Status"] ||
              details.mfa_status ||
              details.mfaStatus ||
              "N/A";
            const hierarchy =
              details["Hierarchy"] || details.hierarchy || "N/A";
            const preReq =
              details["Pre- Requisite"] || details.prerequisite || "N/A";
            const preReqDetails =
              details["Pre-Requisite Details"] ||
              details.prerequisite_details ||
              details.prerequisiteDetails ||
              "N/A";
            const totalAssignments =
              details["Total Assignments"] ||
              details.totalAssignments ||
              details.assignmentCount ||
              details.totalassignmentstousers ||
              0;
            const assignment =
              details["assignment"] ||
              details.assignment ||
              details.assigned_to ||
              details.assignedTo ||
              "N/A";
            const licenseType =
              details["License Type"] || details.license_type || "N/A";
            const toxicCombination =
              details["SOD Check"] ||
              details.toxic_combination ||
              details.sodCheck ||
              "N/A";
            const provisionerGroup =
              details["Provisioner Group"] ||
              details.provisioner_group ||
              "N/A";
            const provisioningSteps =
              details["Provisioning Steps"] ||
              details.provisioning_steps ||
              "N/A";
            const provisioningMechanism =
              details["Provisioning Mechanism"] ||
              details.provisioning_mechanism ||
              "N/A";
            const autoAssignPolicy =
              details["Auto Assign Access Policy"] ||
              details.auto_assign_access_policy ||
              "N/A";
            const actionOnNativeChange =
              details["Action on Native Change"] ||
              details.action_on_native_change ||
              "N/A";
            const accountTypeRestriction =
              details["Account Type Restriction"] ||
              details.account_type_restriction ||
              "N/A";
            const nonPersistentAccess =
              details["Non Persistent Access"] ??
              details.non_persistent_access ??
              details.nonPersistentAccess
                ? "Yes"
                : "No";
            const privilegedVal =
              details["Privileged"] ?? details.privileged ? "Yes" : "No";
            const costCenter =
              details["Cost Center"] ||
              details.cost_center ||
              details.costCenter ||
              "N/A";
            const auditComments =
              details["Audit Comments"] ||
              details.audit_comments ||
              details.auditComments ||
              "N/A";

            return {
              entitlementName: name,
              description: description,
              "Ent Name": name,
              "Ent Description": description,
              type: entType,
              "Ent Type": entType,
              applicationName: appName,
              "App Name": appName,
              risk: riskVal,
              "Risk": riskVal,
              "Total Assignments": totalAssignments,
              "Dynamic Tag": dynamicTag,
              "Business Objective": businessObjective,
              "Business Unit": businessUnit,
              "Ent Owner": entOwner,
              "Compliance Type": complianceType,
              "Data Classification": dataClassification,
              "Cost Center": costCenter,
              "Created On": createdOn,
              "Last Sync": lastSync,
              "App Instance":
                details.appinstanceid || metadata.instanceId || appInstanceId,
              "App Owner": appOwner,
              "Hierarchy": hierarchy,
              "MFA Status": mfaStatus,
              "assignment": assignment,
              "License Type": licenseType,
              "Certifiable": certifiable,
              "Revoke on Disable": revokeOnDisable,
              "Shared Pwd": sharedPwdText,
              "SOD Check": toxicCombination,
              "Access Scope": accessScope,
              "Review Schedule": reviewSchedule,
              "Last Reviewed on": lastReviewed,
              "Privileged": privilegedVal,
              "Non Persistent Access": nonPersistentAccess,
              "Audit Comments": auditComments,
              "Account Type Restriction": accountTypeRestriction,
              "Requestable": requestable,
              "Pre- Requisite": preReq,
              "Pre-Requisite Details": preReqDetails,
              "Auto Assign Access Policy": autoAssignPolicy,
              "Provisioner Group": provisionerGroup,
              "Provisioning Steps": provisioningSteps,
              "Provisioning Mechanism": provisioningMechanism,
              "Action on Native Change": actionOnNativeChange,
              entitlementId:
                details.entitlementId ||
                details.entitlementid ||
                metadata.entitlementId ||
                item.entitlementId ||
                "",
              lineItemId: item.lineItemId || "",
              status: item.action || details.status || "Pending",
            };
          }) || [];

        console.log("Transformed cached data count:", transformedData.length);
        setRowData(transformedData);
        const total = items.length || transformedData.length;
        setTotalItems(total);
        setTotalPages(Math.max(1, Math.ceil(total / pageSize)));

        // Populate shared header data so navbar can show context
        try {
          const headerData = transformedData.map((ent: any, idx: number) => ({
            id: ent.entitlementId || ent.entitlementid || `ent-${idx}`,
            certificationName: "Entitlement Owner Review",
            certificationExpiration: "",
            status: ent.status || "Pending",
            fullName: ent["Ent Owner"] || ent.entitlementOwner || "Entitlement Owner",
            manager: "",
            department: ent["Business Unit"] || "",
            jobtitle: ent["Ent Type"] || ent.type || "",
            userType: "Internal",
          }));
          localStorage.setItem("sharedRowData", JSON.stringify(headerData));
          window.dispatchEvent(new Event("localStorageChange"));
        } catch (e) {
          console.warn("Failed to update sharedRowData for header:", e);
        }
      } catch (err: any) {
        console.error("Error loading cached entitlements:", err);
        setApiError(err.message || "Failed to load entitlements from cache");
      } finally {
        setLoading(false);
      }
    };

    loadFromCache();
  }, [pageSize]);

  // Sync grid pagination with entitlement-based pagination
  useEffect(() => {
    if (gridApi) {
      // Update pagination page size when pageSize changes
      gridApi.setGridOption("paginationPageSize", pageSize * 2);
      // Convert entitlement page (1-based) to grid page (0-based)
      // Since each entitlement = 2 rows, and paginationPageSize = pageSize * 2,
      // grid page = currentPage - 1
      const gridPage = currentPage - 1;
      const currentGridPage = gridApi.paginationGetCurrentPage?.() ?? 0;
      if (currentGridPage !== gridPage) {
        gridApi.paginationGoToPage(gridPage);
      }
      updatePaginationState(gridApi);
    }
  }, [currentPage, pageSize, gridApi]);

  const underReviewColDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "entitlementName",
        headerName: "Entitlement Name",
        width: 700,
        autoHeight: true,
        wrapText: true,
        colSpan: (params) => {
          if (!params.data?.__isDescRow) return 1;
          try {
            const center = (params.api as any)?.getDisplayedCenterColumns?.() || [];
            const left = (params.api as any)?.getDisplayedLeftColumns?.() || [];
            const right = (params.api as any)?.getDisplayedRightColumns?.() || [];
            const total = center.length + left.length + right.length;
            if (total > 0) return total;
          } catch {}
          const all = (params as any)?.columnApi?.getAllDisplayedColumns?.() || [];
          return all.length || 1;
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.data?.__isDescRow) {
            const desc = params.data?.["description"] ||
              params.data?.["Ent Description"] ||
              params.data?.description ||
              "No description available";
            const isEmpty = !desc || desc === "N/A" || desc.trim().length === 0;
            return (
              <div className={`text-sm w-full break-words whitespace-pre-wrap ${isEmpty ? "text-gray-400 italic" : "text-gray-600"}`}>
                {isEmpty ? "No description available" : desc}
              </div>
            );
          }

          const rawRisk = params.data?.risk || params.data?.["Risk"] || "";
          const riskVal = rawRisk.toString().toLowerCase();
          const isHighRisk = riskVal === "high" || riskVal === "critical";

          return (
            <div
              className="flex items-center h-full"
              title={isHighRisk ? "High risk entitlement" : undefined}
            >
              {isHighRisk ? (
                <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm font-medium">
                  {params.value}
                </span>
              ) : (
                <span className="font-semibold">{params.value}</span>
              )}
            </div>
          );
        },
      },
      { field: "type", headerName: "Type", width: 120 },
      { field: "applicationName", headerName: "Application", width: 150 },
      {
        field: "risk",
        headerName: "Risk",
        width: 120,
        hide: true,
        cellRenderer: (params: ICellRendererParams) => {
          const risk = params.value;
          const riskColor =
            risk === "High" ? "red" : risk === "Medium" ? "orange" : "green";
          return (
            <span className="font-medium" style={{ color: riskColor }}>
              {risk}
            </span>
          );
        },
      },
      { field: "Last Reviewed on", headerName: "Last Reviewed", width: 180 },
      {
        headerName: "Actions",
        width: 270,
        cellRenderer: (params: ICellRendererParams) => {
          const rowId = params.node?.id ?? "";
          const rowData = params.data || {};
          const isApproveSelected = selectedRowAction?.action === "Approve" && selectedRowAction?.rowId === rowId;
          const isRevokeSelected = selectedRowAction?.action === "Revoke" && selectedRowAction?.rowId === rowId;
          return (
            <div className="flex space-x-4 h-full items-start">
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <button
                onClick={() => handleApprove(rowId, rowData)}
                title="Approve"
                aria-label="Approve this row"
                className="p-1 rounded transition-colors duration-200 hover:bg-green-100"
              >
                <CircleCheck
                  className="cursor-pointer"
                  color={isApproveSelected ? "#ffffff" : "#1c821cff"}
                  strokeWidth="1"
                  size="32"
                  fill={isApproveSelected ? "#1c821cff" : "none"}
                />
              </button>
              <button
                onClick={() => openReassignModal(rowId)}
                title="Reassign"
                aria-label="Reassign this row"
                className={`p-1 rounded transition-colors duration-200 ${
                  isRevokeSelected ? "bg-red-100" : ""
                }`}
              >
                <UserRoundCheckIcon
                  className="cursor-pointer"
                  color="#b146ccff"
                  strokeWidth="1"
                  size="24"
                />
              </button>
              <button
                onClick={() => {
                  setCommentRow(rowData);
                  handleComment();
                }}
                title="Comment"
                aria-label="Add comment"
                className="p-1 rounded"
              >
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 32 32"
                  className="cursor-pointer hover:opacity-80"
                >
                  <path
                    d="M0.700195 0V19.5546H3.5802V25.7765C3.57994 25.9525 3.62203 26.1247 3.70113 26.2711C3.78022 26.4176 3.89277 26.5318 4.02449 26.5992C4.15621 26.6666 4.30118 26.6842 4.44101 26.6498C4.58085 26.6153 4.70926 26.5304 4.80996 26.4058C6.65316 24.1232 10.3583 19.5546 10.3583 19.5546H25.1802V0H0.700195ZM2.1402 1.77769H23.7402V17.7769H9.76212L5.0202 23.6308V17.7769H2.1402V1.77769ZM5.0202 5.33307V7.11076H16.5402V5.33307H5.0202ZM26.6202 5.33307V7.11076H28.0602V23.11H25.1802V28.9639L20.4383 23.11H9.34019L7.9002 24.8877H19.8421C19.8421 24.8877 23.5472 29.4563 25.3904 31.7389C25.4911 31.8635 25.6195 31.9484 25.7594 31.9828C25.8992 32.0173 26.0442 31.9997 26.1759 31.9323C26.3076 31.8648 26.4202 31.7507 26.4993 31.6042C26.5784 31.4578 26.6204 31.2856 26.6202 31.1096V24.8877H29.5002V5.33307H26.6202ZM5.0202 8.88845V10.6661H10.7802V8.88845H5.0202ZM5.0202 12.4438V14.2215H19.4202V12.4438H5.0202Z"
                    fill="#2684FF"
                  />
                </svg>
              </button>
              <button
                onClick={() => {
                  const row = params?.data || {};
                  const rowNodeId = params.node?.id ?? "";
                  const InfoSidebar = () => {
                    const [sectionsOpen, setSectionsOpen] = useState({
                      general: false,
                      business: false,
                      technical: false,
                      security: false,
                      lifecycle: false,
                    });
                    const [entName, setEntName] = useState<string>(
                      row?.["Ent Name"] ||
                        row?.entitlementName ||
                        row?.applicationName ||
                        ""
                    );
                    const [entDescription, setEntDescription] = useState<string>(
                      row?.["Ent Description"] ||
                        row?.description ||
                        row?.details ||
                        ""
                    );

                    return (
                      <div className="flex flex-col h-full">
                        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                          {/* Header Section */}
                          <div className="p-4 border-b bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="mt-1">
                                  <span className="text-xs uppercase text-gray-500">
                                    Entitlement Name:
                                  </span>
                                  <input
                                    type="text"
                                    value={entName}
                                    readOnly
                                    className="mt-1 w-full px-2 py-1 text-sm border border-gray-200 rounded bg-gray-50 text-gray-600 cursor-not-allowed"
                                  />
                                </div>
                                <div className="mt-2">
                                  <span className="text-xs uppercase text-gray-500">
                                    Description:
                                  </span>
                                  <textarea
                                    value={entDescription}
                                    onChange={(e) => setEntDescription(e.target.value)}
                                    rows={3}
                                    className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex space-x-2">
                              <button
                              onClick={() => handleApprove(rowNodeId, row)}
                                title="Approve"
                                aria-label="Approve entitlement"
                                className="p-1 rounded transition-colors duration-200 hover:bg-green-100"
                              >
                                <CircleCheck
                                  className="cursor-pointer"
                                  color={selectedRowAction?.action === "Approve" && selectedRowAction?.rowId === rowNodeId ? "#ffffff" : "#1c821cff"}
                                  strokeWidth="1"
                                  size="32"
                                  fill={selectedRowAction?.action === "Approve" && selectedRowAction?.rowId === rowNodeId ? "#1c821cff" : "none"}
                                />
                              </button>
                              <button
                                onClick={() => openReassignModal(rowNodeId)}
                                title="Reassign"
                                aria-label="Reassign entitlement"
                                className={`p-1 rounded ${
                                  (selectedRowAction?.action === "Revoke" && selectedRowAction?.rowId === rowNodeId) || row?.status === "Rejected" ? "bg-red-100" : ""
                                }`}
                              >
                                <UserRoundCheckIcon
                                  className="cursor-pointer hover:opacity-80"
                                  color="#b146ccff"
                                  strokeWidth="1"
                                  size="24"
                                />
                              </button>
                              <button
                                onClick={() => {
                                  setCommentRow(row);
                                  handleComment();
                                }}
                                title="Comment"
                                aria-label="Add comment"
                                className="p-1 rounded"
                              >
                                <svg
                                  width="30"
                                  height="30"
                                  viewBox="0 0 32 32"
                                  className="cursor-pointer hover:opacity-80"
                                >
                                  <path
                                    d="M0.700195 0V19.5546H3.5802V25.7765C3.57994 25.9525 3.62203 26.1247 3.70113 26.2711C3.78022 26.4176 3.89277 26.5318 4.02449 26.5992C4.15621 26.6666 4.30118 26.6842 4.44101 26.6498C4.58085 26.6153 4.70926 26.5304 4.80996 26.4058C6.65316 24.1232 10.3583 19.5546 10.3583 19.5546H25.1802V0H0.700195ZM2.1402 1.77769H23.7402V17.7769H9.76212L5.0202 23.6308V17.7769H2.1402V1.77769ZM5.0202 5.33307V7.11076H16.5402V5.33307H5.0202ZM26.6202 5.33307V7.11076H28.0602V23.11H25.1802V28.9639L20.4383 23.11H9.34019L7.9002 24.8877H19.8421C19.8421 24.8877 23.5472 29.4563 25.3904 31.7389C25.4911 31.8635 25.6195 31.9484 25.7594 31.9828C25.8992 32.0173 26.0442 31.9997 26.1759 31.9323C26.3076 31.8648 26.4202 31.7507 26.4993 31.6042C26.5784 31.4578 26.6204 31.2856 26.6202 31.1096V24.8877H29.5002V5.33307H26.6202ZM5.0202 8.88845V10.6661H10.7802V8.88845H5.0202ZM5.0202 12.4438V14.2215H19.4202V12.4438H5.0202Z"
                                    fill="#2684FF"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <div className="p-4 space-y-4">
                            {/* General Accordion */}
                            <div className="bg-white border border-gray-200 rounded-md shadow-sm">
                              <button
                                className="flex items-center w-full text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
                                onClick={() =>
                                  setSectionsOpen((s: any) => ({ ...s, general: !s.general }))
                                }
                              >
                                {sectionsOpen.general ? (
                                  <ChevronDown size={20} className="mr-2" />
                                ) : (
                                  <ChevronRight size={20} className="mr-2" />
                                )}{" "}
                                General
                              </button>
                              {sectionsOpen.general && (
                                <div className="p-4 space-y-2 text-sm text-gray-700">
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Ent Type
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Ent Type"] || row?.type || "N/A"}
                                        readOnly
                                        className="w-full px-2 py-1 border border-gray-200 rounded bg-gray-50 text-gray-600 cursor-not-allowed"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        #Assignments
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={String(row?.["Total Assignments"] ?? "N/A")}
                                        readOnly
                                        className="w-full px-2 py-1 border border-gray-200 rounded bg-gray-50 text-gray-600 cursor-not-allowed"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        App Name
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={
                                          row?.["App Name"] ||
                                          row?.applicationName ||
                                          "N/A"
                                        }
                                        readOnly
                                        className="w-full px-2 py-1 border border-gray-200 rounded bg-gray-50 text-gray-600 cursor-not-allowed"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Tag(s)
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Dynamic Tag"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Business Accordion */}
                            <div className="bg-white border border-gray-200 rounded-md shadow-sm">
                              <button
                                className="flex items-center w-full text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
                                onClick={() =>
                                  setSectionsOpen((s: any) => ({ ...s, business: !s.business }))
                                }
                              >
                                {sectionsOpen.business ? (
                                  <ChevronDown size={20} className="mr-2" />
                                ) : (
                                  <ChevronRight size={20} className="mr-2" />
                                )}{" "}
                                Business
                              </button>
                              {sectionsOpen.business && (
                                <div className="p-4 space-y-2 text-sm text-gray-700">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      Objective
                                    </label>
                                    <textarea
                                      defaultValue={row?.["Business Objective"] || "N/A"}
                                      rows={2}
                                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                    />
                                  </div>
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Business Unit
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Business Unit"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Business Owner
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Ent Owner"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      Regulatory Scope
                                    </label>
                                    <input
                                      type="text"
                                      defaultValue={row?.["Compliance Type"] || "N/A"}
                                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Data Classification
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Data Classification"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Cost Center
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Cost Center"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Technical Accordion */}
                            <div className="bg-white border border-gray-200 rounded-md shadow-sm">
                              <button
                                className="flex items-center w-full text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
                                onClick={() =>
                                  setSectionsOpen((s: any) => ({
                                    ...s,
                                    technical: !s.technical,
                                  }))
                                }
                              >
                                {sectionsOpen.technical ? (
                                  <ChevronDown size={20} className="mr-2" />
                                ) : (
                                  <ChevronRight size={20} className="mr-2" />
                                )}{" "}
                                Technical
                              </button>
                              {sectionsOpen.technical && (
                                <div className="p-4 space-y-2 text-sm text-gray-700">
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Created On
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Created On"] || "N/A"}
                                        readOnly
                                        className="w-full px-2 py-1 border border-gray-200 rounded bg-gray-50 text-gray-600 cursor-not-allowed"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Last Sync
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Last Sync"] || "N/A"}
                                        readOnly
                                        className="w-full px-2 py-1 border border-gray-200 rounded bg-gray-50 text-gray-600 cursor-not-allowed"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        App Name
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={
                                          row?.["App Name"] ||
                                          row?.applicationName ||
                                          "N/A"
                                        }
                                        readOnly
                                        className="w-full px-2 py-1 border border-gray-200 rounded bg-gray-50 text-gray-600 cursor-not-allowed"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        App Instance
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["App Instance"] || "N/A"}
                                        readOnly
                                        className="w-full px-2 py-1 border border-gray-200 rounded bg-gray-50 text-gray-600 cursor-not-allowed"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        App Owner
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["App Owner"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Ent Owner
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Ent Owner"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Hierarchy
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Hierarchy"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        MFA Status
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["MFA Status"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      Assigned to/Member of
                                    </label>
                                    <input
                                      type="text"
                                      defaultValue={row?.["assignment"] || "N/A"}
                                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      License Type
                                    </label>
                                    <input
                                      type="text"
                                      defaultValue={row?.["License Type"] || "N/A"}
                                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Security Accordion */}
                            <div className="bg-white border border-gray-200 rounded-md shadow-sm">
                              <button
                                className="flex items-center w-full text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
                                onClick={() =>
                                  setSectionsOpen((s: any) => ({ ...s, security: !s.security }))
                                }
                              >
                                {sectionsOpen.security ? (
                                  <ChevronDown size={20} className="mr-2" />
                                ) : (
                                  <ChevronRight size={20} className="mr-2" />
                                )}{" "}
                                Security
                              </button>
                              {sectionsOpen.security && (
                                <div className="p-4 space-y-2 text-sm text-gray-700">
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Risk
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Risk"] || row?.risk || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Certifiable
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Certifiable"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Revoke on Disable
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Revoke on Disable"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Shared Pwd
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Shared Pwd"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      SoD/Toxic Combination
                                    </label>
                                    <input
                                      type="text"
                                      defaultValue={row?.["SOD Check"] || "N/A"}
                                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      Access Scope
                                    </label>
                                    <input
                                      type="text"
                                      defaultValue={row?.["Access Scope"] || "N/A"}
                                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Review Schedule
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Review Schedule"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Last Reviewed On
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Last Reviewed on"] || "N/A"}
                                        readOnly
                                        className="w-full px-2 py-1 border border-gray-200 rounded bg-gray-50 text-gray-600 cursor-not-allowed"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Privileged
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Privileged"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Non Persistent Access
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Non Persistent Access"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      Audit Comments
                                    </label>
                                    <textarea
                                      defaultValue={row?.["Audit Comments"] || "N/A"}
                                      rows={2}
                                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      Account Type Restriction
                                    </label>
                                    <input
                                      type="text"
                                      defaultValue={row?.["Account Type Restriction"] || "N/A"}
                                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Lifecycle Accordion */}
                            <div className="bg-white border border-gray-200 rounded-md shadow-sm">
                              <button
                                className="flex items-center w-full text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
                                onClick={() =>
                                  setSectionsOpen((s: any) => ({
                                    ...s,
                                    lifecycle: !s.lifecycle,
                                  }))
                                }
                              >
                                {sectionsOpen.lifecycle ? (
                                  <ChevronDown size={20} className="mr-2" />
                                ) : (
                                  <ChevronRight size={20} className="mr-2" />
                                )}{" "}
                                Lifecycle
                              </button>
                              {sectionsOpen.lifecycle && (
                                <div className="p-4 space-y-2 text-sm text-gray-700">
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Requestable
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Requestable"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Pre-Requisite
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Pre- Requisite"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      Pre-Req Details
                                    </label>
                                    <textarea
                                      defaultValue={row?.["Pre-Requisite Details"] || "N/A"}
                                      rows={2}
                                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                    />
                                  </div>
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Auto Assign Access Policy
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Auto Assign Access Policy"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Provisioner Group
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Provisioner Group"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Provisioning Steps
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Provisioning Steps"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Provisioning Mechanism
                                      </label>
                                      <input
                                        type="text"
                                        defaultValue={row?.["Provisioning Mechanism"] || "N/A"}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      Action on Native Change
                                    </label>
                                    <input
                                      type="text"
                                      defaultValue={row?.["Action on Native Change"] || "N/A"}
                                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  };
                  
                  openSidebar(<InfoSidebar />, { widthPx: 500, title: "Edit Entitlement" });
                }}
                title="Edit"
                className="p-1 rounded transition-colors duration-200 hover:bg-gray-100 cursor-pointer"
                aria-label="Edit entitlement"
              >
                <SquarePen className="w-6 h-6 text-gray-600 hover:text-blue-600" />
              </button>
            </div>
          );
        },
        suppressMenu: true,
        sortable: false,
        filter: false,
        resizable: false,
      },
    ],
    [error, lastAction, reviewerId]
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
    }),
    [selectedRowAction, error]
  );

  const handleGridSizeChanged = (params: any) => {
    try {
      const api = params.api as GridApi;
      if (api) {
        api.sizeColumnsToFit();
      }
    } catch {
      // noop – best-effort column resize
    }
  };

  const updatePaginationState = (api: GridApi | null) => {
    if (!api) return;
    const pageZeroBased = api.paginationGetCurrentPage?.() ?? 0;
    // Calculate total pages based on actual entitlements, not rows
    // Since each entitlement = 2 rows (entitlement + description),
    // we divide filteredRowData.length by 2 to get actual entitlements
    const actualTotalItems = rowData.length;
    const actualTotalPages = Math.ceil(actualTotalItems / pageSize);
    setCurrentPage(Math.max(1, pageZeroBased + 1));
    setTotalPages(Math.max(1, actualTotalPages));
    setTotalItems(actualTotalItems);
  };

  const handleDownload = () => {
    if (!gridApi) return;
    gridApi.exportDataAsCsv({
      fileName: "entitlement-meta-data.csv",
      onlySelected: false,
    });
  };

  if (loading) {
    return (
      <div className="ag-theme-alpine" style={{ height: 600, width: "100%" }}>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading entitlements...</p>
          </div>
        </div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="ag-theme-alpine w-full">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <p className="text-red-600 font-semibold mb-2">
              Error Loading Entitlements
            </p>
            <p className="text-gray-600 mb-4">{apiError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ag-theme-alpine w-full">
      <style jsx global>{`
        .ag-paging-panel { display: none !important; }
      `}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={searchText}
            onChange={(e) => {
              const val = e.target.value;
              setSearchText(val);
              gridApi?.setGridOption("quickFilterText", val);
              // Show all search results from all pages
              if (gridApi) {
                gridApi.setGridOption("paginationPageSize", val.trim() ? 100000 : pageSize * 2);
              }
            }}
            placeholder="Search..."
            className="border border-gray-300 rounded px-3 h-8 text-xs w-64"
          />
          <Filters
            context="entitlement-meta-status"
            appliedFilter={(filters: string[]) => {
              const selected = filters && filters.length > 0 ? filters[0] : "All";
              if (selected === "All" || !selected) {
                setStatusFilter("All");
              } else if (selected === "Pending") {
                setStatusFilter("Pending");
              } else if (selected === "Approve") {
                setStatusFilter("Approve");
              } else {
                // For any other status values, treat as All for this page
                setStatusFilter("All");
              }
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center justify-center h-8 w-8 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-800"
          title="Download CSV"
          aria-label="Download CSV"
        >
          <DownloadIcon className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Top pagination */}
      <div className="mb-2">
        <CustomPagination
          totalItems={totalItems}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={(newPage) => {
            setCurrentPage(newPage);
          }}
          onPageSizeChange={(newPageSize) => {
            if (typeof newPageSize === 'number') {
              setPageSize(newPageSize);
              setCurrentPage(1);
            }
          }}
        />
      </div>
      <div style={{ width: "100%" }}>
        <AgGridReact
          theme={themeQuartz}
          rowData={filteredRowData}
          columnDefs={underReviewColDefs}
          defaultColDef={defaultColDef}
          animateRows={true}
          rowSelection="multiple"
          domLayout="autoHeight"
          pagination={true}
          paginationPageSize={pageSize * 2}
          suppressRowTransform={true}
          getRowId={(params: any) => {
            const d = params.data || {};
            const baseId =
              d.entitlementId ||
              d.entitlementid ||
              d.catalogId ||
              `${d.applicationName || ""}|${d.entitlementName || d.name || ""}`;
            return d.__isDescRow ? `${baseId}-desc` : baseId;
          }}
          onGridReady={(params: any) => {
            setGridApi(params.api);
            params.api.setGridOption("paginationPageSize", pageSize * 2);
            updatePaginationState(params.api);
            params.api.sizeColumnsToFit();
            params.api.addEventListener("paginationChanged", () => updatePaginationState(params.api));
            params.api.addEventListener("modelUpdated", () => updatePaginationState(params.api));
            params.api.addEventListener("filterChanged", () => updatePaginationState(params.api));
            params.api.addEventListener("sortChanged", () => updatePaginationState(params.api));
          }}
          onGridSizeChanged={handleGridSizeChanged}
        />
      </div>

      <div className="mt-1">
        <CustomPagination
          totalItems={totalItems}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={(newPage) => {
            setCurrentPage(newPage);
          }}
          onPageSizeChange={(newPageSize) => {
            if (typeof newPageSize === 'number') {
              setPageSize(newPageSize);
              setCurrentPage(1);
            }
          }}
        />
      </div>

      {/* Reassign Modal (reuse Access Review proxy modal) */}
      <ProxyActionModal
        isModalOpen={isReassignModalOpen}
        closeModal={() => setIsReassignModalOpen(false)}
        heading="Reassign Entitlement"
        users={[
          { username: "john", email: "john@example.com", role: "admin" },
          { username: "jane", email: "jane@example.com", role: "user" },
        ]}
        groups={[
          { name: "entitlement-owners", email: "ent-owners@corp.com", role: "owner" },
          { name: "app-owners", email: "app-owners@corp.com", role: "owner" },
        ]}
        userAttributes={[
          { value: "username", label: "Username" },
          { value: "email", label: "Email" },
        ]}
        groupAttributes={[
          { value: "name", label: "Group Name" },
          { value: "role", label: "Role" },
        ]}
        onSelectOwner={(assignee) => {
          console.log(
            "[Entitlement Owner] Reassign to:",
            assignee.username || assignee.name,
            assignee.email || ""
          );
          setIsReassignModalOpen(false);
        }}
      />

      {/* Comment Modal */}
      {isCommentModalOpen &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-3">
            <div className="bg-white p-4 rounded-lg shadow-lg max-w-sm w-full mx-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Comment</h3>
              </div>
              
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comment Suggestions
                </label>
                <div className="relative">
                  <button
                    type="button"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-left focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white flex items-center justify-between"
                    onClick={() => setIsCommentDropdownOpen(!isCommentDropdownOpen)}
                  >
                    <span className="text-gray-500">
                      {commentSubcategory ? `${commentCategory} - ${commentSubcategory}` : 'Select a comment suggestion...'}
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isCommentDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isCommentDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
                      <div className="p-2 space-y-2">
                        {/* Approve Section */}
                        <div>
                          <div className="flex items-center p-1">
                            <div className="w-3 h-3 rounded-full border-2 mr-2 flex items-center justify-center border-green-500 bg-green-500">
                              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                            </div>
                            <span className="text-xs font-medium text-gray-900">Approve</span>
                          </div>
                          
                          <div className="ml-5 mt-1 space-y-1">
                            {commentOptions["Approve"].map((option, index) => (
                              <div
                                key={index}
                                className="text-xs text-gray-600 cursor-pointer hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
                                onClick={() => {
                                  handleCategoryChange("Approve");
                                  handleSubcategoryChange(option);
                                  setIsCommentDropdownOpen(false);
                                }}
                              >
                                {option}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Revoke Section */}
                        <div>
                          <div className="flex items-center p-1">
                            <div className="w-3 h-3 rounded-full border-2 mr-2 flex items-center justify-center border-red-500 bg-red-500">
                              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                            </div>
                            <span className="text-xs font-medium text-gray-900">Revoke</span>
                          </div>
                          
                          <div className="ml-5 mt-1 space-y-1">
                            {commentOptions["Revoke"].map((option, index) => (
                              <div
                                key={index}
                                className="text-xs text-gray-600 cursor-pointer hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
                                onClick={() => {
                                  handleCategoryChange("Revoke");
                                  handleSubcategoryChange(option);
                                  setIsCommentDropdownOpen(false);
                                }}
                              >
                                {option}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comment
                </label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={
                    commentCategory 
                      ? `Enter additional details for ${commentCategory.toLowerCase()}...` 
                      : "Select an action type and reason, or enter your comment here..."
                  }
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              
              <div className="flex justify-end items-center gap-3">
                <button
                  onClick={handleCancelComment}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors min-w-[80px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveComment}
                  disabled={!commentText.trim()}
                  className={`px-6 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 transition-colors min-w-[80px] ${
                    commentText.trim()
                      ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EntitlementOwnerPageContent />
    </Suspense>
  );
}

