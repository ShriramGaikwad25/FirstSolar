"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { executeQuery } from "@/lib/api";
import { ChevronDown } from "lucide-react";
import "@/lib/ag-grid-setup";

type Item = {
  id: string;
  name: string;
};

interface OwnerUserRow {
  userid?: string;
  userId?: string;
  username?: string;
  userName?: string;
  firstname?: string;
  firstName?: string;
  lastname?: string;
  lastName?: string;
  displayname?: string;
  displayName?: string;
}

const INITIAL_RULES: Item[] = [
  { id: "R1", name: "Supplier Setup Access" },
  { id: "R2", name: "Invoice Processing Access" },
  { id: "R3", name: "Payment Release Access" },
  { id: "R4", name: "Revenue Order Access" },
  { id: "R5", name: "Credit Decision Access" },
  { id: "R6", name: "Directory Support Provisioning Access" },
  { id: "R7", name: "Privileged Directory Administration Access" },
  { id: "R8", name: "Access Assignment Access" },
  { id: "R9", name: "Access Approval Authority" },
  { id: "R10", name: "Recruiting Operations Access" },
  { id: "R11", name: "Worker Termination and HR Maintenance Access" },
  { id: "R12", name: "Payroll Administration Access" },
  { id: "R13", name: "HCM Platform Administration and Data Movement Access" },
];

const SOD_BP_EDIT_STORAGE_KEY = "sodBusinessProcessEditDraft";

