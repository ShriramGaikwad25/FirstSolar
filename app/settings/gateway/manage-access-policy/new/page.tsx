"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Control, FieldValues, UseFormSetValue, UseFormWatch } from "react-hook-form";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  FileText,
  KeyRound,
  ListChecks,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Users,
  Printer,
  SquarePen,
} from "lucide-react";
import ExpressionBuilder from "@/components/ExpressionBuilder";
import { getRiskColor, type Role } from "@/app/access-request/AddDetailsSidebarContent";
import { getLogoSrc } from "@/components/MsAsyncData";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";
import SelectAccessTab from "@/app/access-request/SelectAccessTab";
import { executeQuery } from "@/lib/api";
import { ACCESS_POLICY_VIEW_STORAGE_KEY } from "@/lib/access-policy-view-storage";
import { useCart } from "@/contexts/CartContext";

const ENTITLEMENT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeEntitlementUuid(id: string): string | null {
  const t = String(id).trim();
  return ENTITLEMENT_UUID_RE.test(t) ? t : null;
}

/**
 * Builds entitlement lookup query with empty parameters array (matches executeQuery API shape).
 * IDs must be pre-sanitized UUIDs only.
 */
function buildEntitlementSelectByIdsQuery(entitlementIds: string[]): string {
  const quoted = entitlementIds.map((id) => `'${id}'`).join(",");
  return `SELECT * FROM entitlement WHERE entitlementid in (${quoted})`;
}

/** Catalog UUIDs from policy row `access_granted` (uses each entry's `value`). */
function parseAccessGrantedCatalogIds(row: any): string[] {
  const out: string[] = [];
  const rawKeys = Object.keys(row || {});
  const i = rawKeys.findIndex((k) => k.toLowerCase() === "access_granted");
  if (i === -1) return out;
  const raw = row[rawKeys[i]];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  };
  try {
    let data: unknown = raw;
    if (typeof raw === "string" && raw.trim()) {
      data = JSON.parse(raw);
    }
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item != null && typeof item === "object" && "value" in item) {
          push((item as { value?: unknown }).value);
        } else if (typeof item === "string") {
          push(item);
        }
      }
    } else if (data && typeof data === "object" && "value" in data) {
      push((data as { value?: unknown }).value);
    } else if (typeof data === "string") {
      push(data);
    }
  } catch {
    // ignore malformed access_granted
  }
  return [...new Set(out)];
}

function normalizeExecuteQueryRows(result: unknown): any[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.resultSet)) return r.resultSet as any[];
    if (Array.isArray(r.rows)) return r.rows as any[];
  }
  return [];
}

function pickCatalogField(row: any, ...candidates: string[]): string {
  if (!row || typeof row !== "object") return "—";
  for (const c of candidates) {
    const k = Object.keys(row).find((key) => key.toLowerCase() === c.toLowerCase());
    if (k !== undefined && row[k] != null && String(row[k]).trim() !== "") {
      return String(row[k]);
    }
  }
  return "—";
}

function roleTypeFromCatalogRow(catalogRow: Record<string, unknown> | undefined): string {
  const t = (catalogRow?.type as string) ?? "";
  return String(t).trim().toLowerCase();
}

function getApplicationNameFromRow(catalogRow: Record<string, unknown> | undefined): string {
  if (!catalogRow) return "";
  const v =
    (catalogRow.applicationname as string) ??
    (catalogRow.applicationName as string) ??
    (catalogRow.application_name as string) ??
    (catalogRow.appname as string) ??
    (catalogRow.appName as string) ??
    "";
  return typeof v === "string" ? v.trim() : "";
}

function vwCatalogRowToRole(row: any, index: number): Role {
  const cr = (row || {}) as Record<string, unknown>;
  const nameVal = pickCatalogField(row, "name", "entitlementname");
  const idVal = pickCatalogField(row, "catalogid", "entitlementid");
  const riskStr = pickCatalogField(row, "risk");
  let risk: Role["risk"] = "Low";
  if (riskStr !== "—") {
    const r = riskStr.toLowerCase();
    if (r.startsWith("high")) risk = "High";
    else if (r.startsWith("medium")) risk = "Medium";
  }
  const descVal = pickCatalogField(row, "description", "entitlementdescription");
  const typeVal = pickCatalogField(row, "type");
  return {
    id: idVal !== "—" ? idVal : `catalog-${index}`,
    name: nameVal !== "—" ? nameVal : "Unknown",
    risk,
    description: descVal !== "—" ? descVal : "",
    type: typeVal !== "—" ? typeVal : undefined,
    catalogRow: cr,
  };
}

function cartItemToRole(item: {
  id: string;
  name: string;
  risk?: "Low" | "Medium" | "High";
}): Role {
  return {
    id: item.id,
    name: item.name,
    risk: item.risk ?? "Low",
    description: "",
    catalogRow: {},
  };
}

