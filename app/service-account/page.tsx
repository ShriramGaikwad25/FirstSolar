"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
);
import {
  ColDef,
  GridApi,
  ICellRendererParams,
} from "ag-grid-enterprise";
import {
  ChevronDown,
  ChevronRight,
  Edit,
  ArrowRight,
} from "lucide-react";
import { formatDateMMDDYY } from "@/utils/utils";
import "@/lib/ag-grid-setup";
import Accordion from "@/components/Accordion";
import Exports from "@/components/agTable/Exports";
import CustomPagination from "@/components/agTable/CustomPagination";
import { useRightSidebar } from "@/contexts/RightSidebarContext";

interface DataItem {
  label: string;
  value: number;
  color?: string;
}

const dataAccount: Record<string, DataItem[]> = {
  accountSummary: [
    { label: "Regular Accounts", value: 0 },
    { label: "Elevated Accounts", value: 0 },
    { label: "Orphan Accounts", value: 0 },
    { label: "Terminated User Accounts", value: 0 },
  ],
  accountActivity: [
    { label: "Active in past 30 days", value: 0 },
    { label: "Dormant for past 30-60 days", value: 0 },
    { label: "Dormant for more than 90 days", value: 0 },
  ],
};

export default function ServiceAccountPage() {
  const { openSidebar, closeSidebar } = useRightSidebar();
  const [mounted, setMounted] = useState(false);
  const gridApiRef = useRef<GridApi | null>(null);
  const [selected, setSelected] = useState<{ [key: string]: number | null }>(
    {}
  );
  const [accountsRowData, setAccountsRowData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [nodeData, setNodeData] = useState<any>(null);

  // Wrapper function to handle page changes and close sidebar
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    closeSidebar();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Client-side pagination logic
  const totalItems = accountsRowData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = accountsRowData.slice(startIndex, endIndex);

  const handleSelect = (category: string, index: number) => {
    setSelected((prev) => ({
      ...prev,
      [category]: prev[category] === index ? null : index,
    }));
  };

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "accountName",
        headerName: "Account",
        flex: 2,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">{params.value || "-"}</span>
          </div>
        ),
      },
      {
        field: "entitlementName",
        headerName: "Entitlement",
        enableRowGroup: true,
        flex: 2,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">{params.value || "-"}</span>
          </div>
        ),
      },
      {
        field: "userManager",
        headerName: "Custodian",
        flex: 2,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">{params.value || params.data?.custodian || "-"}</span>
          </div>
        ),
      },
      {
        field: "lastlogindate",
        headerName: "Last Login",
        enableRowGroup: true,
        flex: 1.5,
        valueFormatter: (params: ICellRendererParams) =>
          params.value ? formatDateMMDDYY(params.value) : "-",
      },
      {
        field: "businessService",
        headerName: "Business Service",
        flex: 2,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">
              {params.value || params.data?.applicationName || params.data?.businessUnit || "-"}
            </span>
          </div>
        ),
      },
      {
        field: "__action__",
        headerName: "Action",
        width: 150,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex items-center gap-2 h-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              title="Edit"
              aria-label="Edit account"
              onClick={() => {
                const row = params?.data || {};
                const EditAccountSidebar = () => {
                  const [accountType, setAccountType] = useState("");
                  const [changeOwner, setChangeOwner] = useState(false);

                  // Assign Account Owner state (inline copy of modal content)
                  const [ownerType, setOwnerType] = useState<"User" | "Group">("User");
                  const [selectedAttribute, setSelectedAttribute] = useState<string>("username");
                  const [searchValue, setSearchValue] = useState("");
                  const [selectedItem, setSelectedItem] = useState<Record<string, string> | null>(null);

                  const users: Record<string, string>[] = [
                    { username: "john", email: "john@example.com", role: "admin" },
                    { username: "jane", email: "jane@example.com", role: "user" },
                  ];
                  const groups: Record<string, string>[] = [
                    { name: "admins", email: "admins@corp.com", role: "admin" },
                    { name: "devs", email: "devs@corp.com", role: "developer" },
                  ];
                  const userAttributes = [
                    { value: "username", label: "Username" },
                    { value: "email", label: "Email" },
                  ];
                  const groupAttributes = [
                    { value: "name", label: "Group Name" },
                    { value: "role", label: "Role" },
                  ];
                  const sourceData = ownerType === "User" ? users : groups;
                  const currentAttributes = ownerType === "User" ? userAttributes : groupAttributes;
                  const filteredData =
                    searchValue.trim() === ""
                      ? []
                      : sourceData.filter((item) => {
                          const value = item[selectedAttribute];
                          return value?.toLowerCase().includes(searchValue.toLowerCase());
                        });
                  
                  return (
                    <div className="flex flex-col h-full">
                      <div className="flex-1 overflow-y-auto p-3 space-y-4">
                        <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
                          <div className="text-sm text-gray-700 break-words">
                            {row.userDisplayName || "-"} → {row.accountName || "-"}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Select Account Type</label>
                          <select 
                            value={accountType}
                            onChange={(e) => setAccountType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value=""></option>
                            <option value="Regular">Regular</option>
                            <option value="Orphan">Orphan</option>
                            <option value="Service">Service</option>
                          </select>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-medium text-gray-700">Change Account Owner</span>
                          <span className="text-sm text-gray-900">No</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={changeOwner}
                              onChange={(e) => setChangeOwner(e.target.checked)}
                              className="sr-only peer" 
                            />
                            <div className="w-12 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-600"></div>
                          </label>
                          <span className="text-sm text-gray-900">Yes</span>
                        </div>
                        {changeOwner && (
                          <div className="mt-2">
                            <div className="flex mt-3 bg-gray-100 p-1 rounded-md">
                              {(["User", "Group"] as const).map((type) => (
                                <button
                                  key={type}
                                  className={`flex-1 py-2.5 px-3 text-sm font-medium transition-colors ${
                                    ownerType === type
                                      ? "bg-white text-[#15274E] border border-gray-300 shadow-sm relative z-10 rounded-md"
                                      : "bg-transparent text-gray-500 hover:text-gray-700 rounded-md"
                                  }`}
                                  onClick={() => {
                                    setOwnerType(type);
                                    const initialAttr = type === "User" ? userAttributes[0] : groupAttributes[0];
                                    setSelectedAttribute(initialAttr?.value || "");
                                    setSearchValue("");
                                    setSelectedItem(null);
                                  }}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Select Attribute</label>
                              <div className="relative">
                                <select
                                  value={selectedAttribute}
                                  onChange={(e) => setSelectedAttribute(e.target.value)}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 pr-8 appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  {currentAttributes.map((attr) => (
                                    <option key={attr.value} value={attr.value}>
                                      {attr.label}
                                    </option>
                                  ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Search Value</label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                                <input type="text" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className="w-full border border-gray-300 rounded-md pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Search" />
                              </div>
                            </div>
                            {searchValue.trim() !== "" && (
                              <div className="max-h-36 overflow-auto border rounded p-2 mt-3 text-sm bg-gray-50">
                                {filteredData.length === 0 ? (
                                  <p className="text-gray-500 italic">No results found.</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {filteredData.map((item, index) => (
                                      <li key={index} className={`p-2 border rounded cursor-pointer transition-colors ${selectedItem === item ? "bg-blue-100 border-blue-300" : "hover:bg-gray-100"}`} onClick={() => {
                                        setSelectedItem(item);
                                        setSearchValue(item[selectedAttribute]);
                                      }}>
                                        {Object.values(item).join(" | ")}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex justify-center items-center p-3 border-t border-gray-200 bg-gray-50 min-h-[60px]">
                        <button 
                          onClick={() => { 
                            // Handle save logic here
                            console.log("Save clicked", { accountType, changeOwner, selectedItem });
                          }} 
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                };
                
                openSidebar(<EditAccountSidebar />, { widthPx: 450 });
              }}
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const row = params?.data || {};
                const InfoSidebar = () => {
                  const [sectionsOpen, setSectionsOpen] = useState({
                    general: true,
                  });
                  const scrollContainerRef = useRef<HTMLDivElement>(null);

                  useEffect(() => {
                    if (scrollContainerRef.current) {
                      const style = document.createElement('style');
                      style.id = 'hide-scrollbar-style';
                      if (!document.getElementById('hide-scrollbar-style')) {
                        style.textContent = `
                          .sidebar-scroll-container::-webkit-scrollbar {
                            display: none;
                          }
                        `;
                        document.head.appendChild(style);
                      }
                    }
                  }, []);

                  return (
                    <div className="flex flex-col h-full">
                      <div 
                        ref={scrollContainerRef}
                        className="flex-1 overflow-y-auto sidebar-scroll-container"
                        style={{
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                        }}
                      >
                        {/* Header Section */}
                        <div className="p-4 border-b bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="mt-0">
                                <span className="text-xs uppercase text-gray-500">
                                  Account:
                                </span>
                                <div className="text-md font-medium break-words break-all whitespace-normal max-w-full">
                                  {row.accountName || "-"}
                                </div>
                              </div>
                              <div className="mt-2">
                                <span className="text-xs uppercase text-gray-500">
                                  Entitlement:
                                </span>
                                <div className="text-md font-medium break-words break-all whitespace-normal max-w-full">
                                  {row.entitlementName || "-"}
                                </div>
                              </div>
                              <div className="mt-2">
                                <span className="text-xs uppercase text-gray-500">
                                  Description:
                                </span>
                                <p className="text-sm text-gray-700 break-words break-all whitespace-pre-wrap max-w-full">
                                  {row.entitlementDescription || row.entitlement_description || row.description || "-"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* General Accordion Section */}
                        <div className="p-4 space-y-4">
                          <div className="bg-white border border-gray-200 rounded-md shadow-sm">
                            <button
                              className="flex items-center justify-between w-full text-left text-md font-semibold text-gray-800 p-3 bg-gray-50 rounded-t-md"
                              onClick={() =>
                                setSectionsOpen((s: any) => ({ ...s, general: !s.general }))
                              }
                            >
                              <span>General</span>
                              {sectionsOpen.general ? (
                                <ChevronDown size={20} />
                              ) : (
                                <ChevronRight size={20} />
                              )}
                            </button>
                            {sectionsOpen.general && (
                              <div className="p-4 space-y-4">
                                <div className="flex space-x-4">
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Custodian</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.userManager || row.custodian || "N/A"}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Last Login</label>
                                    <div className="text-sm text-gray-900 mt-1">
                                      {row.lastlogindate ? formatDateMMDDYY(row.lastlogindate) : "N/A"}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex space-x-4">
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Business Service</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.businessService || row.applicationName || row.businessUnit || "N/A"}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Environment</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.environment || "N/A"}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex space-x-4">
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Backup Owner</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.backupOwner || "N/A"}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">SME User</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.smeUser || row.sme_user || "N/A"}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex space-x-4">
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">PAM Policy</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.pamPolicy || "N/A"}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Rotation Policy</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.rotationPolicy || row.rotation_policy || "N/A"}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex space-x-4">
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Continuous Compliance</label>
                                    <div className="text-sm text-gray-900 mt-1">
                                      {row.continuousCompliance === true || row.continuousCompliance === "true" || row.continuousCompliance === "Y" || row.continuous_compliance === true ? "Yes" : "No"}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs uppercase text-gray-500 font-medium">Review Cycle</label>
                                    <div className="text-sm text-gray-900 mt-1 break-words">
                                      {row.reviewCycle || row.review_cycle || "N/A"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                };
                
                openSidebar(<InfoSidebar />, {
                  widthPx: 500,
                  title: "Service Account Details",
                });
              }}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              title="Info"
              aria-label="View account details"
            >
              <ArrowRight
                color="#55544dff"
                size={20}
                className="transform scale-[0.9]"
              />
            </button>
          </div>
        ),
      },
      {
        field: "backupOwner",
        headerName: "BackupOwner",
        flex: 2,
        hide: true,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">{params.value || "-"}</span>
          </div>
        ),
      },
      {
        field: "environment",
        headerName: "Environment",
        flex: 2,
        hide: true,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">{params.value || "-"}</span>
          </div>
        ),
      },
      {
        field: "pamPolicy",
        headerName: "PamPolicy",
        flex: 2,
        hide: true,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">{params.value || "-"}</span>
          </div>
        ),
      },
      {
        field: "rotationPolicy",
        headerName: "Rotation Policy",
        flex: 2,
        hide: true,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">{params.value || params.data?.rotation_policy || "-"}</span>
          </div>
        ),
      },
      {
        field: "smeUser",
        headerName: "SME User",
        flex: 2,
        hide: true,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">{params.value || params.data?.sme_user || "-"}</span>
          </div>
        ),
      },
      {
        field: "continuousCompliance",
        headerName: "Continuous Compliance",
        flex: 1.5,
        hide: true,
        cellRenderer: (params: ICellRendererParams) => {
          const isChecked = params.value === true || params.value === "true" || params.value === "Y" || params.data?.continuousCompliance === true || params.data?.continuous_compliance === true;
          return (
            <div className="flex items-center justify-center h-full">
              <input
                type="checkbox"
                checked={isChecked}
                readOnly
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
          );
        },
      },
      {
        field: "reviewCycle",
        headerName: "Review Cycle",
        flex: 2,
        hide: true,
        cellRenderer: (params: ICellRendererParams) => (
          <div className="flex flex-col gap-0">
            <span className="text-md text-gray-800">{params.value || params.data?.review_cycle || "-"}</span>
          </div>
        ),
      },
    ],
    []
  );

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
    }),
    []
  );

  // Fetch service accounts data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // You can replace this with your actual API endpoint for service accounts
        const response = await fetch(
          `https://preview.keyforge.ai/entities/api/v1/ACMECOM/getAppAccounts/430ea9e6-3cff-449c-a24e-59c057f81e3d/service-accounts`
        );
        const data = await response.json();
        console.log(data);
        if (data.executionStatus === "success") {
          setAccountsRowData(data.items || []);
        } else {
          // Add dummy data if API doesn't return success
          setAccountsRowData([
            {
              accountName: "svc-app-account-01",
              entitlementName: "Administrator Access",
              entitlementDescription: "Full administrative access to the production database system. This entitlement grants the ability to create, modify, and delete database objects, manage user permissions, and configure system settings.",
              description: "Service account for production database management with elevated privileges. Used for automated maintenance tasks and system administration.",
              userManager: "John Doe",
              lastlogindate: "2024-01-15",
              businessService: "Production Database",
              backupOwner: "Jane Smith",
              environment: "Production",
              pamPolicy: "Standard PAM Policy",
              rotationPolicy: "30 Days Rotation",
              smeUser: "admin@company.com",
              continuousCompliance: true,
              reviewCycle: "Quarterly",
            },
            {
              accountName: "svc-api-gateway-02",
              entitlementName: "Read-Only Access",
              entitlementDescription: "Read-only access to API gateway services and configuration. This entitlement allows viewing of API endpoints, monitoring metrics, and accessing logs without the ability to modify settings.",
              description: "Service account for API gateway monitoring and read-only operations. Used for automated monitoring, reporting, and analytics purposes.",
              userManager: "Mike Johnson",
              lastlogindate: "2024-01-20",
              businessService: "API Gateway Service",
              backupOwner: "Sarah Williams",
              environment: "Development",
              pamPolicy: "Basic PAM Policy",
              rotationPolicy: "60 Days Rotation",
              smeUser: "devops@company.com",
              continuousCompliance: false,
              reviewCycle: "Semi-Annual",
            },
          ]);
        }
      } catch (error) {
        console.error("Error fetching service accounts data:", error);
        // Add dummy data on error
        setAccountsRowData([
          {
            accountName: "svc-app-account-01",
            entitlementName: "Administrator Access",
            entitlementDescription: "Full administrative access to the production database system. This entitlement grants the ability to create, modify, and delete database objects, manage user permissions, and configure system settings.",
            description: "Service account for production database management with elevated privileges. Used for automated maintenance tasks and system administration.",
            userManager: "John Doe",
            lastlogindate: "2024-01-15",
            businessService: "Production Database",
            backupOwner: "Jane Smith",
            environment: "Production",
            pamPolicy: "Standard PAM Policy",
            rotationPolicy: "30 Days Rotation",
            smeUser: "admin@company.com",
            continuousCompliance: true,
            reviewCycle: "Quarterly",
          },
          {
            accountName: "svc-api-gateway-02",
            entitlementName: "Read-Only Access",
            entitlementDescription: "Read-only access to API gateway services and configuration. This entitlement allows viewing of API endpoints, monitoring metrics, and accessing logs without the ability to modify settings.",
            description: "Service account for API gateway monitoring and read-only operations. Used for automated monitoring, reporting, and analytics purposes.",
            userManager: "Mike Johnson",
            lastlogindate: "2024-01-20",
            businessService: "API Gateway Service",
            backupOwner: "Sarah Williams",
            environment: "Development",
            pamPolicy: "Basic PAM Policy",
            rotationPolicy: "60 Days Rotation",
            smeUser: "devops@company.com",
            continuousCompliance: false,
            reviewCycle: "Semi-Annual",
          },
        ]);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full py-8 px-4">
        <div
          className="ag-theme-alpine"
          style={{ width: "100%" }}
        >
          <div className="relative mb-2">
            <div className="flex items-center justify-between border-b border-gray-300 pb-2">
              <h1 className="text-2xl font-bold text-blue-950">Service Accounts</h1>
              <button
                onClick={() => openSidebar(null)}
                className="flex items-center space-x-2 px-3 py-2 bg-[#27B973] text-white rounded-md hover:bg-[#22a667] transition-all duration-200 text-sm font-medium"
                title="AI Assist Analysis"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <span>AI Assist</span>
              </button>
            </div>
            <Accordion
              iconClass="top-1 right-0 rounded-full text-white bg-purple-800"
              open={true}
            >
              <div className="p-2">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-base font-medium text-gray-800">
                    Filters
                  </h3>
                </div>
                <div className="space-y-3">
                  {/* First row - Account Summary (4 items) */}
                  <div className="flex">
                    {dataAccount.accountSummary.map((item, index) => (
                      <div
                        key={`accountSummary-${index}`}
                        className={`flex items-center justify-between py-2 px-3 rounded cursor-pointer transition-colors bg-white border border-gray-200 w-1/4 ${
                          selected.accountSummary === index
                            ? "bg-blue-100 border-blue-300"
                            : "bg-gray-100"
                        } ${item.color || ""}`}
                        onClick={() => handleSelect("accountSummary", index)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full border-2"
                            style={{
                              borderColor: "#6EC6FF",
                              backgroundColor:
                                selected.accountSummary === index
                                  ? "#6EC6FF"
                                  : "transparent",
                            }}
                          ></div>
                          <span
                            className={`text-sm ${
                              selected.accountSummary === index
                                ? "text-blue-900"
                                : "text-gray-700"
                            }`}
                          >
                            {item.label}
                          </span>
                        </div>
                        <span
                          className={`text-sm font-medium ${
                            selected.accountSummary === index
                              ? "text-blue-700 border-blue-300"
                              : "text-gray-900 border-gray-300"
                          } bg-white border px-2 py-1 rounded text-xs min-w-[20px] text-center`}
                        >
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Second row - Account Activity (3 items) */}
                  <div className="flex">
                    {dataAccount.accountActivity.map((item, index) => (
                      <div
                        key={`accountActivity-${index}`}
                        className={`flex items-center justify-between py-2 px-3 rounded cursor-pointer transition-colors bg-white border border-gray-200 w-1/4 ${
                          selected.accountActivity === index
                            ? "bg-blue-100 border-blue-300"
                            : "bg-gray-100"
                        } ${item.color || ""}`}
                        onClick={() => handleSelect("accountActivity", index)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full border-2"
                            style={{
                              borderColor: "#6EC6FF",
                              backgroundColor:
                                selected.accountActivity === index
                                  ? "#6EC6FF"
                                  : "transparent",
                            }}
                          ></div>
                          <span
                            className={`text-sm ${
                              selected.accountActivity === index
                                ? "text-blue-900"
                                : "text-gray-700"
                            }`}
                          >
                            {item.label}
                          </span>
                        </div>
                        <span
                          className={`text-sm font-medium ${
                            selected.accountActivity === index
                              ? "text-blue-700 border-blue-300"
                              : "text-gray-900 border-gray-300"
                          } bg-white border px-2 py-1 rounded text-xs min-w-[20px] text-center`}
                        >
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Accordion>
          </div>
          <div className="mb-2 relative z-10 pt-4">
            <div className="flex justify-end mb-2">
              <Exports gridApi={gridApiRef.current} />
            </div>
            <div className="flex justify-center">
              <CustomPagination
                totalItems={totalItems}
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={(newPageSize) => {
                  setPageSize(newPageSize);
                  setCurrentPage(1); // Reset to first page when changing page size
                  closeSidebar();
                }}
                pageSizeOptions={[10, 20, 50, 100]}
              />
            </div>
          </div>
          {mounted && (
            <AgGridReact
              rowData={paginatedData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              domLayout="autoHeight"
              onGridReady={(params) => {
                gridApiRef.current = params.api;
              }}
            />
          )}
          <div className="flex justify-center">
            <CustomPagination
              totalItems={totalItems}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={(newPageSize) => {
                setPageSize(newPageSize);
                setCurrentPage(1); // Reset to first page when changing page size
                closeSidebar();
              }}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

