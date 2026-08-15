"use client";
import React, { useMemo, useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(() => import("ag-grid-react").then(mod => mod.AgGridReact), { ssr: false });
import { ColDef, ICellRendererParams, GridApi, themeQuartz } from "ag-grid-community";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import "@/lib/ag-grid-setup";
import EditReassignButtons from "@/components/agTable/EditReassignButtons";
import { formatDateMMDDYY } from "../access-review/page";
import {
  CircleCheck,
  CircleX,
  ArrowRightCircle,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info,
  Briefcase,
  Cpu,
  ShieldCheck,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import { getCatalogEntitlements } from "@/lib/api";
import { getReviewerId } from "@/lib/auth";
import { PaginatedResponse } from "@/types/api";
import PolicyRiskDetails from "@/components/PolicyRiskDetails";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import CustomPagination from "@/components/agTable/CustomPagination";

/** Continuous Compliance → Owner inactive: one catalog row (matches transformed catalog shape). */
const CC_OWNER_INACTIVE_DESCRIPTION =
  "Entitlement ownership requires review because the designated owner is inactive. Reassign or certify the entitlement to restore governed ownership.";

const CC_OWNER_INACTIVE_ROW = {
  entitlementName: "ZNEW_MGT_ACCOUNTS_FMEDFAMNR",
  description: CC_OWNER_INACTIVE_DESCRIPTION,
  type: "Group",
  risk: "Medium",
  applicationName: "SAP_S4",
  assignment: "N/A",
  "Last Sync": "2026-03-15",
  "Last Reviewed on": "N/A",
  "Total Assignments": 0,
  Requestable: "Yes",
  Certifiable: "Yes",
  "SOD Check": "N/A",
  Hierarchy: "N/A",
  "Pre- Requisite": "No",
  "Pre-Requisite Details": "N/A",
  "Revoke on Disable": "Yes",
  "Shared Pwd": "No",
  "Capability/Technical Scope": "N/A",
  "Business Objective": "N/A",
  "Compliance Type": "N/A",
  "Access Scope": "N/A",
  Reviewed: "No",
  "Dynamic Tag": "",
  "MFA Status": "N/A",
  "Review Schedule": "N/A",
  "Ent Owner": "Inactive Owner",
  "App Owner": "N/A",
  "Created On": "2026-01-01",
  Privileged: "No",
  "Audit Comments": "",
  "Ent Name": "ZNEW_MGT_ACCOUNTS_FMEDFAMNR",
  "App Name": "SAP_S4",
  "Ent Description": CC_OWNER_INACTIVE_DESCRIPTION,
  "Business Unit": "N/A",
  "Data Classification": "N/A",
  "License Type": "N/A",
  "Provisioner Group": "N/A",
  "Provisioning Steps": "N/A",
  "Provisioning Mechanism": "N/A",
  "Auto Assign Access Policy": "N/A",
  "Action on Native Change": "N/A",
  "Account Type Restriction": "N/A",
  "Non Persistent Access": "N/A",
  entitlementId: "cc-owner-inactive-ent",
};

const CatalogPageContent = () => {
  const { openSidebar, closeSidebar } = useRightSidebar();
  const searchParams = useSearchParams();
  const ccOwnerInactive = searchParams.get("ccOwnerInactive") === "1";
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [rowData, setRowData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Get appinstanceid and reviewerId from URL parameters with fallback values
  const appInstanceId =
    searchParams.get("appinstanceid") || "b73ac8d7-f4cd-486f-93c7-3589ab5c5296";
  const reviewerId =
    searchParams.get("reviewerId") || getReviewerId() || "";

  // Catalog now always renders the "All" table view.
  const entTabIndex = 0;
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [highRiskData, setHighRiskData] = useState<any>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedAppFilter, setSelectedAppFilter] = useState<string>("All");
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentCategory, setCommentCategory] = useState("");
  const [commentSubcategory, setCommentSubcategory] = useState("");
  const [isCommentDropdownOpen, setIsCommentDropdownOpen] = useState(false);

  // Apply app filter first, then transform to include paired description rows.
  const appFilteredEntitlements = useMemo(() => {
    if (!rowData || rowData.length === 0) return [];
    if (selectedAppFilter === "All") return rowData;
    return rowData.filter(
      (item) => (item?.applicationName || "").toString() === selectedAppFilter
    );
  }, [rowData, selectedAppFilter]);

  const filteredRowData = useMemo(() => {
    if (!appFilteredEntitlements || appFilteredEntitlements.length === 0) return [];
    const rows: any[] = [];
    for (const item of appFilteredEntitlements) {
      rows.push(item);
      rows.push({ ...item, __isDescRow: true });
    }
    return rows;
  }, [appFilteredEntitlements]);

  const applicationOptions = useMemo(() => {
    return [
      "All",
      "ACMECorporateDirectory",
      "Workday",
      "Oracle_Fusion_HCM",
      "SAP_S4",
      "KF_OCI",
    ];
  }, []);

  // Action handlers for Under Review tab
  const handleApprove = () => {
    setLastAction("Approve");
    setError(null);
    console.log("Approve action triggered");
  };

  const handleRevoke = () => {
    setLastAction("Revoke");
    setError(null);
    console.log("Revoke action triggered");
  };

  const handleComment = () => {
    setCommentText(comment); // Load existing comment into the textarea
    setCommentCategory(""); // Reset category selection
    setCommentSubcategory(""); // Reset subcategory selection
    setIsCommentDropdownOpen(false); // Reset dropdown state
    setIsCommentModalOpen(true);
  };

  const handleSaveComment = () => {
    if (!commentText.trim()) return;
    
    setComment(commentText);
    setIsCommentModalOpen(false);
    setCommentText("");
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
    setCommentSubcategory(""); // Reset subcategory when category changes
    setCommentText(""); // Clear text when category changes
  };

  const handleSubcategoryChange = (subcategory: string) => {
    setCommentSubcategory(subcategory);
    setCommentText(`${commentCategory} - ${subcategory}`);
  };


  // Fetch data from API (skipped for Continuous Compliance owner-inactive deep link)
  useEffect(() => {
    if (ccOwnerInactive) {
      setRowData([CC_OWNER_INACTIVE_ROW as any]);
      setLoading(false);
      setApiError(null);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setApiError(null);

        const response = await getCatalogEntitlements<any>(
          appInstanceId,
          reviewerId
        );

        // Debug: Log the API response to see what fields are available
        console.log("API Response:", response);
        console.log("Response items:", response.items);
        if (response.items && response.items.length > 0) {
          console.log("First item structure:", response.items[0]);
          console.log(
            "Available fields in first item:",
            Object.keys(response.items[0])
          );
        }

        // Transform API response to match the expected format
        const transformedData =
          response.items?.map((item: any) => {
            // Normalize snake_case and different APIs to the keys used by Applications sidebar
            const name =
              item.name ||
              item.entitlementName ||
              item.entitlementname ||
              "N/A";
            const description =
              item.description ||
              item.entitlementDescription ||
              item.details ||
              item.summary ||
              item.comment ||
              item.notes ||
              "N/A";
            const entType =
              item["Ent Type"] ||
              item.entitlementType ||
              item.entitlementtype ||
              item.type ||
              "N/A";
            const appName =
              item["App Name"] ||
              item.applicationName ||
              item.applicationname ||
              item.appName ||
              "N/A";
            const entOwner =
              item["Ent Owner"] ||
              item.entitlementOwner ||
              item.entitlementowner ||
              item.owner ||
              "N/A";
            const appOwner =
              item["App Owner"] ||
              item.applicationowner ||
              item.appOwner ||
              "N/A";
            const businessObjective =
              item["Business Objective"] ||
              item.businessObjective ||
              item.business_objective ||
              "N/A";
            const complianceType =
              item["Compliance Type"] ||
              item.complianceType ||
              item.regulatory_scope ||
              "N/A";
            const dataClassification =
              item["Data Classification"] || item.data_classification || "N/A";
            const businessUnit =
              item["Business Unit"] || item.businessunit_department || "N/A";
            const risk = item["Risk"] || item.risk || item.riskLevel || "N/A";
            const requestable =
              item.requestable ?? item["Requestable"] ? "Yes" : "No";
            const certifiable =
              item.certifiable ?? item["Certifiable"] ? "Yes" : "No";
            const lastReviewed =
              item["Last Reviewed on"] ||
              item.last_reviewed_on ||
              item.lastReviewedOn ||
              item.last_reviewed ||
              "N/A";
            const lastSync =
              item["Last Sync"] || item.last_sync || item.lastSync || "N/A";
            const createdOn =
              item["Created On"] ||
              item.created_on ||
              item.createdOn ||
              item.createdDate ||
              item.createddate ||
              "N/A";
            const reviewSchedule =
              item["Review Schedule"] ||
              item.review_schedule ||
              item.reviewSchedule ||
              "N/A";
            const accessScope =
              item["Access Scope"] ||
              item.access_scope ||
              item.accessScope ||
              "N/A";
            const dynamicTag =
              item["Dynamic Tag"] || item.tags || item.dynamicTag || "N/A";
            const revokeOnDisable =
              item["Revoke on Disable"] ??
              item.revoke_on_disable ??
              item.revokeOnDisable
                ? "Yes"
                : "No";
            const sharedPwd =
              item["Shared Pwd"] ?? item.shared_pwd ?? item.sharedPassword;
            const sharedPwdText =
              sharedPwd === true || sharedPwd === "true"
                ? "Yes"
                : sharedPwd === false || sharedPwd === "false"
                ? "No"
                : sharedPwd || "N/A";
            const mfaStatus =
              item["MFA Status"] || item.mfa_status || item.mfaStatus || "N/A";
            const hierarchy = item["Hierarchy"] || item.hierarchy || "N/A";
            const preReq = item["Pre- Requisite"] || item.prerequisite || "N/A";
            const preReqDetails =
              item["Pre-Requisite Details"] ||
              item.prerequisite_details ||
              item.prerequisiteDetails ||
              "N/A";
            const totalAssignments =
              item["Total Assignments"] ||
              item.totalAssignments ||
              item.assignmentCount ||
              item.totalassignmentstousers ||
              0;
            const assignment =
              item["assignment"] ||
              item.assignment ||
              item.assigned_to ||
              item.assignedTo ||
              "N/A";
            const licenseType =
              item["License Type"] || item.license_type || "N/A";
            const toxicCombination =
              item["SOD Check"] ||
              item.toxic_combination ||
              item.sodCheck ||
              "N/A";
            const provisionerGroup =
              item["Provisioner Group"] || item.provisioner_group || "N/A";
            const provisioningSteps =
              item["Provisioning Steps"] || item.provisioning_steps || "N/A";
            const provisioningMechanism =
              item["Provisioning Mechanism"] ||
              item.provisioning_mechanism ||
              "N/A";
            const autoAssignPolicy =
              item["Auto Assign Access Policy"] ||
              item.auto_assign_access_policy ||
              "N/A";
            const policyDefinition = item.policy_definition || undefined;
            const actionOnNativeChange =
              item["Action on Native Change"] ||
              item.action_on_native_change ||
              "N/A";
            const accountTypeRestriction =
              item["Account Type Restriction"] ||
              item.account_type_restriction ||
              "N/A";
            const nonPersistentAccess =
              item["Non Persistent Access"] ||
              item.non_persistent_access ||
              "N/A";
            const costCenter = item["Cost Center"] || item.cost_center || "N/A";
            const privileged = item["Privileged"] || item.privileged || "N/A";
            const auditComments =
              item["Audit Comments"] || item.audit_comments || "N/A";

            // Try to derive entitlementId from multiple places (including metadata JSON)
            let entitlementId = item.entitlementid || item.entitlementId;
            if (!entitlementId && typeof item.metadata === "string") {
              try {
                const meta = JSON.parse(item.metadata);
                entitlementId =
                  meta?.entitlementId || meta?.entitlementid || entitlementId;
              } catch {}
            }

            return {
              // Fields used by grid columns
              entitlementName: name,
              description,
              type: entType,
              risk,
              applicationName: appName,
              assignment,
              "Last Sync": lastSync,
              "Last Reviewed on": lastReviewed,
              "Total Assignments": totalAssignments,
              Requestable: requestable,
              Certifiable: certifiable,
              "SOD Check": toxicCombination,
              Hierarchy: hierarchy,
              "Pre- Requisite": preReq,
              "Pre-Requisite Details": preReqDetails,
              "Revoke on Disable": revokeOnDisable,
              "Shared Pwd": sharedPwdText,
              "Capability/Technical Scope": item.capabilityScope || "N/A",
              "Business Objective": businessObjective,
              "Compliance Type": complianceType,
              "Access Scope": accessScope,
              Reviewed: item.reviewed ? "Yes" : "No",
              "Dynamic Tag": Array.isArray(dynamicTag)
                ? dynamicTag.join(", ")
                : dynamicTag,
              "MFA Status": mfaStatus,
              "Review Schedule": reviewSchedule,
              "Ent Owner": entOwner,
              "App Owner": appOwner,
              "Created On": createdOn,
              Privileged: privileged,
              "Audit Comments": auditComments,
              // Additional fields used in Applications-style sidebar
              "Ent Name": name,
              "App Name": appName,
              "Ent Description": description,
              "Business Unit": businessUnit,
              "Data Classification": dataClassification,
              "Cost Center": costCenter,
              "License Type": licenseType,
              "Provisioner Group": provisionerGroup,
              "Provisioning Steps": provisioningSteps,
              "Provisioning Mechanism": provisioningMechanism,
              "Auto Assign Access Policy": autoAssignPolicy,
              "Action on Native Change": actionOnNativeChange,
              "Policy Definition": policyDefinition,
              "Account Type Restriction": accountTypeRestriction,
              "Non Persistent Access": nonPersistentAccess,
              // passthrough ids
              entitlementId,
              appInstanceId: item.appinstanceid || item.appInstanceId,
              catalogId: item.catalogid || item.catalogId,
            };
          }) || [];

        // Debug: Log the final transformed data
        console.log("Transformed data:", transformedData);
        if (transformedData.length > 0) {
          console.log("First transformed item:", transformedData[0]);
          console.log(
            "Description in first item:",
            transformedData[0].description
          );
        }

        // Force add some test data if no data is returned
        if (transformedData.length === 0) {
          console.log("No data returned, adding test data");
          const testData = [
            {
              entitlementName: "Test Entitlement 1",
              description:
                "This is a test description to verify the UI is working",
              type: "Test",
              risk: "Low",
              applicationName: "Test App",
              assignment: "Direct",
              "Last Sync": "2024-01-15",
              "Last Reviewed on": "2024-01-10",
              "Total Assignments": 5,
              Requestable: "Yes",
              Certifiable: "Yes",
              "SOD Check": "Passed",
              Hierarchy: "Level 1",
              "Pre- Requisite": "No",
              "Pre-Requisite Details": "None",
              "Revoke on Disable": "Yes",
              "Shared Pwd": "No",
              "Capability/Technical Scope": "Test Scope",
              "Business Objective": "Test Objective",
              "Compliance Type": "Test Compliance",
              "Access Scope": "Test Scope",
              Reviewed: "Yes",
              "Dynamic Tag": "Test",
              "MFA Status": "Required",
              "Review Schedule": "Monthly",
              "Ent Owner": "Test Owner",
              "Created On": "2024-01-01",
            },
            {
              entitlementName: "HIGH RISK Test Entitlement",
              description:
                "This is a HIGH RISK test entitlement that should have red background and be clickable",
              type: "High Risk Test",
              risk: "High",
              applicationName: "High Risk App",
              assignment: "Direct",
              "Last Sync": "2024-01-15",
              "Last Reviewed on": "2024-01-10",
              "Total Assignments": 2,
              Requestable: "No",
              Certifiable: "Yes",
              "SOD Check": "Failed",
              Hierarchy: "Level 3",
              "Pre- Requisite": "Yes",
              "Pre-Requisite Details": "Security Clearance Required",
              "Revoke on Disable": "Yes",
              "Shared Pwd": "No",
              "Capability/Technical Scope": "High Risk Scope",
              "Business Objective": "High Risk Objective",
              "Compliance Type": "SOX",
              "Access Scope": "Global",
              Reviewed: "No",
              "Dynamic Tag": "High Risk",
              "MFA Status": "Required",
              "Review Schedule": "Weekly",
              "Ent Owner": "Security Manager",
              "Created On": "2024-01-01",
            },
          ];
          setRowData(testData);
        } else {
          setRowData(transformedData);
        }
      } catch (error) {
        console.error("Error fetching catalog entitlements:", error);
        setApiError(
          error instanceof Error
            ? error.message
            : "Failed to fetch entitlements"
        );
        // Set fallback data in case of error
        const fallbackData = [
          {
            entitlementName: "Fallback Test Entitlement",
            description:
              "This is fallback test data to verify the UI works even when API fails",
            type: "Fallback",
            risk: "Medium",
            applicationName: "Fallback App",
            assignment: "Direct",
            "Last Sync": "2024-01-15",
            "Last Reviewed on": "2024-01-10",
            "Total Assignments": 3,
            Requestable: "Yes",
            Certifiable: "Yes",
            "SOD Check": "Passed",
            Hierarchy: "Level 2",
            "Pre- Requisite": "No",
            "Pre-Requisite Details": "None",
            "Revoke on Disable": "Yes",
            "Shared Pwd": "No",
            "Capability/Technical Scope": "Fallback Scope",
            "Business Objective": "Fallback Objective",
            "Compliance Type": "Fallback Compliance",
            "Access Scope": "Fallback Scope",
            Reviewed: "Yes",
            "Dynamic Tag": "Fallback",
            "MFA Status": "Required",
            "Review Schedule": "Monthly",
            "Ent Owner": "Fallback Owner",
            "Created On": "2024-01-01",
          },
        ];
        setRowData(fallbackData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [ccOwnerInactive, appInstanceId, reviewerId]);

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

  const handleRowClick = (event: any) => {
    const entitlementData = {
      entitlementName: event.data.entitlementName || "N/A",
      appName: event.data.applicationName || "N/A",
      appOwner: event.data["Ent Owner"] || "N/A",
      risk: event.data.risk || "N/A",
      totalAssignments: event.data["Total Assignments"] || 0,
      lastSync: event.data["Last Sync"] || "N/A",
      description: event.data["description"],
    };

    console.log("Row clicked - Entitlement data:", entitlementData);

    // Store entitlement data in localStorage for HeaderContent
    localStorage.setItem("entitlementDetails", JSON.stringify(entitlementData));

    // Dispatch custom event
    const customEvent = new CustomEvent("entitlementDataChange", {
      detail: entitlementData,
    });
    window.dispatchEvent(customEvent);
    console.log("Custom event dispatched from catalog page");
  };

  const handleHighRiskClick = (data: any) => {
    console.log("High-risk entitlement clicked:", data);

    const appNameForCheck = (data?.applicationName || data?.["App Name"] || "").toString();
    const isOciApp = appNameForCheck.toLowerCase().includes("oci");
    if (!isOciApp) {
      return;
    }

    // Set the high-risk data and open the sidebar only for OCI
    setHighRiskData(data);
    openSidebar(
      <PolicyRiskDetails entitlementData={{
        name: data.entitlementName || data.name || "N/A",
        description: data.description || "N/A",
        type: data.type || "N/A",
        applicationName: data.applicationName || "N/A",
        risk: data.risk || "N/A",
        lastReviewed: data["Last Reviewed on"] || "N/A",
        lastSync: data["Last Sync"] || "N/A",
        appInstanceId: data.appInstanceId,
        entitlementId: data.entitlementId,
      }} />,
      { widthPx: 500 }
    );

    // Close other sidebars if open
    closeSidebar();
  };


  const closeHighRiskSidebar = () => {
    closeSidebar();
    setHighRiskData(null);
  };


  const colDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "entitlementName",
        headerName: "Entitlement",
        width: 750,
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

          const riskVal = (params.data?.risk || "").toString().toLowerCase();
          const isHighRisk = riskVal === "high" || riskVal === "critical";

          return (
            <div className="flex items-center h-full">
              {isHighRisk ? (
                <span
                  className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm font-medium cursor-pointer hover:bg-red-200"
                  onClick={() => handleHighRiskClick(params.data)}
                >
                  {params.value}
                </span>
              ) : (
                <span className="font-semibold">{params.value}</span>
              )}
            </div>
          );
        },
      },
      // { field:"Ent Description", headerName:"Entitlement Description", flex:2},
      { field: "type", headerName: "Type", width: 130 },
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
      {
        field: "applicationName",
        headerName: "Application",
        width: 150,
        filter: "agTextColumnFilter",
        hide: true,
      },
      { field: "assignment", headerName: "Assignment", width: 150, hide: true },
      {
        field: "Last Sync",
        headerName: "Last Sync",
        width: 150,
        valueFormatter: (params: any) => formatDateMMDDYY(params.value),
      },
      {
        field: "Last Reviewed on",
        headerName: "Last Reviewed",
        width: 200,
        valueFormatter: (params: any) => formatDateMMDDYY(params.value),
      },
      {
        field: "Total Assignments",
        headerName: "Total Assignments",
        flex: 1.5,
        hide: true,
      },
      {
        field: "Requestable",
        headerName: "Requestable",
        width: 100,
        hide: true,
      },
      {
        field: "Certifiable",
        headerName: "Certifiable",
        width: 100,
        hide: true,
      },
      { field: "SOD Check", headerName: "SOD Check", flex: 1.5, hide: true },
      { field: "Hierarchy", headerName: "Hierarchy", width: 100, hide: true },
      {
        field: "Pre- Requisite",
        headerName: "Pre- Requisite",
        width: 100,
        hide: true,
      },
      {
        field: "Pre-Requisite Details",
        headerName: "Pre-Requisite Details",
        flex: 1.5,
        hide: true,
      },
      {
        field: "Revoke on Disable",
        headerName: "Revoke on Disable",
        flex: 1.5,
        hide: true,
      },
      { field: "Shared Pwd", headerName: "Shared Pwd", flex: 1.5, hide: true },
      {
        field: "Capability/Technical Scope",
        headerName: "Capability/Technical Scope",
        width: 100,
        hide: true,
      },
      {
        field: "Business Objective",
        headerName: "Busines Objective",
        flex: 1.5,
        hide: true,
      },
      {
        field: "Compliance Type",
        headerName: "Compliance Type",
        width: 100,
        hide: true,
      },
      {
        field: "Access Scope",
        headerName: "Access Scope",
        flex: 1.5,
        hide: true,
      },
      { field: "Reviewed", headerName: "Reviewed", width: 100, hide: true },
      {
        field: "Dynamic Tag",
        headerName: "Dynamic Tag",
        width: 100,
        hide: true,
      },
      { field: "MFA Status", headerName: "MFA Status", flex: 1.5, hide: true },
      {
        field: "Review Schedule",
        headerName: "Review Schedule",
        width: 100,
        hide: true,
      },
      {
        field: "Ent Owner",
        headerName: "Entitlement Owner",
        flex: 1.5,
        hide: true,
      },
      {
        field: "Created On",
        headerClass: "Created On",
        width: 100,
        hide: true,
      },
      {
        field: "actionColumn",
        headerName: "Action",
        width: 190,
        cellRenderer: (params: ICellRendererParams) => {
          return (
            <EditReassignButtons
              api={params.api}
              selectedRows={[params.data]}
              nodeData={params.data}
              reviewerId={reviewerId}
              certId="CERT_ID"
              context="entitlement"
            />
          );
        },
        suppressHeaderMenuButton: true,
        sortable: false,
        filter: false,
        resizable: false,
      },
    ],
    [reviewerId]
  );

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

          const riskVal = (params.data?.risk || "").toString().toLowerCase();
          const isHighRisk = riskVal === "high" || riskVal === "critical";

          return (
            <div className="flex items-center h-full">
              {isHighRisk ? (
                <span
                  className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm font-medium cursor-pointer hover:bg-red-200"
                  onClick={() => handleHighRiskClick(params.data)}
                >
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
      { field: "applicationName", headerName: "Application", width: 150 },
      { field: "Last Reviewed on", headerName: "Last Reviewed", width: 180 },
      {
        headerName: "Actions",
        width: 250,
        cellRenderer: (params: ICellRendererParams) => {
          return (
            <div className="flex space-x-4 h-full items-start">
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <button
                onClick={handleApprove}
                title="Approve"
                aria-label="Approve selected rows"
                className={`p-1 rounded transition-colors duration-200 ${
                  lastAction === "Approve"
                    ? "bg-green-500"
                    : "hover:bg-green-100"
                }`}
              >
                <CircleCheck
                  className="cursor-pointer"
                  color="#1c821cff"
                  strokeWidth="1"
                  size="32"
                  fill={lastAction === "Approve" ? "#1c821cff" : "none"}
                />
              </button>
              <button
                onClick={handleRevoke}
                title="Revoke"
                aria-label="Revoke selected rows"
                className={`p-1 rounded ${
                  params.data?.status === "Rejected" ? "bg-red-100" : ""
                }`}
              >
                <CircleX
                  className="cursor-pointer hover:opacity-80 transform rotate-90"
                  color="#FF2D55"
                  strokeWidth="1"
                  size="32"
                  fill={params.data?.status === "Rejected" ? "#FF2D55" : "none"}
                />
              </button>
              <button
                onClick={handleComment}
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
                  const InfoSidebar = () => {
                    const [sectionsOpen, setSectionsOpen] = useState({
                      general: true,
                      business: false,
                      technical: false,
                      security: false,
                      lifecycle: false,
                    });
                    const toggleSection = (key: keyof typeof sectionsOpen) =>
                      setSectionsOpen((s) => ({ ...s, [key]: !s[key] }));

                    const Field = ({
                      label,
                      value,
                      badgeClass,
                      full,
                    }: {
                      label: string;
                      value: any;
                      badgeClass?: string;
                      full?: boolean;
                    }) => (
                      <div className={full ? "col-span-2" : ""}>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                          {label}
                        </div>
                        {badgeClass ? (
                          <span
                            className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                          >
                            {value || "N/A"}
                          </span>
                        ) : (
                          <div className="mt-1 text-sm text-gray-800 break-words whitespace-pre-wrap">
                            {value === undefined || value === null || value === "" ? (
                              <span className="text-gray-400">N/A</span>
                            ) : (
                              value.toString()
                            )}
                          </div>
                        )}
                      </div>
                    );

                    const badgeStyles = (value: any) => {
                      const v = (value ?? "").toString().toLowerCase();
                      if (v.includes("high") || v.includes("critical"))
                        return "border-red-200 bg-red-50 text-red-700";
                      if (v.includes("medium"))
                        return "border-amber-200 bg-amber-50 text-amber-700";
                      if (v.includes("low"))
                        return "border-green-200 bg-green-50 text-green-700";
                      return "border-gray-200 bg-gray-50 text-gray-600";
                    };

                    const sections: Array<{
                      id: keyof typeof sectionsOpen;
                      label: string;
                      icon: typeof Info;
                    }> = [
                      { id: "general", label: "General", icon: Info },
                      { id: "business", label: "Business", icon: Briefcase },
                      { id: "technical", label: "Technical", icon: Cpu },
                      { id: "security", label: "Security", icon: ShieldCheck },
                      { id: "lifecycle", label: "Lifecycle", icon: RefreshCw },
                    ];

                    return (
                      <div className="flex flex-col gap-3">
                        {/* Summary card */}
                        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 shadow-sm">
                          <div className="text-base font-semibold text-gray-900 break-words">
                            {row?.["Ent Name"] ||
                              row?.entitlementName ||
                              row?.applicationName ||
                              "-"}
                          </div>
                          <p className="mt-1 text-sm text-gray-500 break-words whitespace-pre-wrap">
                            {row?.["Ent Description"] ||
                              row?.description ||
                              row?.details ||
                              "No description available"}
                          </p>
                          <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                            <button
                              onClick={handleApprove}
                              title="Approve"
                              aria-label="Approve entitlement"
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                lastAction === "Approve"
                                  ? "bg-green-600 text-white"
                                  : "border border-green-200 bg-white text-green-700 hover:bg-green-50"
                              }`}
                            >
                              <CircleCheck size={15} /> Approve
                            </button>
                            <button
                              onClick={handleRevoke}
                              title="Revoke"
                              aria-label="Revoke entitlement"
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                row?.status === "Rejected"
                                  ? "bg-red-600 text-white"
                                  : "border border-red-200 bg-white text-red-600 hover:bg-red-50"
                              }`}
                            >
                              <CircleX size={15} /> Revoke
                            </button>
                            <button
                              onClick={handleComment}
                              title="Comment"
                              aria-label="Add comment"
                              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                              <MessageSquare size={15} /> Comment
                            </button>
                          </div>
                        </div>

                        {/* Accordion sections */}
                        <div className="space-y-3">
                          {sections.map(({ id, label, icon: Icon }) => (
                            <div
                              key={id}
                              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                            >
                              <button
                                type="button"
                                onClick={() => toggleSection(id)}
                                className="flex w-full items-center justify-between gap-2 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100"
                              >
                                <span className="flex items-center gap-2">
                                  <Icon size={16} className="text-gray-500" />
                                  {label}
                                </span>
                                {sectionsOpen[id] ? (
                                  <ChevronDown size={18} className="text-gray-400" />
                                ) : (
                                  <ChevronRight size={18} className="text-gray-400" />
                                )}
                              </button>
                              {sectionsOpen[id] && (
                                <div className="grid grid-cols-2 gap-4 p-4">
                                  {id === "general" && (
                                    <>
                                      <Field label="Ent Type" value={row?.["Ent Type"] || row?.type} />
                                      <Field label="#Assignments" value={row?.["Total Assignments"]} />
                                      <Field
                                        label="App Name"
                                        value={row?.["App Name"] || row?.applicationName}
                                      />
                                      <Field label="Tag(s)" value={row?.["Dynamic Tag"]} />
                                    </>
                                  )}
                                  {id === "business" && (
                                    <>
                                      <Field full label="Objective" value={row?.["Business Objective"]} />
                                      <Field label="Business Unit" value={row?.["Business Unit"]} />
                                      <Field label="Business Owner" value={row?.["Ent Owner"]} />
                                      <Field full label="Regulatory Scope" value={row?.["Compliance Type"]} />
                                      <Field label="Data Classification" value={row?.["Data Classification"]} />
                                      <Field label="Cost Center" value={row?.["Cost Center"]} />
                                    </>
                                  )}
                                  {id === "technical" && (
                                    <>
                                      <Field label="Created On" value={row?.["Created On"]} />
                                      <Field label="Last Sync" value={row?.["Last Sync"]} />
                                      <Field
                                        label="App Name"
                                        value={row?.["App Name"] || row?.applicationName}
                                      />
                                      <Field label="App Instance" value={row?.["App Instance"]} />
                                      <Field label="App Owner" value={row?.["App Owner"]} />
                                      <Field label="Ent Owner" value={row?.["Ent Owner"]} />
                                      <Field label="Hierarchy" value={row?.["Hierarchy"]} />
                                      <Field label="MFA Status" value={row?.["MFA Status"]} />
                                      <Field full label="Assigned to/Member of" value={row?.["assignment"]} />
                                      <Field full label="License Type" value={row?.["License Type"]} />
                                    </>
                                  )}
                                  {id === "security" && (
                                    <>
                                      <Field
                                        label="Risk"
                                        value={row?.["Risk"] || row?.risk}
                                        badgeClass={badgeStyles(row?.["Risk"] || row?.risk)}
                                      />
                                      <Field label="Certifiable" value={row?.["Certifiable"]} />
                                      <Field label="Revoke on Disable" value={row?.["Revoke on Disable"]} />
                                      <Field label="Shared Pwd" value={row?.["Shared Pwd"]} />
                                      <Field full label="SoD/Toxic Combination" value={row?.["SOD Check"]} />
                                      <Field full label="Access Scope" value={row?.["Access Scope"]} />
                                      <Field label="Review Schedule" value={row?.["Review Schedule"]} />
                                      <Field label="Last Reviewed On" value={row?.["Last Reviewed on"]} />
                                      <Field label="Privileged" value={row?.["Privileged"]} />
                                      <Field label="Non Persistent Access" value={row?.["Non Persistent Access"]} />
                                      <Field full label="Audit Comments" value={row?.["Audit Comments"]} />
                                      <Field full label="Account Type Restriction" value={row?.["Account Type Restriction"]} />
                                    </>
                                  )}
                                  {id === "lifecycle" && (
                                    <>
                                      <Field label="Requestable" value={row?.["Requestable"]} />
                                      <Field label="Pre-Requisite" value={row?.["Pre- Requisite"]} />
                                      <Field full label="Pre-Req Details" value={row?.["Pre-Requisite Details"]} />
                                      <Field label="Auto Assign Access Policy" value={row?.["Auto Assign Access Policy"]} />
                                      <Field label="Provisioner Group" value={row?.["Provisioner Group"]} />
                                      <Field label="Provisioning Steps" value={row?.["Provisioning Steps"]} />
                                      <Field label="Provisioning Mechanism" value={row?.["Provisioning Mechanism"]} />
                                      <Field full label="Action on Native Change" value={row?.["Action on Native Change"]} />
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  };
                  
                  openSidebar(<InfoSidebar />, {
                    widthPx: 500,
                    title: "Entitlement Details",
                  });
                }}
                title="Info"
                className="cursor-pointer rounded-sm hover:opacity-80"
                aria-label="View details"
              >
                <ArrowRightCircle
                  color="#2563eb"
                  size="42"
                  className="transform scale-[0.6]"
                />
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
    []
  );

  const fitColumnsToGridWidth = (api: GridApi | null) => {
    if (!api) return;
    // Delay to let AG Grid finish DOM/layout calculations first.
    window.requestAnimationFrame(() => {
      try {
        api.sizeColumnsToFit();
      } catch {
        // Ignore transient sizing errors during initial mount/unmount.
      }
    });
  };

  const updatePaginationState = (api: GridApi | null) => {
    if (!api) return;
    const pageZeroBased = api.paginationGetCurrentPage?.() ?? 0;
    // Track totals by entitlements after app filter (not duplicated desc rows).
    const actualTotalItems = appFilteredEntitlements.length;
    const actualTotalPages = Math.ceil(actualTotalItems / pageSize);
    setCurrentPage(Math.max(1, pageZeroBased + 1));
    setTotalPages(Math.max(1, actualTotalPages));
    setTotalItems(actualTotalItems);
  };

  useEffect(() => {
    const actualTotalItems = appFilteredEntitlements.length;
    const actualTotalPages = Math.max(1, Math.ceil(actualTotalItems / pageSize));
    setTotalItems(actualTotalItems);
    setTotalPages(actualTotalPages);
    setCurrentPage((prev) => Math.min(prev, actualTotalPages));
  }, [appFilteredEntitlements, pageSize]);

  if (loading) {
    return (
      <div className="ag-theme-alpine" style={{ height: 600, width: "100%" }}>
        <div className="relative mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold pb-2 text-blue-950">Entitlements</h1>
        </div>
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
      <div className="ag-theme-alpine" style={{ height: 600, width: "100%" }}>
        <div className="relative mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold pb-2 text-blue-950">Entitlements</h1>
        </div>
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
    <div
      className="ag-theme-alpine"
      style={{ width: "100%" }}
    >
      <style jsx global>{`
        .ag-paging-panel { display: none !important; }
      `}</style>
      <div className="relative mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold pb-2 text-blue-950">Entitlements</h1>
          {ccOwnerInactive && (
            <p className="text-sm text-gray-600 -mt-1">
              Owner inactive — review required (Continuous Compliance).
            </p>
          )}
        </div>
        {!ccOwnerInactive && (
          <div className="flex items-center gap-3">
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
              className="border border-gray-300 rounded px-3 h-9 text-sm w-64"
            />
            <select
              value={selectedAppFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAppFilter(val);
                // App dropdown filtering is applied in React state to avoid
                // grid model shape mismatches across AG Grid versions.
                if (gridApi) {
                  gridApi.paginationGoToPage(0);
                  updatePaginationState(gridApi);
                }
              }}
              className="border border-gray-300 rounded px-3 h-9 text-sm w-64"
            >
              {applicationOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {/* Page size selector intentionally removed to match provided design */}
          </div>
        )}
      </div>
      {/* Top pagination - minimal gap to table */}
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
            setPageSize(newPageSize);
            if (gridApi) {
              gridApi.setGridOption("paginationPageSize", newPageSize);
              gridApi.paginationGoToPage(0);
              updatePaginationState(gridApi);
            }
          }}
          gridApi={gridApi as any}
        />
      </div>
      <div style={{ width: "100%" }}>
        <AgGridReact
          theme={themeQuartz}
          rowData={filteredRowData}
          columnDefs={entTabIndex === 0 ? colDefs : underReviewColDefs}
          defaultColDef={defaultColDef}
          animateRows={true}
          rowSelection="multiple"
          onRowClicked={handleRowClick}
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
            // Prevent stale persisted filters from hiding all rows on first render.
            params.api.setFilterModel(null);
            params.api.setGridOption("paginationPageSize", pageSize * 2);
            updatePaginationState(params.api);
            fitColumnsToGridWidth(params.api);
            params.api.addEventListener("paginationChanged", () => updatePaginationState(params.api));
            params.api.addEventListener("modelUpdated", () => updatePaginationState(params.api));
            params.api.addEventListener("filterChanged", () => updatePaginationState(params.api));
            params.api.addEventListener("sortChanged", () => updatePaginationState(params.api));
          }}
          onGridSizeChanged={(params: any) => {
            fitColumnsToGridWidth(params.api);
          }}
          onFirstDataRendered={(params: any) => {
            fitColumnsToGridWidth(params.api);
          }}
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
              if (gridApi) {
                gridApi.setGridOption("paginationPageSize", newPageSize * 2);
                gridApi.paginationGoToPage(0); // Go to first page when changing page size
                updatePaginationState(gridApi);
              }
            }
          }}
          gridApi={gridApi as any}
        />
      </div>

      {/* Global Right Sidebar used via openSidebar */}

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
    <Suspense
      fallback={<div className="p-4 text-sm text-gray-600">Loading…</div>}
    >
      <CatalogPageContent />
    </Suspense>
  );
}