/** Same card layout as Select Access step 3 (selected state). */
function CatalogAccessCardView({ role }: { role: Role }) {
  const row = role.catalogRow as Record<string, unknown> | undefined;
  const rt = roleTypeFromCatalogRow(row);
  const appName = getApplicationNameFromRow(row);
  return (
    <div className="flex items-center justify-between rounded-lg p-4 transition-colors bg-blue-50 ring-2 ring-blue-400">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="flex items-center justify-center w-10 h-10 bg-gray-300 rounded overflow-hidden shrink-0">
          {rt === "applicationinstance" ? (
            <img
              src={getLogoSrc(appName || role.name)}
              alt=""
              className="w-10 h-10 object-contain"
            />
          ) : (
            <Users className="w-6 h-6 text-gray-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-gray-800 font-medium">{role.name}</span>
            <span
              className={`px-2 py-1 rounded text-xs font-medium border ${getRiskColor(
                role.risk
              )}`}
            >
              {role.risk} Risk
            </span>
            {appName ? (
              <span className="px-2 py-1 rounded text-xs font-medium border text-blue-700 bg-blue-50 border-blue-200">
                {appName}
              </span>
            ) : null}
            {(() => {
              const jit =
                (row?.jit_access as string | undefined) ??
                (row?.jitAccess as string | undefined) ??
                (row?.JIT_ACCESS as string | undefined);
              return typeof jit === "string" && jit.toLowerCase() === "yes";
            })() && (
              <span className="px-2 py-1 rounded text-xs font-medium border text-[#E0745A] bg-[#E0745A]/15 border-[#E0745A]">
                JIT Access
              </span>
            )}
            {(() => {
              const raw = row?.training_code as unknown;
              const arr = Array.isArray(raw) ? raw : [];
              if (arr.length === 0) return null;
              const first = arr[0] as Record<string, unknown>;
              const code = String(first.code ?? "").trim();
              if (!code) return null;
              return (
                <span
                  className={`px-2 py-1 rounded text-xs font-medium border ${getRiskColor(
                    "Low"
                  )}`}
                >
                  Training Check
                </span>
              );
            })()}
          </div>
          {role.description ? (
            <p className="text-sm text-gray-600">{role.description}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function CreateAccessPolicyPage() {
  const { control, setValue, watch, register, handleSubmit, reset } = useForm<FieldValues>({
    defaultValues: {
      policyName: "",
      description: "",
      owner: "",
      priority: "",
      enabled: false,
      userAttributeConditions: [],
    },
  });

  const { isVisible: isSidebarVisible, sidebarWidthPx } = useLeftSidebar();
  const router = useRouter();
  const searchParams = useSearchParams();
  const policyIdParam = searchParams.get("policyId");
  const isViewMode = searchParams.get("view") === "1" && Boolean(policyIdParam);
  const isEditFromView = isViewMode && searchParams.get("edit") === "1";
  const { addToCart, clearCart, isInCart, items: cartItems } = useCart();
  const [currentStep, setCurrentStep] = useState(1);
  /** Single-page edit-from-view shows Select Access without advancing the wizard step. */
  const shouldLoadSelectAccess = currentStep === 3 || isEditFromView;
  const [advanced, setAdvanced] = useState(false);
  // If policyId is present, we are editing an existing policy
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  // In edit mode, keep track of granted access ids and names so Step 3 list can preselect/match them
  const [preselectedAccessIds, setPreselectedAccessIds] = useState<string[]>([]);
  const [preselectedAccessNames, setPreselectedAccessNames] = useState<string[]>([]);

  const [catalogData, setCatalogData] = useState<any[]>([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [selectedAppInstanceId, setSelectedAppInstanceId] = useState<string | null>(null);
  const [showApplicationInstancesOnly, setShowApplicationInstancesOnly] = useState(false);
  const [applicationInstances, setApplicationInstances] = useState<Array<{ id: string; name: string }>>([]);
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<string>("All");
  const [tagFilter, setTagFilter] = useState<string>("");
  const catalogFetchKeyRef = useRef<string | null>(null);
  const catalogPageRef = useRef(catalogPage);

  /** Review page uses row from sessionStorage (list); no per-policy API call. */
  const [viewHydrateStatus, setViewHydrateStatus] = useState<
    "loading" | "ok" | "missing"
  >(() => (isViewMode ? "loading" : "ok"));

  /** From policy row `access_granted` — entitlement IDs; drives entitlement table fetch for Selected Access. */
  const [accessGrantedCatalogIds, setAccessGrantedCatalogIds] = useState<string[]>(
    []
  );
  const [grantedCatalogRows, setGrantedCatalogRows] = useState<any[]>([]);
  const [grantedCatalogLoading, setGrantedCatalogLoading] = useState(false);
  const [grantedCatalogError, setGrantedCatalogError] = useState<string | null>(
    null
  );

  const [feedbackModal, setFeedbackModal] = useState<null | {
    type: "success" | "error";
    title: string;
    message: string;
    /** When true, primary action navigates to the access policies list */
    navigateToList: boolean;
  }>(null);

  const dismissFeedbackModal = () => {
    const shouldNavigate = feedbackModal?.navigateToList === true;
    setFeedbackModal(null);
    if (shouldNavigate) {
      router.push("/settings/gateway/manage-access-policy");
    }
  };

  catalogPageRef.current = catalogPage;

  const accessGrantedIdsKey = useMemo(
    () => accessGrantedCatalogIds.join("|"),
    [accessGrantedCatalogIds]
  );

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

  // Load application instances when Select Access is shown (wizard step 3 or single-page edit-from-view)
  useEffect(() => {
    if (!shouldLoadSelectAccess) return;
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
  }, [shouldLoadSelectAccess]);

  // Load catalog data in Select Access step
  useEffect(() => {
    if (!shouldLoadSelectAccess) return;

    const fetchKey = `3-${catalogPage}-${selectedAppInstanceId ?? "all"}-${showApplicationInstancesOnly}-${catalogTypeFilter}-${tagFilter || "all"}`;
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
    shouldLoadSelectAccess,
    catalogPage,
    selectedAppInstanceId,
    showApplicationInstancesOnly,
    catalogTypeFilter,
    tagFilter,
  ]);

  // User-specific attributes for the expression builder
  const userAttributes = [
    { label: "Department", value: "department" },
    { label: "Job Title", value: "job_title" },
    { label: "Location", value: "location" },
    { label: "Employee Type", value: "employee_type" },
    { label: "Manager", value: "manager" },
    { label: "User Role", value: "user_role" },
    { label: "Status", value: "status" },
    { label: "Access Level", value: "access_level" },
  ];

  const onSubmit = async (data: any) => {
    try {
      const rawConditions = Array.isArray(data.userAttributeConditions)
        ? data.userAttributeConditions
        : [];

      const conditions = rawConditions.map((cond: any) => {
        const attribute =
          cond?.attribute && typeof cond.attribute === "object"
            ? cond.attribute.value ?? cond.attribute.label ?? cond.attribute
            : cond?.attribute ?? "";
        const operator =
          cond?.operator && typeof cond.operator === "object"
            ? cond.operator.value ?? cond.operator.label ?? cond.operator
            : cond?.operator ?? "";

        return {
          value: cond?.value ?? "",
          operator,
          attribute,
        };
      });

      const conditionPayload = {
        operator: "AND",
        conditions,
      };

      const accessGranted =
        Array.isArray(cartItems) && cartItems.length > 0
          ? cartItems.map((item) => ({
              type: "entitlement",
              value: item.id,
            }))
          : [];

      const priorityNumber =
        data.priority !== undefined && data.priority !== null && data.priority !== ""
          ? Number(data.priority)
          : 0;

      if (editingPolicyId) {
        // EDIT mode: PATCH existing access policy
        const status =
          data.enabled === true || data.enabled === "true"
            ? "ACTIVE"
            : "INACTIVE";

        const patchPayload = {
          policyName: data.policyName,
          id: editingPolicyId,
          policyDescription: data.description,
          priority: priorityNumber,
          status,
        };

        console.log("Updating policy with payload:", {
          query:
            "SELECT kf_apply_object_change('access_policy', 'PATCH', ?::jsonb )",
          parameters: [patchPayload],
        });

        const result = await executeQuery(
          "SELECT kf_apply_object_change('access_policy', 'PATCH', ?::jsonb )",
          [patchPayload]
        );

        console.log("Update policy result:", result);
        setFeedbackModal({
          type: "success",
          title: "Policy updated",
          message: "Your access policy was saved successfully.",
          navigateToList: true,
        });
      } else {
        // CREATE mode: existing PUT behavior
        const parameters = [
          "access_policy",
          "PUT",
          {
            policyName: data.policyName,
            policyDescription: data.description,
            priority: priorityNumber,
            accessGranted,
            condition: conditionPayload,
          },
        ];

        console.log("Creating policy with payload:", {
          query: "SELECT kf_apply_object_change(?,?,?::jsonb)",
          parameters,
        });

        const result = await executeQuery(
          "SELECT kf_apply_object_change(?,?,?::jsonb)",
          parameters
        );

        console.log("Create policy result:", result);
        setFeedbackModal({
          type: "success",
          title: "Policy created",
          message: "Your new access policy was created successfully.",
          navigateToList: true,
        });
      }
    } catch (error) {
      console.error("Failed to create policy:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again or check the console for details.";
      setFeedbackModal({
        type: "error",
        title: "Could not save policy",
        message,
        navigateToList: false,
      });
    }
  };

  const applyPolicyRowFromApi = useCallback(
    (row: any) => {
      clearCart();

      // Try to hydrate ExpressionBuilder from any JSON condition / expression field on the row
      let expressionConditions: any[] = [];
      try {
        const rawKeys = Object.keys(row || {});
        const lowerKeys = rawKeys.map((k) => k.toLowerCase());

        const candidateIndex = lowerKeys.findIndex((k) =>
          ["condition", "expression", "rule"].some((needle) =>
            k.includes(needle)
          )
        );

        if (candidateIndex !== -1) {
          const key = rawKeys[candidateIndex];
          const rawVal = row[key];

          if (typeof rawVal === "string" && rawVal.trim()) {
            const parsed = JSON.parse(rawVal);
            if (Array.isArray(parsed)) {
              expressionConditions = parsed;
            } else if (
              parsed &&
              typeof parsed === "object" &&
              Array.isArray((parsed as any).conditions)
            ) {
              expressionConditions = (parsed as any).conditions;
            }
          } else if (Array.isArray(rawVal)) {
            expressionConditions = rawVal;
          } else if (
            rawVal &&
            typeof rawVal === "object" &&
            Array.isArray((rawVal as any).conditions)
          ) {
            expressionConditions = (rawVal as any).conditions;
          }
        }

        console.log("Loaded policy row for ExpressionBuilder", {
          row,
          expressionConditions,
        });
      } catch (e) {
        console.warn("Failed to parse condition block from policy row:", e);
        expressionConditions = [];
      }

      const mappedConditions =
        Array.isArray(expressionConditions) && expressionConditions.length > 0
          ? expressionConditions.map((cond: any, index: number) => ({
              id:
                cond.id ||
                `cond-${index}-${Date.now()}`,
              attribute:
                cond.attribute && typeof cond.attribute === "object"
                  ? cond.attribute
                  : cond.attribute
                  ? {
                      label: cond.attributeLabel || cond.attribute,
                      value: cond.attribute,
                    }
                  : null,
              operator:
                cond.operator && typeof cond.operator === "object"
                  ? cond.operator
                  : cond.operator
                  ? {
                      label: cond.operatorLabel || cond.operator,
                      value: cond.operator,
                    }
                  : null,
              value: cond.value ?? "",
              logicalOp:
                cond.logicalOp ||
                cond.condition ||
                "AND",
            }))
          : [];

      try {
        const rawKeys = Object.keys(row || {});
        const lowerKeys = rawKeys.map((k) => k.toLowerCase());
        const entIndex = lowerKeys.findIndex((k) =>
          [
            "entitlements_json",
            "entitlement_json",
            "entitlements",
            "entitlements_granted",
            "access_granted",
            "access_json",
            "granted_access",
          ].some((needle) => k.includes(needle))
        );
        if (entIndex !== -1) {
          const key = rawKeys[entIndex];
          const rawEnt = row[key];
          let entList: any[] = [];
          if (typeof rawEnt === "string" && rawEnt.trim()) {
            const parsed = JSON.parse(rawEnt);
            if (Array.isArray(parsed)) entList = parsed;
            else if (
              parsed &&
              typeof parsed === "object" &&
              Array.isArray((parsed as any).items)
            ) {
              entList = (parsed as any).items;
            }
          } else if (Array.isArray(rawEnt)) {
            entList = rawEnt;
          } else if (
            rawEnt &&
            typeof rawEnt === "object" &&
            Array.isArray((rawEnt as any).items)
          ) {
            entList = (rawEnt as any).items;
          }

          if (entList.length > 0) {
            const grantedIds: string[] = [];
            const grantedNames: string[] = [];

            entList.forEach((ent, idx) => {
              const id =
                String(
                  ent.id ??
                    ent.entitlement_id ??
                    ent.entitlementid ??
                    ent.catalogid ??
                    idx
                ).trim() || String(idx);
              const name =
                ent.name ??
                ent.entitlement_name ??
                ent.entitlementName ??
                ent.role_name ??
                `Entitlement ${idx + 1}`;

              let risk: "High" | "Medium" | "Low" | undefined;
              const rawRisk = String(
                ent.risk ?? ent.risk_level ?? ent.riskLevel ?? ""
              ).toLowerCase();
              if (rawRisk.startsWith("high")) risk = "High";
              else if (rawRisk.startsWith("medium")) risk = "Medium";
              else if (rawRisk.startsWith("low")) risk = "Low";

              grantedIds.push(id);
              if (name) {
                grantedNames.push(String(name));
              }

              if (!isInCart(id)) {
                addToCart({
                  id,
                  name,
                  risk,
                });
              }
            });

            setPreselectedAccessIds(grantedIds);
            setPreselectedAccessNames(grantedNames);
            setCatalogPage(1);
            setSelectedAppInstanceId(null);
            setShowApplicationInstancesOnly(false);
            setCatalogTypeFilter("All");
            setTagFilter("");
          }
        }
      } catch (e) {
        console.warn(
          "Failed to hydrate entitlements_json into cart from policy row:",
          e
        );
      }

      reset({
        policyName:
          row.policy_name ??
          row.POLICY_NAME ??
          row.name ??
          "",
        description:
          row.policy_description ??
          row.POLICY_DESCRIPTION ??
          row.description ??
          "",
        owner:
          row.created_by ??
          row.CREATED_BY ??
          row.owner ??
          "",
        priority:
          row.priority !== undefined && row.priority !== null
            ? String(row.priority)
            : "",
        enabled: Boolean(
          row.enabled ??
            (row.status &&
              String(row.status).toLowerCase() === "enabled")
        ),
        userAttributeConditions: mappedConditions,
      });
      setAccessGrantedCatalogIds(parseAccessGrantedCatalogIds(row));
    },
    [
      addToCart,
      clearCart,
      isInCart,
      reset,
      setAccessGrantedCatalogIds,
      setCatalogPage,
      setCatalogTypeFilter,
      setPreselectedAccessIds,
      setPreselectedAccessNames,
      setSelectedAppInstanceId,
      setShowApplicationInstancesOnly,
      setTagFilter,
    ]
  );

  // Cart callbacks change identity after updates; keep latest apply out of effect deps to avoid loops.
  const applyPolicyRowFromApiRef = useRef(applyPolicyRowFromApi);
  applyPolicyRowFromApiRef.current = applyPolicyRowFromApi;

  // Load existing policy: edit uses API; review uses sessionStorage only (row from list).
  useEffect(() => {
    const policyId = policyIdParam;
    if (!policyId) return;
    setEditingPolicyId(policyId);

    const apply = (row: Record<string, unknown>) =>
      applyPolicyRowFromApiRef.current(row);

    if (isViewMode && !isEditFromView) {
      try {
        const raw = sessionStorage.getItem(ACCESS_POLICY_VIEW_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            policyId?: string;
            row?: Record<string, unknown>;
          };
          if (
            parsed.policyId === policyId &&
            parsed.row &&
            typeof parsed.row === "object" &&
            Object.keys(parsed.row).length > 0
          ) {
            apply(parsed.row);
            setCurrentStep(4);
            setViewHydrateStatus("ok");
            return;
          }
        }
      } catch (e) {
        console.error("Failed to read access policy review from storage:", e);
      }
      setViewHydrateStatus("missing");
      return;
    }

    const fetchPolicy = async () => {
      try {
        const query =
          "select * from kf_ap_access_policies_vw where policy_id=?::uuid";
        const parameters = [policyId];
        const result = await executeQuery<any>(query, parameters);

        const rows: any[] = Array.isArray(result)
          ? result
          : Array.isArray((result as any).resultSet)
          ? (result as any).resultSet
          : Array.isArray((result as any).rows)
          ? (result as any).rows
          : [];

        if (!rows.length) return;
        apply(rows[0]);
      } catch (e) {
        console.error("Failed to load policy into form:", e);
      }
    };

    fetchPolicy();
  }, [isEditFromView, isViewMode, policyIdParam]);

  useEffect(() => {
    if (!accessGrantedCatalogIds.length) {
      setGrantedCatalogRows([]);
      setGrantedCatalogError(null);
      setGrantedCatalogLoading(false);
      return;
    }
    const sanitizedIds = [
      ...new Set(
        accessGrantedCatalogIds
          .map((id) => sanitizeEntitlementUuid(id))
          .filter((id): id is string => Boolean(id))
      ),
    ];
    if (!sanitizedIds.length) {
      setGrantedCatalogRows([]);
      setGrantedCatalogError(null);
      setGrantedCatalogLoading(false);
      return;
    }
    let cancelled = false;
    setGrantedCatalogLoading(true);
    setGrantedCatalogError(null);
    (async () => {
      try {
        const query = buildEntitlementSelectByIdsQuery(sanitizedIds);
        const result = await executeQuery<any>(query, []);
        const list = normalizeExecuteQueryRows(result);
        const byEntitlementId = new Map<string, any>();
        for (const row of list) {
          if (!row || typeof row !== "object") continue;
          const idVal = pickCatalogField(row, "entitlementid", "entitlement_id");
          if (idVal !== "—") byEntitlementId.set(String(idVal).trim().toLowerCase(), row);
        }
        const ordered = accessGrantedCatalogIds
          .map((raw) => {
            const sid = sanitizeEntitlementUuid(raw);
            if (!sid) return null;
            return byEntitlementId.get(sid.toLowerCase()) ?? null;
          })
          .filter(Boolean) as any[];
        if (!cancelled) {
          setGrantedCatalogRows(ordered);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setGrantedCatalogError(
            e instanceof Error ? e.message : "Failed to load selected access"
          );
          setGrantedCatalogRows([]);
        }
      } finally {
        if (!cancelled) setGrantedCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessGrantedIdsKey]);

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Step 1 Component - Policy Details
  const Step1Content = () => (
    <>
      {/* Policy Details Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Policy Details</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Policy Name
            </label>
            <input
              type="text"
              {...register("policyName")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              {...register("description")}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Owner
            </label>
            <input
              type="text"
              {...register("owner")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <input
                type="number"
                {...register("priority")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-8">
              <input
                type="checkbox"
                id="enabled"
                {...register("enabled")}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                Enabled
              </label>
            </div>
          </div>
        </div>
      </div>

    </>
  );

  // Step 2 Component - Membership Rule
  const Step2Content = () => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-900">Membership Rule</h2>

      </div>
      <p className="text-sm text-gray-600 mb-4">
        Define which users are in scope for this access policy. All conditions must be true (AND) for the policy to apply.
      </p>

      <ExpressionBuilder
        control={control as unknown as Control<FieldValues>}
        setValue={setValue as unknown as UseFormSetValue<FieldValues>}
        watch={watch as unknown as UseFormWatch<FieldValues>}
        fieldName="userAttributeConditions"
        attributesOptions={userAttributes}
        hideJsonPreview={true}
        fullWidth={true}
      />
    </div>
  );

  // Step 3 Component - Select Access
  const Step3Content = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <SelectAccessTab
          onApply={() => setCurrentStep(4)}
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
          preselectedAccessNames={preselectedAccessNames}
        />
      </div>
    </div>
  );

  // Step 4 Component - Review/Additional Info (wizard) or standalone review layout
  const Step4Content = ({ variant = "wizard" }: { variant?: "wizard" | "review" }) => {
    const membershipConditions: any[] = watch("userAttributeConditions") || [];

    const hasConditions =
      Array.isArray(membershipConditions) && membershipConditions.length > 0;

    if (variant === "review") {
      const policyName = watch("policyName") || "";
      const owner = watch("owner") || "";
      const priority = watch("priority") || "";
      const enabled = watch("enabled");
      const description = watch("description") || "";

      return (
        <div className="space-y-4 text-xs">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
              Access Policy
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="font-medium text-gray-600 mb-1">Policy Name</div>
                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-gray-900">
                  {policyName || <span className="text-gray-400">Not provided</span>}
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-600 mb-1">Owner</div>
                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-gray-900">
                  {owner || <span className="text-gray-400">Not provided</span>}
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-600 mb-1">Priority</div>
                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-gray-900">
                  {priority ? String(priority) : <span className="text-gray-400">—</span>}
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-600 mb-1">Enabled</div>
                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-gray-900">
                  {enabled ? "Yes" : "No"}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="font-medium text-gray-600 mb-1 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  Description
                </div>
                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-gray-900 whitespace-pre-wrap">
                  {description || <span className="text-gray-400">Not provided</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-blue-600 shrink-0" />
              Membership Rule
            </h4>
            <p className="text-[11px] text-gray-500 mb-2">
              All conditions are combined with <span className="font-semibold">AND</span>.
            </p>
            {!hasConditions ? (
              <p className="text-xs text-gray-400">
                No membership rule is defined. This policy will apply to all users in scope.
              </p>
            ) : (
              <ol className="list-decimal list-inside space-y-2 border border-gray-200 rounded-md px-3 py-3 bg-gray-50 text-gray-900">
                {membershipConditions.map((cond: any, index: number) => {
                  const attributeLabel =
                    cond?.attribute?.label ??
                    cond?.attribute?.value ??
                    cond?.attribute ??
                    "";
                  const operatorLabel =
                    cond?.operator?.label ??
                    cond?.operator?.value ??
                    cond?.operator ??
                    "";
                  const valueLabel =
                    cond?.value !== undefined && cond?.value !== null
                      ? String(cond.value)
                      : "";

                  return (
                    <li key={cond.id ?? index} className="text-xs leading-relaxed">
                      <span className="font-medium">
                        {attributeLabel || "(attribute)"}
                      </span>{" "}
                      <span className="text-gray-600">
                        {operatorLabel || "(operator)"}
                      </span>{" "}
                      <span className="font-medium break-all">
                        {valueLabel || "(value)"}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 bg-gray-50/80">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-blue-600 shrink-0" />
                Selected Access
              </p>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-100">
                {accessGrantedCatalogIds.length > 0
                  ? `${accessGrantedCatalogIds.length} ${
                      accessGrantedCatalogIds.length === 1 ? "item" : "items"
                    }`
                  : `${cartItems.length} ${cartItems.length === 1 ? "item" : "items"}`}
              </span>
            </div>
            {accessGrantedCatalogIds.length > 0 ? (
              <>
                {grantedCatalogLoading && (
                  <p className="px-4 py-4 text-xs text-gray-600">Loading catalog…</p>
                )}
                {grantedCatalogError && (
                  <p className="px-4 py-4 text-xs text-red-600">{grantedCatalogError}</p>
                )}
                {!grantedCatalogLoading &&
                  !grantedCatalogError &&
                  grantedCatalogRows.length === 0 && (
                    <p className="px-4 py-4 text-xs text-gray-400">
                      No matching rows in entitlement for the granted access IDs.
                    </p>
                  )}
                {!grantedCatalogLoading && grantedCatalogRows.length > 0 && (
                  <div className="space-y-3 px-4 pb-4">
                    {grantedCatalogRows.map((r, idx) => {
                      const role = vwCatalogRowToRole(r, idx);
                      return (
                        <CatalogAccessCardView key={role.id} role={role} />
                      );
                    })}
                  </div>
                )}
              </>
            ) : cartItems.length === 0 ? (
              <p className="px-4 py-4 text-xs text-gray-400">
                No access items are associated with this policy.
              </p>
            ) : (
              <div className="space-y-3 px-4 pb-4">
                {cartItems.map((item) => (
                  <CatalogAccessCardView
                    key={item.id}
                    role={cartItemToRole(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Policy summary */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-3 text-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Review Access Policy
          </h2>
          <div>
            <span className="font-medium text-gray-700">Policy Name:</span>
            <span className="ml-2 text-gray-900">
              {watch("policyName") || "-"}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Owner:</span>
            <span className="ml-2 text-gray-900">
              {watch("owner") || "-"}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Priority:</span>
            <span className="ml-2 text-gray-900">
              {watch("priority") || "N/A"}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Enabled:</span>
            <span className="ml-2 text-gray-900">
              {watch("enabled") ? "Yes" : "No"}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Description:</span>
            <p className="mt-1 text-gray-900 whitespace-pre-wrap">
              {watch("description") || "-"}
            </p>
          </div>
        </div>

        {/* Membership rule details (Step 2 summary) */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-gray-900">
              Membership Rule Details
            </h3>
            <span className="text-xs text-gray-500">
              All conditions are combined with AND
            </span>
          </div>

          {!hasConditions ? (
            <p className="text-gray-500">
              No membership rule is defined. This policy will apply to all
              users in scope.
            </p>
          ) : (
            <ol className="list-decimal list-inside space-y-1">
              {membershipConditions.map((cond: any, index: number) => {
                const attributeLabel =
                  cond?.attribute?.label ??
                  cond?.attribute?.value ??
                  cond?.attribute ??
                  "";
                const operatorLabel =
                  cond?.operator?.label ??
                  cond?.operator?.value ??
                  cond?.operator ??
                  "";
                const valueLabel =
                  cond?.value !== undefined && cond?.value !== null
                    ? String(cond.value)
                    : "";

                return (
                  <li key={cond.id ?? index} className="text-gray-800">
                    <span className="font-medium">
                      {attributeLabel || "(attribute)"}
                    </span>{" "}
                    <span className="text-gray-600">
                      {operatorLabel || "(operator)"}
                    </span>{" "}
                    <span className="font-medium break-all">
                      {valueLabel || "(value)"}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Selected access summary */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-gray-900">
              Selected Access (
              {accessGrantedCatalogIds.length > 0
                ? accessGrantedCatalogIds.length
                : cartItems.length}
              )
            </h3>
          </div>
          {accessGrantedCatalogIds.length > 0 ? (
            <>
              {grantedCatalogLoading && (
                <p className="text-xs text-gray-600">Loading catalog…</p>
              )}
              {grantedCatalogError && (
                <p className="text-xs text-red-600">{grantedCatalogError}</p>
              )}
              {!grantedCatalogLoading &&
                !grantedCatalogError &&
                grantedCatalogRows.length === 0 && (
                  <p className="text-xs text-gray-400">
                    No matching rows in entitlement for the granted access IDs.
                  </p>
                )}
              {!grantedCatalogLoading && grantedCatalogRows.length > 0 && (
                <div className="space-y-3">
                  {grantedCatalogRows.map((r, idx) => {
                    const role = vwCatalogRowToRole(r, idx);
                    return (
                      <CatalogAccessCardView key={role.id} role={role} />
                    );
                  })}
                </div>
              )}
            </>
          ) : cartItems.length === 0 ? (
            <p className="text-gray-500">
              No access items selected in Step 3.
            </p>
          ) : (
            <div className="space-y-3">
              {cartItems.map((item) => (
                <CatalogAccessCardView
                  key={item.id}
                  role={cartItemToRole(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const PolicyDetailsEditFromView = () => (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
        Access Policy
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <div className="font-medium text-gray-600 mb-1">Policy Name</div>
          <input
            type="text"
            {...register("policyName")}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <div className="font-medium text-gray-600 mb-1">Owner</div>
          <input
            type="text"
            {...register("owner")}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <div className="font-medium text-gray-600 mb-1">Priority</div>
          <input
            type="number"
            {...register("priority")}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <div className="font-medium text-gray-600 mb-1">Enabled</div>
          <label className="inline-flex h-[38px] items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
            <input
              type="checkbox"
              {...register("enabled")}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            Enabled
          </label>
        </div>
        <div className="md:col-span-2">
          <div className="font-medium text-gray-600 mb-1 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            Description
          </div>
          <textarea
            {...register("description")}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>
      </div>
    </div>
  );

  const steps = [
    { id: 1, title: "Policy Details" },
    { id: 2, title: "Membership Rule" },
    { id: 3, title: "Select Access" },
    { id: 4, title: "Review" },
  ];

  if (isViewMode && !isEditFromView) {
    return (
      <div className="relative min-h-screen bg-gradient-to-b from-slate-50 to-gray-100">
        <div className="absolute top-0 right-0 z-20 print:hidden p-0 m-0">
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
        <div className="mx-auto w-full max-w-6xl">
          <div className="space-y-4 py-3 px-6">
          <div className="rounded-xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900">
                  Review Access Policy
                </h1>
                <p className="mt-1 text-xs text-gray-600">
                  Review policy details before making updates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!policyIdParam) return;
                  router.push(
                    `/settings/gateway/manage-access-policy/new?policyId=${encodeURIComponent(policyIdParam)}&view=1&edit=1`
                  );
                }}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <SquarePen className="h-4 w-4" />
                Edit
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
            {viewHydrateStatus === "loading" && (
              <p className="text-sm text-gray-600 text-center py-8">Loading…</p>
            )}
            {viewHydrateStatus === "missing" && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  No policy data found. Use the <strong>View</strong> action on the
                  Access Policy list so this page can show the policy without a
                  separate API call.
                </p>
              </div>
            )}
            {viewHydrateStatus === "ok" && (
              <Step4Content variant="review" />
            )}
          </div>
          </div>
        </div>
      </div>
    );
  }

  if (isViewMode && isEditFromView) {
    return (
      <div className="relative min-h-screen bg-gradient-to-b from-slate-50 to-gray-100">
        <div className="mx-auto w-full max-w-6xl">
          <div className="space-y-4 py-3 px-6">
            <div className="rounded-xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Edit Access Policy
                  </h1>
                  <p className="mt-1 text-xs text-gray-600">
                    Update the policy from this page without using the step form.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSubmit(onSubmit)}
                  className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <Check className="h-4 w-4" />
                  Update Policy
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="space-y-6">
                <PolicyDetailsEditFromView />
                <Step2Content />
                <Step3Content />
              </div>
            </div>
          </div>
        </div>

        {feedbackModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
            role="presentation"
            onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              if (feedbackModal?.navigateToList) return;
              dismissFeedbackModal();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="access-policy-feedback-title"
              className="w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-4">
                {feedbackModal.type === "success" ? (
                  <CheckCircle2
                    className="h-11 w-11 text-green-600 shrink-0"
                    aria-hidden
                  />
                ) : (
                  <AlertCircle
                    className="h-11 w-11 text-red-600 shrink-0"
                    aria-hidden
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h2
                    id="access-policy-feedback-title"
                    className="text-lg font-semibold text-gray-900"
                  >
                    {feedbackModal.title}
                  </h2>
                  <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
                    {feedbackModal.message}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                {feedbackModal.navigateToList ? (
                  <button
                    type="button"
                    onClick={dismissFeedbackModal}
                    className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
                  >
                    View all policies
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={dismissFeedbackModal}
                    className="px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-800 text-sm font-medium"
                  >
                    OK
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

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
                  <div className="flex-1 h-0.5 bg-gray-200 mx-4 min-w-[16px]" aria-hidden />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="shrink-0">
            {currentStep < steps.length ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit(onSubmit)}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
              >
                <Check className="w-4 h-4 mr-2" />
                {editingPolicyId ? "Update Policy" : "Create Policy"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spacer so content is not hidden under fixed step bar */}
      <div className="h-[72px]" aria-hidden />

      <div className="w-full py-3 px-2">
        <div className="w-full">
          <div className="space-y-6">
            {currentStep === 1 && <Step1Content />}
            {currentStep === 2 && <Step2Content />}
            {currentStep === 3 && <Step3Content />}
            {currentStep === 4 && <Step4Content />}
          </div>
        </div>
      </div>

      {feedbackModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
          role="presentation"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            // Success flow: only the primary button navigates to the list
            if (feedbackModal?.navigateToList) return;
            dismissFeedbackModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-policy-feedback-title"
            className="w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-4">
              {feedbackModal.type === "success" ? (
                <CheckCircle2
                  className="h-11 w-11 text-green-600 shrink-0"
                  aria-hidden
                />
              ) : (
                <AlertCircle
                  className="h-11 w-11 text-red-600 shrink-0"
                  aria-hidden
                />
              )}
              <div className="min-w-0 flex-1">
                <h2
                  id="access-policy-feedback-title"
                  className="text-lg font-semibold text-gray-900"
                >
                  {feedbackModal.title}
                </h2>
                <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
                  {feedbackModal.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              {feedbackModal.navigateToList ? (
                <button
                  type="button"
                  onClick={dismissFeedbackModal}
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
                >
                  View all policies
                </button>
              ) : (
                <button
                  type="button"
                  onClick={dismissFeedbackModal}
                  className="px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-800 text-sm font-medium"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