export default function SodBusinessProcessNewPage() {
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("mode") === "edit";

  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [ownerUsers, setOwnerUsers] = useState<
    Array<{ value: string; label: string; userName: string }>
  >([]);
  const [isOwnersLoading, setIsOwnersLoading] = useState(false);
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("");
  const ownerDropdownRef = useRef<HTMLDivElement | null>(null);
  const [ownersError, setOwnersError] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");

  const [availableRules, setAvailableRules] = useState<Item[]>(INITIAL_RULES);
  const [selectedRules, setSelectedRules] = useState<Item[]>([]);
  const [availableRuleId, setAvailableRuleId] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [ruleSearch, setRuleSearch] = useState("");

  useEffect(() => {
    if (!isEditMode) return;

    try {
      const stored = localStorage.getItem(SOD_BP_EDIT_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as {
        name?: string;
        owner?: string;
        tags?: string;
        description?: string;
      };
      setName(parsed.name ?? "");
      setOwner(parsed.owner ?? "");
      setTags(parsed.tags ?? "");
      setDescription(parsed.description ?? "");
    } catch (error) {
      console.error("Unable to load business process edit draft:", error);
    }
  }, [isEditMode]);

  useEffect(() => {
    let cancelled = false;

    const loadOwners = async () => {
      try {
        setIsOwnersLoading(true);
        setOwnersError(null);

        const query =
          "SELECT userid, username, firstname, lastname, displayname FROM usr ORDER BY username";
        const parameters: string[] = [];
        const payload = await executeQuery(query, parameters);

        const data: OwnerUserRow[] = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as any).resultSet)
            ? (payload as any).resultSet
            : Array.isArray((payload as any).rows)
              ? (payload as any).rows
              : [];

        if (cancelled) return;

        const seen = new Set<string>();
        const options = data
          .map((u) => {
            const userName = (u.userName ?? u.username ?? "").trim();
            const userId = (u.userId ?? u.userid ?? "").trim();
            if (!userName || !userId || seen.has(userId.toLowerCase())) return null;

            seen.add(userId.toLowerCase());
            const displayName = (u.displayName ?? u.displayname ?? "").trim();
            const fullName = `${u.firstName ?? u.firstname ?? ""} ${u.lastName ?? u.lastname ?? ""}`.trim();
            const labelBase = displayName || fullName || userName;

            return {
              value: userId,
              userName,
              label: labelBase === userName ? userName : `${labelBase} (${userName})`,
            };
          })
          .filter(Boolean);

        setOwnerUsers(options as Array<{ value: string; label: string; userName: string }>);
      } catch (error) {
        setOwnersError("Failed to load owners");
      } finally {
        if (!cancelled) setIsOwnersLoading(false);
      }
    };

    loadOwners();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        ownerDropdownRef.current &&
        !ownerDropdownRef.current.contains(event.target as Node)
      ) {
        setOwnerDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const visibleOwnerUsers = useMemo(() => {
    const q = ownerFilter.trim().toLowerCase();
    if (!q) return ownerUsers;
    return ownerUsers.filter(
      (user) =>
        user.label.toLowerCase().includes(q) ||
        user.userName.toLowerCase().includes(q) ||
        user.value.toLowerCase().includes(q)
    );
  }, [ownerUsers, ownerFilter]);

  const selectedOwnerLabel =
    ownerUsers.find((user) => user.value === owner)?.label ||
    owner;

  const moveItems = (
    from: Item[],
    to: Item[],
    setFrom: React.Dispatch<React.SetStateAction<Item[]>>,
    setTo: React.Dispatch<React.SetStateAction<Item[]>>,
    id: string | null,
    clearId: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    if (!id) return;
    const itemToMove = from.find(i => i.id === id);
    if (!itemToMove) return;
    const remaining = from.filter(i => i.id !== id);
    setFrom(remaining);
    setTo([...to, itemToMove]);
    clearId(null);
  };

  const filteredAvailableRules = useMemo(
    () =>
      !ruleSearch.trim()
        ? availableRules
        : availableRules.filter(r =>
            r.name.toLowerCase().includes(ruleSearch.trim().toLowerCase())
          ),
    [availableRules, ruleSearch]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full">
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? "Edit Business Process" : "Create Business Process"}
            </h1>
            <button
              type="button"
              className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              {isEditMode ? "Update Business Process" : "Create Business Process"}
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter business process name"
                  />
                </div>
                <div className="relative" ref={ownerDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Owner
                  </label>
                  <button
                    type="button"
                    onClick={() => setOwnerDropdownOpen((prev) => !prev)}
                    className="w-full h-[42px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left flex items-center justify-between"
                  >
                    <span className={owner ? "text-gray-900" : "text-gray-500"}>
                      {owner
                        ? selectedOwnerLabel
                        : isOwnersLoading
                          ? "Loading users..."
                          : ""}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-500 transition-transform ${
                        ownerDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {ownerDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-gray-300 rounded-md shadow-lg">
                      <div className="p-2 border-b border-gray-200">
                        <input
                          type="text"
                          value={ownerFilter}
                          onChange={(e) => setOwnerFilter(e.target.value)}
                          placeholder="Search user"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="max-h-56 overflow-auto py-1">
                        {owner &&
                          !ownerUsers.some((user) => user.value === owner) && (
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 bg-blue-50/40"
                              onClick={() => {
                                setOwnerDropdownOpen(false);
                              }}
                            >
                              {owner}
                            </button>
                          )}

                        {isOwnersLoading && (
                          <div className="px-3 py-2 text-sm text-gray-500">Loading users...</div>
                        )}

                        {!isOwnersLoading && visibleOwnerUsers.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">No users found</div>
                        )}

                        {!isOwnersLoading &&
                          visibleOwnerUsers.map((user) => (
                            <button
                              key={user.value}
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                                owner === user.value ? "bg-blue-50" : ""
                              }`}
                              onClick={() => {
                                setOwner(user.value);
                                setOwnerDropdownOpen(false);
                                setOwnerFilter("");
                              }}
                            >
                              {user.label}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                  {ownersError && <p className="mt-1 text-xs text-red-600">{ownersError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add tags"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  placeholder="Short description"
                />
              </div>

              <div className="w-full">
                {/* Rules dual list */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Rules
                  </label>
                  <div className="grid grid-cols-[minmax(0,1.6fr)_auto_minmax(0,1.6fr)] gap-3 items-stretch">
                    {/* Available rules */}
                    <div className="border border-gray-200 rounded-lg bg-white flex flex-col h-[280px] shadow-sm">
                      <div className="px-3 py-2 border-b border-gray-200 space-y-2">
                        <h3 className="text-sm font-semibold text-gray-800">Available Rules</h3>
                        <input
                          type="text"
                          value={ruleSearch}
                          onChange={e => setRuleSearch(e.target.value)}
                          placeholder="Search rules..."
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {filteredAvailableRules.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-gray-500">No available rules.</p>
                        ) : (
                          <ul className="divide-y divide-gray-100">
                            {filteredAvailableRules.map(item => (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAvailableRuleId(prev => (prev === item.id ? null : item.id))
                                  }
                                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                    availableRuleId === item.id
                                      ? "bg-blue-50 text-blue-700"
                                      : "hover:bg-slate-50"
                                  }`}
                                >
                                  {item.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Move buttons */}
                    <div className="flex flex-col items-stretch justify-center gap-2 px-1">
                      <button
                        type="button"
                        onClick={() =>
                          moveItems(
                            availableRules,
                            selectedRules,
                            setAvailableRules,
                            setSelectedRules,
                            availableRuleId,
                            setAvailableRuleId
                          )
                        }
                        disabled={!availableRuleId}
                        className={`w-24 text-center px-3 py-1.5 rounded-md text-[11px] font-medium border ${
                          availableRuleId
                            ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                            : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        }`}
                      >
                        Add →
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          moveItems(
                            selectedRules,
                            availableRules,
                            setSelectedRules,
                            setAvailableRules,
                            selectedRuleId,
                            setSelectedRuleId
                          )
                        }
                        disabled={!selectedRuleId}
                        className={`w-24 text-center px-3 py-1.5 rounded-md text-[11px] font-medium border ${
                          selectedRuleId
                            ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                            : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        }`}
                      >
                        ← Remove
                      </button>
                    </div>

                    {/* Selected rules */}
                    <div className="border border-gray-200 rounded-lg bg-white flex flex-col h-[280px] shadow-sm">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-800">Selected Rules</h3>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {selectedRules.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-gray-500">No rules selected.</p>
                        ) : (
                          <ul className="divide-y divide-gray-100">
                            {selectedRules.map(item => (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedRuleId(prev => (prev === item.id ? null : item.id))
                                  }
                                  className={`w-full text-left px-3 py-2 text-sm border-l-2 transition-colors ${
                                    selectedRuleId === item.id
                                      ? "bg-blue-50 border-blue-500 text-blue-700"
                                      : "border-transparent hover:bg-slate-50"
                                  }`}
                                >
                                  {item.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

