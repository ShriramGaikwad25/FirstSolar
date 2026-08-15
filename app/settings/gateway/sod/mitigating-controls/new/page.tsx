"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { executeQuery } from "@/lib/api";
import { useSearchParams } from "next/navigation";

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

type PolicyJson = {
  Policy_ID?: string;
  Policy_Name?: string;
};

type PolicyOption = {
  id: string;
  name: string;
};

const SOD_MITIGATING_CONTROL_EDIT_STORAGE_KEY = "sodMitigatingControlEditDraft";

export default function SodMitigatingControlsNewPage() {
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("mode") === "edit";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [controlType, setControlType] = useState("");
  const [controlMethod, setControlMethod] = useState("");
  const [owner, setOwner] = useState("");

  const [ownerUsers, setOwnerUsers] = useState<
    Array<{ value: string; label: string; userName: string }>
  >([]);
  const [isOwnersLoading, setIsOwnersLoading] = useState(false);
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("");
  const ownerDropdownRef = useRef<HTMLDivElement | null>(null);

  const [policyOptions, setPolicyOptions] = useState<PolicyOption[]>([]);
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);
  const [policyDropdownOpen, setPolicyDropdownOpen] = useState(false);
  const [policyFilter, setPolicyFilter] = useState("");
  const policyDropdownRef = useRef<HTMLDivElement | null>(null);

  const canCreate =
    name.trim() &&
    description.trim() &&
    tags.trim() &&
    controlType.trim() &&
    controlMethod.trim() &&
    owner.trim() &&
    selectedPolicyIds.length > 0;

  useEffect(() => {
    if (!isEditMode) return;

    try {
      const stored = localStorage.getItem(SOD_MITIGATING_CONTROL_EDIT_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as Partial<{
        name: string;
        description: string;
        type: string;
        method: string;
        owner: string;
        applicablePolicyId: string;
        tags: string;
      }>;

      setName(parsed.name ?? "");
      setDescription(parsed.description ?? "");
      setControlType(parsed.type ?? "");
      setControlMethod(parsed.method ?? "");
      setOwner(parsed.owner ?? "");
      setTags(parsed.tags ?? "");

      const ids = (parsed.applicablePolicyId ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      setSelectedPolicyIds(ids);
    } catch (error) {
      console.error("Unable to load mitigating control edit draft:", error);
    }
  }, [isEditMode]);

  useEffect(() => {
    let cancelled = false;

    const loadOwnerUsers = async () => {
      try {
        setIsOwnersLoading(true);
        const payload = await executeQuery(
          "SELECT userid, username, firstname, lastname, displayname FROM usr ORDER BY username",
          []
        );

        const data: OwnerUserRow[] = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as any).resultSet)
            ? (payload as any).resultSet
            : Array.isArray((payload as any).rows)
              ? (payload as any).rows
              : [];
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
          .filter(
            (item): item is { value: string; label: string; userName: string } =>
              item !== null
          );

        if (!cancelled) setOwnerUsers(options);
      } catch {
        if (!cancelled) setOwnerUsers([]);
      } finally {
        if (!cancelled) setIsOwnersLoading(false);
      }
    };

    loadOwnerUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPolicies = async () => {
      try {
        const response = await fetch("/SODPolicy.json");
        if (!response.ok) {
          throw new Error(`Failed to load SODPolicy.json: ${response.status}`);
        }

        const json = (await response.json()) as PolicyJson[];
        if (cancelled) return;

        const seen = new Set<string>();
        const mapped = json
          .map((policy) => {
            const id = (policy.Policy_ID ?? "").trim();
            const policyName = (policy.Policy_Name ?? "").trim();
            if (!id || seen.has(id.toLowerCase())) return null;
            seen.add(id.toLowerCase());
            return { id, name: policyName || id };
          })
          .filter((item): item is PolicyOption => item !== null);

        setPolicyOptions(mapped);
      } catch {
        if (!cancelled) setPolicyOptions([]);
      }
    };

    loadPolicies();
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
      if (
        policyDropdownRef.current &&
        !policyDropdownRef.current.contains(event.target as Node)
      ) {
        setPolicyDropdownOpen(false);
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
    ownerUsers.find((user) => user.value === owner)?.label || owner;

  const visiblePolicies = useMemo(() => {
    const q = policyFilter.trim().toLowerCase();
    if (!q) return policyOptions;
    return policyOptions.filter(
      (policy) =>
        policy.id.toLowerCase().includes(q) ||
        policy.name.toLowerCase().includes(q)
    );
  }, [policyFilter, policyOptions]);

  const selectedPoliciesLabel = useMemo(() => {
    if (selectedPolicyIds.length === 0) return "";
    if (selectedPolicyIds.length === 1) {
      const selected = policyOptions.find((p) => p.id === selectedPolicyIds[0]);
      return selected ? `${selected.id} - ${selected.name}` : selectedPolicyIds[0];
    }
    return `${selectedPolicyIds.length} policies selected`;
  }, [policyOptions, selectedPolicyIds]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? "Edit Mitigating Control" : "Create Mitigating Control"}
          </h1>
          <button
            type="button"
            disabled={!canCreate}
            className={`px-4 py-2 rounded-md text-sm font-medium text-white ${
              canCreate
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {isEditMode ? "Update Mitigating Control" : "Create Mitigating Control"}
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter mitigating control name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={controlType}
                onChange={(e) => setControlType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select type</option>
                <option value="Preventive">Preventive</option>
                <option value="Detective">Detective</option>
                <option value="Corrective">Corrective</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="Short description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add tags"
              />
            </div>

            <div className="relative" ref={ownerDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">Owner</label>
              <button
                type="button"
                onClick={() => setOwnerDropdownOpen((prev) => !prev)}
                className="w-full h-[42px] px-3 py-2 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <span className={owner ? "text-gray-900 text-sm" : "text-gray-500 text-sm"}>
                  {owner
                    ? selectedOwnerLabel
                    : isOwnersLoading
                      ? "Loading users..."
                      : "Select owner"}
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
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
              <select
                value={controlMethod}
                onChange={(e) => setControlMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select method</option>
                <option value="Manual">Manual</option>
                <option value="Automated">Automated</option>
                <option value="Workflow">Workflow</option>
                <option value="Policy">Policy</option>
                <option value="Governance">Governance</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>

            <div className="relative" ref={policyDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Applicable Policy Id
              </label>
              <button
                type="button"
                onClick={() => setPolicyDropdownOpen((prev) => !prev)}
                className="w-full h-[42px] px-3 py-2 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <span
                  className={
                    selectedPolicyIds.length > 0 ? "text-gray-900 text-sm" : "text-gray-500 text-sm"
                  }
                >
                  {selectedPolicyIds.length > 0
                    ? selectedPoliciesLabel
                    : "Select one or more policies"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    policyDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {policyDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-gray-300 rounded-md shadow-lg">
                  <div className="p-2 border-b border-gray-200">
                    <input
                      type="text"
                      value={policyFilter}
                      onChange={(e) => setPolicyFilter(e.target.value)}
                      placeholder="Search policy"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="max-h-56 overflow-auto py-1">
                    {visiblePolicies.length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">No policy found</div>
                    )}
                    {visiblePolicies.map((policy) => (
                      <button
                        key={policy.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                          selectedPolicyIds.includes(policy.id) ? "bg-blue-50" : ""
                        }`}
                        onClick={() => {
                          setSelectedPolicyIds((prev) =>
                            prev.includes(policy.id)
                              ? prev.filter((id) => id !== policy.id)
                              : [...prev, policy.id]
                          );
                        }}
                      >
                        {policy.id} - {policy.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

