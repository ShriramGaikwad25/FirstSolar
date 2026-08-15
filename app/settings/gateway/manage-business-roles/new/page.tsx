"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Check, ChevronDown, Printer, Eye } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";
import { useCart } from "@/contexts/CartContext";
import SelectAccessTab from "@/app/access-request/SelectAccessTab";

const BUSINESS_ROLE_VIEW_STORAGE_KEY = "businessRoleViewDraft";

interface Step1Data {
  roleName: string;
  roleCode: string;
  description: string;
  owner: string;
  tags: string[];
}

interface FormData {
  step1: Step1Data;
}

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

export default function NewBusinessRoleWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isVisible: isSidebarVisible, sidebarWidthPx } = useLeftSidebar();
  const { items: cartItems, clearCart } = useCart();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [preselectedAccessIds, setPreselectedAccessIds] = useState<string[]>([]);
  const [ownerUsers, setOwnerUsers] = useState<
    Array<{ value: string; label: string; userName: string }>
  >([]);
  const [isOwnersLoading, setIsOwnersLoading] = useState(false);
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("");
  const ownerDropdownRef = useRef<HTMLDivElement | null>(null);
  const [tagInput, setTagInput] = useState("");

  const [formData, setFormData] = useState<FormData>({
    step1: {
      roleName: "",
      roleCode: "",
      description: "",
      owner: "",
      tags: [],
    },
  });

  useEffect(() => {
    const controller = new AbortController();

    const loadOwnerUsers = async () => {
      try {
        setIsOwnersLoading(true);
        const res = await fetch(
          "https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              query:
                "SELECT userid, username, firstname, lastname, displayname FROM usr ORDER BY username",
              parameters: [],
            }),
          },
        );
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);

        const payload = await res.json();
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
              item !== null,
          );

        setOwnerUsers(options);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          setOwnerUsers([]);
        }
      } finally {
        setIsOwnersLoading(false);
      }
    };

    loadOwnerUsers();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode !== "edit") return;

    const roleName = searchParams.get("roleName") ?? "";
    const roleCode = searchParams.get("roleCode") ?? "";
    const description = searchParams.get("description") ?? "";
    const owner = searchParams.get("ownerId") ?? searchParams.get("owner") ?? "";
    const tags = (searchParams.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const selectedIdsParam = searchParams.get("selectedAccessIds") ?? "";
    const selectedIds =
      selectedIdsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) || [];

    setFormData({
      step1: {
        roleName,
        roleCode,
        description,
        owner,
        tags,
      },
    });
    setPreselectedAccessIds(selectedIds);
  }, [searchParams]);

  // Catalog state for Select Access (same as Access Request step 2)
  const [catalogData, setCatalogData] = useState<any[]>([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [selectedAppInstanceId, setSelectedAppInstanceId] = useState<string | null>(null);
  const [showApplicationInstancesOnly, setShowApplicationInstancesOnly] = useState(false);
  const [applicationInstances, setApplicationInstances] = useState<Array<{ id: string; name: string }>>([]);
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<string>("All");
  const [tagFilter, setTagFilter] = useState<string>("");
  const catalogFetchKeyRef = useRef<string | null>(null);
  const catalogPageRef = useRef(catalogPage);

  const steps = [
    { id: 1, title: "Business Role Details" },
    { id: 2, title: "Select Access" },
    { id: 3, title: "Review & Submit" },
  ];
  const isEditMode = searchParams.get("mode") === "edit";
  const businessRoleId = searchParams.get("businessRoleId") ?? "";

  const canGoNextFromStep1 =
    formData.step1.roleName.trim() !== "" &&
    formData.step1.roleCode.trim() !== "" &&
    formData.step1.description.trim() !== "" &&
    formData.step1.owner.trim() !== "";

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

  const visibleOwnerUsers = React.useMemo(() => {
    const q = ownerFilter.trim().toLowerCase();
    if (!q) return ownerUsers;
    return ownerUsers.filter(
      (user) =>
        user.label.toLowerCase().includes(q) ||
        user.userName.toLowerCase().includes(q) ||
        user.value.toLowerCase().includes(q),
    );
  }, [ownerUsers, ownerFilter]);

  const selectedOwnerLabel =
    ownerUsers.find((user) => user.value === formData.step1.owner)?.label ||
    formData.step1.owner;

  const selectedOwnerUserName =
    ownerUsers.find((user) => user.value === formData.step1.owner)?.userName || "";

  const addTag = (rawTag: string) => {
    const nextTag = rawTag.trim();
    if (!nextTag) return;

    setFormData((prev) => {
      const alreadyExists = prev.step1.tags.some(
        (tag) => tag.toLowerCase() === nextTag.toLowerCase(),
      );
      if (alreadyExists) return prev;

      return {
        ...prev,
        step1: {
          ...prev.step1,
          tags: [...prev.step1.tags, nextTag],
        },
      };
    });
  };

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      step1: {
        ...prev.step1,
        tags: prev.step1.tags.filter((tag) => tag !== tagToRemove),
      },
    }));
  };

  const canGoNextFromStep2 = true;

  const canGoNext =
    (currentStep === 1 && canGoNextFromStep1) ||
    (currentStep === 2 && canGoNextFromStep2);

  const handleNext = () => {
    if (currentStep < 3 && canGoNext) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        ...(isEditMode && businessRoleId.trim()
          ? { businessRoleId: businessRoleId.trim() }
          : {}),
        roleName: formData.step1.roleName.trim(),
        roleCode: formData.step1.roleCode.trim(),
        description: formData.step1.description.trim(),
        ownerId: formData.step1.owner.trim(),
        status: "Active",
        attributes: {},
        tags: formData.step1.tags,
        catalogItems: cartItems.map((item, index) => ({
          catalogId: item.id,
          order: index + 1,
          attributes: {},
        })),
      };

      const response = await fetch(
        "https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "SELECT kf_br_upsert_role_with_accesses(p_payload => ?::jsonb)",
            parameters: [payload],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `${isEditMode ? "Update" : "Create"} business role failed: ${response.status}`,
        );
      }

      clearCart();
      router.push("/settings/gateway/manage-business-roles");
    } catch (error) {
      console.error(
        `Failed to ${isEditMode ? "update" : "create"} business role:`,
        error,
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Clear selected access when leaving this wizard
  useEffect(() => {
    return () => {
      clearCart();
    };
  }, [clearCart]);

  // Keep catalog page ref in sync
  catalogPageRef.current = catalogPage;

  // Transform catalog rows into roles for SelectAccessTab
  const apiRoles = React.useMemo(() => {
    if (!catalogData || catalogData.length === 0) return [];
    const firstRow = catalogData[0] || {};
    const keys = Object.keys(firstRow);

    const findKey = (predicates: ((k: string) => boolean)[]): string | undefined => {
      const lowerKeys = keys.map((k) => k.toLowerCase());
      for (const predicate of predicates) {
        const idx = lowerKeys.findIndex(predicate);
        if (idx !== -1) return keys[idx];
      }
      return undefined;
    };

    const nameKey =
      findKey([
        (k) => k === "name",
        (k) => k === "entitlementname",
        (k) => k === "entitlement_name",
        (k) => k === "applicationname",
      ]) || keys[0];

    const riskKey =
      findKey([
        (k) => k === "risk",
        (k) => k.endsWith("_risk"),
        (k) => k.includes("risk"),
      ]) || keys[1] || keys[0];

    const descriptionKey =
      findKey([
        (k) => k === "description",
        (k) => k === "entitlementdescription",
        (k) => k === "entitlement_description",
        (k) => k === "business_objective",
      ]) || keys[2] || keys[0];

    const idKeysPreference = ["catalogid", "entitlementid", "appinstanceid", "id"];

    const resolveIdKey = (): string | undefined => {
      const lowerKeys = keys.map((k) => k.toLowerCase());
      for (const pref of idKeysPreference) {
        const idx = lowerKeys.indexOf(pref);
        if (idx !== -1) return keys[idx];
      }
      return undefined;
    };

    const idKey = resolveIdKey();

    const normalizeRisk = (value: string): "Low" | "Medium" | "High" => {
      const v = value.toLowerCase();
      if (v.startsWith("high")) return "High";
      if (v.startsWith("medium")) return "Medium";
      if (v.startsWith("low")) return "Low";
      return "Low";
    };

    return catalogData.map((row, idx) => {
      const rawName =
        row[nameKey] !== undefined && row[nameKey] !== null ? String(row[nameKey]) : "";
      const rawRisk =
        row[riskKey] !== undefined && row[riskKey] !== null ? String(row[riskKey]) : "";
      const rawDesc =
        row[descriptionKey] !== undefined && row[descriptionKey] !== null
          ? String(row[descriptionKey])
          : "";

      const idValue =
        (idKey && row[idKey]) ||
        row.catalogid ||
        row.entitlementid ||
        row.appinstanceid ||
        idx;

      return {
        id: String(idValue).trim(),
        name: rawName || "Unnamed access",
        risk: normalizeRisk(rawRisk),
        description: rawDesc,
        catalogRow: row,
      };
    });
  }, [catalogData]);

  // Load application instances when on step 2
  useEffect(() => {
    if (currentStep !== 2) return;
    const url = "https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery";
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query:
          "SELECT appinstanceid, name FROM vw_catalog WHERE type = 'ApplicationInstance' ORDER BY name",
        parameters: [],
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`${res.status}`))))
      .then((data) => {
        let rows: any[] = [];
        if (Array.isArray(data)) rows = data;
        else if (Array.isArray((data as any).resultSet)) rows = (data as any).resultSet;
        else if (Array.isArray((data as any).rows)) rows = (data as any).rows;
        const seen = new Set<string>();
        const list: Array<{ id: string; name: string }> = [];
        rows.forEach((r: any) => {
          const id = (r.appinstanceid ?? r.appInstanceId ?? r.app_instance_id ?? "")
            .toString()
            .trim();
          const name = (r.name ?? "").toString().trim();
          if (id && !seen.has(id)) {
            seen.add(id);
            list.push({ id, name: name || id });
          }
        });
        setApplicationInstances(list);
      })
      .catch(() => setApplicationInstances([]));
  }, [currentStep]);

  // Load catalog data in step 2
  useEffect(() => {
    if (currentStep !== 2) return;

    const fetchKey = `2-${catalogPage}-${selectedAppInstanceId ?? "all"}-${showApplicationInstancesOnly}-${catalogTypeFilter}-${tagFilter || "all"}`;
    if (catalogFetchKeyRef.current === fetchKey) return;
    catalogFetchKeyRef.current = fetchKey;

    const pageRequested = catalogPage;

    const limit = 100;
    const offset = (catalogPage - 1) * limit;

    const isFilteredByAppInstance = !!selectedAppInstanceId?.trim() && !showApplicationInstancesOnly;
    const trimmedTag = tagFilter.trim();

    const body =
      showApplicationInstancesOnly
        ? {
            query:
              "SELECT * FROM vw_catalog WHERE type = 'ApplicationInstance' ORDER BY appinstanceid LIMIT ? OFFSET ?",
            parameters: [limit, offset],
          }
        : catalogTypeFilter === "Tags"
          ? {
              query:
                trimmedTag
                  ? `SELECT * FROM vw_catalog WHERE type = 'Entitlement' AND tags ILIKE '%${trimmedTag}%' ORDER BY appinstanceid LIMIT ? OFFSET ?`
                  : "SELECT * FROM vw_catalog WHERE type = 'Entitlement' ORDER BY appinstanceid LIMIT ? OFFSET ?",
              parameters: [limit, offset],
            }
          : isFilteredByAppInstance
            ? {
                query:
                  "SELECT * FROM vw_catalog WHERE type = 'Entitlement' AND appinstanceid = ?::uuid ORDER BY appinstanceid LIMIT ? OFFSET ?",
                parameters: [selectedAppInstanceId!.trim(), limit, offset],
              }
            : {
                query: "SELECT * FROM vw_catalog ORDER BY appinstanceid LIMIT ? OFFSET ?",
                parameters: [limit, offset],
              };

    fetch("https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (catalogPageRef.current !== pageRequested) return;
        let rows: any[] = [];
        if (Array.isArray(data)) rows = data;
        else if (Array.isArray((data as any).resultSet)) rows = (data as any).resultSet;
        else if (Array.isArray((data as any).rows)) rows = (data as any).rows;
        setCatalogData(rows);
      })
      .catch(() => {
        if (catalogPageRef.current !== pageRequested) return;
        setCatalogData([]);
      })
      .finally(() => {
        if (catalogPageRef.current === pageRequested) {
          catalogFetchKeyRef.current = null;
        }
      });
  }, [
    currentStep,
    catalogPage,
    selectedAppInstanceId,
    showApplicationInstancesOnly,
    catalogTypeFilter,
    tagFilter,
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed step bar below header; aligned with content area */}
      <div
        className="fixed top-[60px] z-20 bg-white border-b border-gray-200 shadow-sm px-6 py-4"
        style={{
          left: isSidebarVisible ? sidebarWidthPx : 0,
          right: 0,
          transition: "left 300ms ease-in-out",
        }}
      >
        <div className="flex items-center gap-4 max-w-full">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium shrink-0 ${
              currentStep === 1
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </button>

          <div className="flex-1 flex items-center min-w-0">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border shrink-0 ${
                      currentStep >= step.id
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className="ml-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className="flex-1 h-0.5 bg-gray-200 mx-4 min-w-[16px]"
                    aria-hidden
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="shrink-0">
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canGoNext}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                  !canGoNext
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-60"
              >
                {submitting ? (
                  isEditMode ? "Updating..." : "Submitting..."
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {isEditMode ? "Update" : "Submit"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spacer so content is not hidden under fixed step bar */}
      <div className="h-[72px]" aria-hidden />

      {currentStep === 3 && (
        <div className="flex w-full justify-end print:hidden gap-3 p-0 m-0 items-center">
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(
                  BUSINESS_ROLE_VIEW_STORAGE_KEY,
                  JSON.stringify({
                    businessRoleId: businessRoleId.trim() || undefined,
                    roleName: formData.step1.roleName,
                    roleCode: formData.step1.roleCode,
                    description: formData.step1.description,
                    owner: selectedOwnerLabel || selectedOwnerUserName || formData.step1.owner,
                    ownerId: formData.step1.owner,
                    tags: formData.step1.tags.join(", "),
                    tagsArray: formData.step1.tags,
                    selectedAccessIds: cartItems.map((c) => c.id),
                    accessItems: cartItems.map((c) => ({
                      id: c.id,
                      name: c.name,
                      risk: c.risk,
                    })),
                    raw: null,
                  })
                );
              } catch (e) {
                console.error("Unable to save business role view draft:", e);
              }
              router.push("/settings/gateway/manage-business-roles/review");
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Eye className="h-4 w-4" />
            Open review page
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center p-0 m-0 border-0 bg-transparent text-gray-600 shadow-none hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
            title="Print page"
            aria-label="Print page"
          >
            <Printer className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="w-full py-2 px-4">
        <div className="w-full">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step1.roleName}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          step1: { ...prev.step1, roleName: e.target.value },
                        }))
                      }
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label
                      className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step1.roleName
                          ? "top-0.5 text-xs text-blue-600"
                          : "top-3.5 text-sm text-gray-500"
                      }`}
                    >
                      Business Role Name <span className="text-red-500">*</span>
                    </label>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step1.roleCode}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          step1: { ...prev.step1, roleCode: e.target.value },
                        }))
                      }
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label
                      className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step1.roleCode
                          ? "top-0.5 text-xs text-blue-600"
                          : "top-3.5 text-sm text-gray-500"
                      }`}
                    >
                      Role Code <span className="text-red-500">*</span>
                    </label>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    value={formData.step1.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        step1: { ...prev.step1, description: e.target.value },
                      }))
                    }
                    className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline resize-none"
                    placeholder=" "
                    rows={4}
                  />
                  <label
                    className={`absolute left-4 top-3.5 transition-all duration-200 pointer-events-none ${
                      formData.step1.description
                        ? "top-0.5 text-xs text-blue-600"
                        : "text-sm text-gray-500"
                    }`}
                  >
                    Description <span className="text-red-500">*</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative" ref={ownerDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setOwnerDropdownOpen((prev) => !prev)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline bg-white text-left flex items-center justify-between"
                    >
                      <span
                        className={formData.step1.owner ? "text-gray-900" : "text-gray-500"}
                      >
                        {formData.step1.owner
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
                    <label
                      className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step1.owner || ownerDropdownOpen
                          ? "top-0.5 text-xs text-blue-600"
                          : "top-3.5 text-sm text-gray-500"
                      }`}
                    >
                      Owner <span className="text-red-500">*</span>
                    </label>

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
                          {formData.step1.owner &&
                            !ownerUsers.some((user) => user.value === formData.step1.owner) && (
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 bg-blue-50/40"
                                onClick={() => {
                                  setOwnerDropdownOpen(false);
                                }}
                              >
                                {formData.step1.owner}
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
                                  formData.step1.owner === user.value ? "bg-blue-50" : ""
                                }`}
                                onClick={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    step1: { ...prev.step1, owner: user.value },
                                  }));
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

                  <div className="relative">
                    <div className="w-full min-h-[46px] px-3 pt-5 pb-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500">
                      <div className="flex flex-wrap gap-2">
                        {formData.step1.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800"
                          >
                            {tag}
                            <button
                              type="button"
                              className="text-blue-700 hover:text-blue-900"
                              onClick={() => removeTag(tag)}
                              aria-label={`Remove ${tag}`}
                            >
                              x
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              addTag(tagInput);
                              setTagInput("");
                            } else if (
                              e.key === "Backspace" &&
                              tagInput.trim() === "" &&
                              formData.step1.tags.length > 0
                            ) {
                              removeTag(formData.step1.tags[formData.step1.tags.length - 1]);
                            }
                          }}
                          onBlur={() => {
                            if (tagInput.trim()) {
                              addTag(tagInput);
                              setTagInput("");
                            }
                          }}
                          className="flex-1 min-w-[120px] py-1 text-sm outline-none"
                        />
                      </div>
                    </div>
                    <label
                      className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                        formData.step1.tags.length > 0 || tagInput.trim().length > 0
                          ? "top-0.5 text-xs text-blue-600"
                          : "top-3.5 text-sm text-gray-500"
                      }`}
                    >
                      Tags
                    </label>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <SelectAccessTab
                  onApply={() => setCurrentStep(3)}
                  rolesFromApi={apiRoles}
                  apiCurrentPage={catalogPage}
                  onApiPageChange={(page) => setCatalogPage(page)}
                  applicationInstances={applicationInstances}
                  selectedAppInstanceId={selectedAppInstanceId}
                  onAppInstanceChange={(id) => {
                    setSelectedAppInstanceId(id || null);
                    setCatalogPage(1);
                  }}
                  showApplicationInstancesOnly={showApplicationInstancesOnly}
                  onShowApplicationInstancesOnlyChange={(checked) => {
                    setShowApplicationInstancesOnly(checked);
                    setCatalogPage(1);
                  }}
                  onCatalogTypeChange={(value) => {
                    setCatalogTypeFilter(value);
                    setCatalogPage(1);
                  }}
                  onTagSearch={(tag) => {
                    setTagFilter(tag);
                    setCatalogPage(1);
                  }}
                  hideRecommendedTab
                  hideAddDetailsSidebar
                  preselectedAccessIds={preselectedAccessIds}
                />
              </div>
            )}

            {currentStep === 3 && (
                <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Review Business Role
                </h3>

                {/* Business role summary */}
                <div className="bg-gray-50 p-4 rounded-md space-y-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">
                      Business Role Name:
                    </span>
                    <span className="ml-2 text-gray-900">
                      {formData.step1.roleName || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Role Code:</span>
                    <span className="ml-2 text-gray-900">
                      {formData.step1.roleCode || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Owner:</span>
                    <span className="ml-2 text-gray-900">
                      {selectedOwnerLabel || selectedOwnerUserName || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Tags:</span>
                    <span className="ml-2 text-gray-900">
                      {formData.step1.tags.length > 0
                        ? formData.step1.tags.join(", ")
                        : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Description:
                    </span>
                    <p className="mt-1 text-gray-900 whitespace-pre-wrap">
                      {formData.step1.description || "-"}
                    </p>
                  </div>
                </div>

                {/* Selected access summary */}
                <div className="bg-gray-50 p-4 rounded-md space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">
                      Selected Access ({cartItems.length})
                    </span>
                  </div>
                  {cartItems.length === 0 ? (
                    <p className="text-gray-500">
                      No access items selected in step 2.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {cartItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2 bg-white"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">
                              {item.name}
                            </span>
                          </div>
                          {item.risk && (
                            <span className="text-xs font-medium px-2 py-1 rounded-full border border-gray-300 text-gray-700">
                              {item.risk} Risk
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

