"use client";

import React, { useState } from "react";
import type { ColDef } from "ag-grid-community";
import "@/lib/ag-grid-setup";
import { Link as LinkIcon } from "lucide-react";
import AgGridReact from "@/components/ClientOnlyAgGrid";
import { useRightSidebar } from "@/contexts/RightSidebarContext";

const dummyRows = [
  {
    id: "1",
    account: "johnd",
    identity: "",
    entitlement: "Sales Team Unique",
    lastLogin: "02/20/26",
    lastReview: "09/23/25",
    syncDate: "09/23/25",
  },
  {
    id: "2",
    account: "johnd",
    identity: "",
    entitlement: "Marketing Department Unique",
    lastLogin: "03/04/26",
    lastReview: "09/23/25",
    syncDate: "09/23/25",
  },
];

export default function UnlinkedAccountsPage() {
  const { openSidebar } = useRightSidebar();

  const columns: ColDef[] = [
    {
      headerName: "Account",
      field: "account",
      width: 140,
    },
    {
      headerName: "Identity",
      field: "identity",
      width: 220,
    },
    {
      headerName: "Entitlement",
      field: "entitlement",
      flex: 1,
      minWidth: 220,
    },
    {
      headerName: "Last Login",
      field: "lastLogin",
      width: 120,
    },
    {
      headerName: "Last Review",
      field: "lastReview",
      width: 120,
    },
    {
      headerName: "Sync Date",
      field: "syncDate",
      width: 120,
    },
    {
      headerName: "Action",
      field: "action",
      width: 80,
      cellRenderer: (params) => (
        <button
          type="button"
          className="flex items-center justify-center w-full h-full text-gray-600 hover:text-gray-900"
          title="Open Application / Account details"
          onClick={() => {
            const row = params?.data || {};
            const EditAccountSidebar = () => {
              const [accountType, setAccountType] = useState("");
              const [ownerType, setOwnerType] = useState<"User" | "Group">(
                "User"
              );
              const [selectedAttribute, setSelectedAttribute] =
                useState<string>("username");
              const [searchValue, setSearchValue] = useState("");
              const [selectedItem, setSelectedItem] =
                useState<Record<string, string> | null>(null);

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
              const currentAttributes =
                ownerType === "User" ? userAttributes : groupAttributes;
              const filteredData =
                searchValue.trim() === ""
                  ? []
                  : sourceData.filter((item) => {
                      const value = item[selectedAttribute];
                      return value
                        ?.toLowerCase()
                        .includes(searchValue.toLowerCase());
                    });

              return (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
                      <div className="text-sm text-gray-700 break-words">
                        {(row.identity || "-") + " \u2192 " + (row.account || "-")}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Account Type
                      </label>
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
                    {/* User / Group search - always visible (styled like Applications Account tab) */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 rounded-xl bg-gray-100 p-0.5">
                          <button
                            type="button"
                            onClick={() => setOwnerType("User")}
                            className={`px-3 py-2 rounded-lg text-sm font-medium ${
                              ownerType === "User"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "bg-transparent text-gray-500"
                            }`}
                          >
                            User
                          </button>
                          <button
                            type="button"
                            onClick={() => setOwnerType("Group")}
                            className={`px-3 py-2 rounded-lg text-sm font-medium ${
                              ownerType === "Group"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "bg-transparent text-gray-500"
                            }`}
                          >
                            Group
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Select Attribute
                            </label>
                            <select
                              value={selectedAttribute}
                              onChange={(e) =>
                                setSelectedAttribute(e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              {currentAttributes.map((attr) => (
                                <option key={attr.value} value={attr.value}>
                                  {attr.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Search Value
                            </label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                <svg
                                  className="h-4 w-4 text-gray-400"
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <circle cx="11" cy="11" r="8" />
                                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                              </span>
                              <input
                                type="text"
                                value={searchValue}
                                onChange={(e) =>
                                  setSearchValue(e.target.value)
                                }
                                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="Search"
                              />
                            </div>
                          </div>
                        </div>
                        {filteredData.length > 0 && (
                          <div className="border rounded-md max-h-48 overflow-y-auto">
                            <ul className="divide-y divide-gray-200">
                              {filteredData.map((item, idx) => (
                                <li
                                  key={idx}
                                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${
                                    selectedItem === item
                                      ? "bg-blue-50 text-blue-700"
                                      : ""
                                  }`}
                                  onClick={() => setSelectedItem(item)}
                                >
                                  {Object.values(item).join(" | ")}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                  </div>
                  <div className="flex-shrink-0 flex justify-center items-center p-3 border-t border-gray-200 bg-gray-50 min-h-[60px]">
                    <button
                      onClick={() => {
                        console.log("Save clicked", {
                          accountType,
                          selectedItem,
                        });
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
          <LinkIcon size={16} />
        </button>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f4f5f8] py-5 px-0 md:px-0">
      <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="ag-theme-alpine w-full">
          <AgGridReact
            rowData={dummyRows}
            columnDefs={columns}
            domLayout="autoHeight"
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              flex: 1,
            }}
            getRowId={(p) => p.data?.id}
          />
        </div>
      </div>
    </div>
  );
}

