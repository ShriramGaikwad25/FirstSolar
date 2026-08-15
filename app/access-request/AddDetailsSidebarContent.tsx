"use client";

import React, { useState, useEffect } from "react";
import { ShoppingCart } from "lucide-react";
import { getInProgressApplications, getItAssetApp } from "@/lib/api";

export interface Role {
  id: string;
  name: string;
  risk: "Low" | "Medium" | "High";
  description: string;
  type?: string;
  catalogRow?: Record<string, unknown>;
}

export function getRiskColor(risk: string): string {
  switch (risk) {
    case "High":
      return "text-red-600 bg-red-50 border-red-200";
    case "Medium":
      return "text-orange-600 bg-orange-50 border-orange-200";
    case "Low":
      return "text-green-600 bg-green-50 border-green-200";
    default:
      return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

type ProvisioningField = { target: string };

const AddDetailsSidebarContent: React.FC<{
  role: Role;
  riskClass: string;
  onAddToCart: () => void;
  showActions?: boolean;
}> = ({ role, riskClass, onAddToCart, showActions = true }) => {
  const isApplicationInstance =
    (role.type ?? (role.catalogRow?.type as string) ?? "").toString().toLowerCase() === "applicationinstance";

  const formcustomfields = (role.catalogRow?.formcustomfields as unknown[] | undefined) ?? [];
  const hasFormCustomFields = Array.isArray(formcustomfields) && formcustomfields.length > 0;

  type SavedRoleDetails = {
    fieldValues?: Record<number, string>;
    provisioningValues?: Record<string, string>;
    provisioningTargets?: string[];
  };

  const getStorageKey = (roleId: string) => `accessRoleDetails:${roleId}`;

  const loadSavedDetails = (roleId: string): SavedRoleDetails | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(getStorageKey(roleId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SavedRoleDetails;
      return parsed || null;
    } catch {
      return null;
    }
  };

  const [fieldValues, setFieldValues] = useState<Record<number, string>>(() => {
    const initialFromRole: Record<number, string> = {};
    formcustomfields.forEach((item: unknown, idx: number) => {
      if (item != null && typeof item === "object" && !Array.isArray(item)) {
        const obj = item as Record<string, unknown>;
        initialFromRole[idx] = String(obj.value ?? obj.fieldValue ?? obj.val ?? "");
      }
    });

    const saved = loadSavedDetails(role.id);
    if (saved?.fieldValues) {
      return { ...initialFromRole, ...saved.fieldValues };
    }
    return initialFromRole;
  });

  useEffect(() => {
    const initialFromRole: Record<number, string> = {};
    formcustomfields.forEach((item: unknown, idx: number) => {
      if (item != null && typeof item === "object" && !Array.isArray(item)) {
        const obj = item as Record<string, unknown>;
        initialFromRole[idx] = String(obj.value ?? obj.fieldValue ?? obj.val ?? "");
      }
    });

    const saved = loadSavedDetails(role.id);
    if (saved?.fieldValues) {
      setFieldValues({ ...initialFromRole, ...saved.fieldValues });
    } else {
      setFieldValues(initialFromRole);
    }
  }, [role.id]);

  const updateField = (idx: number, value: string) => {
    setFieldValues((prev) => ({ ...prev, [idx]: value }));
  };

  const [provisioningLoading, setProvisioningLoading] = useState(false);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [provisioningFields, setProvisioningFields] = useState<ProvisioningField[]>([]);
  const [provisioningValues, setProvisioningValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isApplicationInstance || !role.id) {
      setProvisioningFields([]);
      setProvisioningValues({});
      setProvisioningError(null);
      return;
    }

    const appInstanceId = String(role.catalogRow?.appinstanceid ?? role.catalogRow?.appInstanceId ?? role.id).trim();
    if (!appInstanceId) {
      setProvisioningFields([]);
      setProvisioningValues({});
      return;
    }

    // If we are in the Review step (showActions === false), try to use
    // previously saved provisioning fields/values first and avoid an API call.
    const saved = loadSavedDetails(role.id);
    if (!showActions && saved?.provisioningTargets && saved.provisioningTargets.length > 0) {
      const fieldsFromSaved: ProvisioningField[] = saved.provisioningTargets.map((target) => ({ target }));
      setProvisioningFields(fieldsFromSaved);

      const initialProv: Record<string, string> = {};
      fieldsFromSaved.forEach(({ target }) => {
        const savedVal = saved.provisioningValues?.[target];
        if (savedVal !== undefined) {
          initialProv[target] = savedVal;
        }
      });
      setProvisioningValues(initialProv);
      setProvisioningLoading(false);
      setProvisioningError(null);
      return;
    }

    setProvisioningLoading(true);
    setProvisioningError(null);

    const extractProvisioningFields = (app: any): void => {
      if (!app || typeof app !== "object") {
        setProvisioningFields([]);
        setProvisioningValues({});
        return;
      }
      const schema = app.schemaMappingDetails ?? app.SchemaMappingDetails ?? app.schemaMapping ?? null;
      const provisioning =
        schema && typeof schema === "object"
          ? (schema.provisioningAttrMap ?? schema.ProvisioningAttrMap ?? schema.provisioning_attr_map ?? {})
          : {};
      const fields: ProvisioningField[] = [];
      if (provisioning && typeof provisioning === "object" && !Array.isArray(provisioning)) {
        Object.entries(provisioning).forEach(([target]) => {
          if (target.trim()) fields.push({ target: target.trim() });
        });
      }
      setProvisioningFields(fields);

      // Load any previously saved provisioning values for this role and apply them
      const savedForProvisioning = loadSavedDetails(role.id);
      if (savedForProvisioning?.provisioningValues) {
        const initialProv: Record<string, string> = {};
        fields.forEach(({ target }) => {
          const savedVal = savedForProvisioning.provisioningValues?.[target];
          if (savedVal !== undefined) {
            initialProv[target] = savedVal;
          }
        });
        setProvisioningValues(initialProv);
      } else {
        setProvisioningValues({});
      }
    };

    getItAssetApp(appInstanceId)
      .then((app: any) => {
        if (app && typeof app === "object") {
          extractProvisioningFields(app);
          return;
        }
        return getInProgressApplications().then((res: any) => {
          if (!res || typeof res !== "object") {
            setProvisioningFields([]);
            setProvisioningValues({});
            return;
          }
          const idKeys = [
            "ApplicationID", "applicationID", "ApplicationId", "applicationId",
            "id", "Id", "appId", "AppId", "appinstanceid", "appInstanceId",
          ];
          const getItemId = (item: any): string =>
            String(
              idKeys.reduce((acc: string | null, k) => acc ?? (item?.[k] != null && item[k] !== "" ? String(item[k]).trim() : null), null) ?? ""
            );
          const getItemName = (item: any): string =>
            String(item?.name ?? item?.ApplicationName ?? item?.applicationName ?? item?.Name ?? item?.appName ?? "").trim();
          const listArr: any[] = Array.isArray(res)
            ? res
            : (() => {
                const direct = res.applications ?? res.Applications ?? res.apps ?? res.data ?? res.result ?? res.list ?? res.content ?? res.items ?? res.value ?? res.body ?? res.getallapp ?? res.appList;
                if (Array.isArray(direct)) return direct;
                if (direct && typeof direct === "object" && Array.isArray((direct as any).items)) return (direct as any).items;
                if (direct && typeof direct === "object" && Array.isArray((direct as any).data)) return (direct as any).data;
                return [];
              })();
          const roleIdNorm = String(role.id).trim().toLowerCase();
          const appInstanceIdNorm = appInstanceId.toLowerCase();
          const nameNorm = (role.name ?? "").toLowerCase();
          const app = listArr.find((item: any) => {
            const id = getItemId(item).trim().toLowerCase();
            const name = getItemName(item).toLowerCase();
            return id === roleIdNorm || id === appInstanceIdNorm || name === nameNorm || id.includes(roleIdNorm) || name.includes(nameNorm);
          });
          extractProvisioningFields(app);
        });
      })
      .catch((err) => {
        setProvisioningError(err instanceof Error ? err.message : "Failed to load application");
        setProvisioningFields([]);
        setProvisioningValues({});
      })
      .finally(() => setProvisioningLoading(false));
  }, [isApplicationInstance, role.id, role.name, role.catalogRow?.appinstanceid, role.catalogRow?.appInstanceId]);

  const updateProvisioningValue = (target: string, value: string) => {
    setProvisioningValues((prev) => ({ ...prev, [target]: value }));
  };

  // Persist sidebar field values (custom fields + provisioning) per role so they
  // are available again when opening the sidebar from the Review step.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const payload: SavedRoleDetails = {
        fieldValues,
        provisioningValues,
        provisioningTargets: provisioningFields.map((f) => f.target),
      };
      window.localStorage.setItem(getStorageKey(role.id), JSON.stringify(payload));
    } catch {
      // Ignore persistence errors
    }
  }, [fieldValues, provisioningValues, provisioningFields, role.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <div className="p-3 border-b bg-gray-50 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium break-words break-all whitespace-normal max-w-full flex-1">
              {role.name}
            </span>
            <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium border ${riskClass}`}>
              {role.risk} Risk
            </span>
          </div>
          {(() => {
            const jit =
              (role.catalogRow?.jit_access as string | undefined) ??
              (role.catalogRow?.jitAccess as string | undefined) ??
              (role.catalogRow?.JIT_ACCESS as string | undefined);
            return typeof jit === "string" && jit.toLowerCase() === "yes";
          })() && (
            <p className="text-xs rounded px-2 py-1 text-[#E0745A] bg-[#E0745A]/15 border border-[#E0745A]">
              This item will be marked for Just In Time Access post approval.
            </p>
          )}
          {(() => {
            const raw = role.catalogRow?.training_code as unknown;
            const arr = Array.isArray(raw) ? raw : [];
            if (arr.length === 0) return null;
            const first = arr[0] as Record<string, unknown>;
            const code = String(first.code ?? "").trim();
            const grace =
              first.gracePeriodInDays != null
                ? Number(first.gracePeriodInDays)
                : undefined;
            if (!code) return null;
            return (
              <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-2 py-1">
                This item requires pre-requisite training{" "}
                <span className="font-medium">{code}</span>
                {Number.isFinite(grace) && grace! > 0
                  ? ` (grace period ${grace} day${grace === 1 ? "" : "s"})`
                  : ""}
              </p>
            );
          })()}
          <div>
            <span className="text-xs font-medium text-gray-500">Description</span>
            <p className="text-sm text-gray-700 break-words break-all whitespace-pre-wrap max-w-full leading-snug mt-0.5">
              {role.description || "—"}
            </p>
          </div>
          <p className="text-sm font-semibold text-gray-700 break-words max-w-full">
            {(role.catalogRow?.entitlementtype ?? role.type ?? "—") as string}
          </p>
        </div>
        <div className="p-4">
          <div className="space-y-3 text-sm">
            {isApplicationInstance && (
              <>
                {provisioningLoading && <p className="text-gray-500">Loading application mapping…</p>}
                {provisioningError && <p className="text-red-600">{provisioningError}</p>}
                {!provisioningLoading && !provisioningError && provisioningFields.length > 0 &&
                  provisioningFields.map(({ target }) => {
                    const value = provisioningValues[target] ?? "";
                    const hasValue = value.length > 0;
                    const isPasswordLike = /password|secret|token|passphrase/i.test(target);
                    return (
                      <div key={target} className="relative">
                        <input
                          type={isPasswordLike ? "password" : "text"}
                          value={value}
                          onChange={(e) => updateProvisioningValue(target, e.target.value)}
                          className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-underline"
                          placeholder=" "
                          autoComplete={isPasswordLike ? "off" : undefined}
                        />
                        <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${hasValue ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"}`}>
                          {target.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}
                        </label>
                      </div>
                    );
                  })}
                {!provisioningLoading && !provisioningError && provisioningFields.length === 0 && (
                  <p className="text-gray-500">No provisioning mapping for this application.</p>
                )}
              </>
            )}
            {hasFormCustomFields ? (
              formcustomfields.map((item: unknown, idx: number) => {
                if (item != null && typeof item === "object" && !Array.isArray(item)) {
                  const obj = item as Record<string, unknown>;
                  const label = (obj.label ?? obj.name ?? obj.fieldName ?? obj.key ?? "Field") as string;
                  const value = fieldValues[idx] ?? String(obj.value ?? obj.fieldValue ?? obj.val ?? "");
                  const isPasswordLike = /password|secret|token|passphrase/i.test(String(label));
                  const hasValue = value.length > 0;
                  return (
                    <div key={idx} className="relative">
                      <input
                        type={isPasswordLike ? "password" : "text"}
                        value={value}
                        onChange={(e) => updateField(idx, e.target.value)}
                        className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-underline"
                        placeholder=" "
                        autoComplete={isPasswordLike ? "off" : undefined}
                      />
                      <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${hasValue ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"}`}>
                        {String(label)}
                      </label>
                    </div>
                  );
                }
                const value = fieldValues[idx] ?? "";
                const hasValue = value.length > 0;
                return (
                  <div key={idx} className="relative">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateField(idx, e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${hasValue ? "top-0.5 text-xs text-blue-600" : "top-3.5 text-sm text-gray-500"}`}>
                      Field
                    </label>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500">No custom fields.</p>
            )}
          </div>
        </div>
      </div>
      {showActions && (
        <div className="shrink-0 p-4 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-2">
          <button type="button" onClick={onAddToCart} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors">
            <ShoppingCart className="w-4 h-4" />
            Add to cart
          </button>
        </div>
      )}
    </div>
  );
};

export default AddDetailsSidebarContent;
