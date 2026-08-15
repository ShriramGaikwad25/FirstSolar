"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Edit, Trash2, Info, ChevronDown, X, Search, Key } from "lucide-react";
import CustomPagination from "@/components/agTable/CustomPagination";
import { executeQuery, getApplicationDetails } from "@/lib/api";

type MappingRow = {
  id: string;
  source: string;
  target: string;
  defaultValue: string;
  keyfieldMapping?: boolean;
  maskMapping?: boolean;
};

interface SchemaMappingTabProps {
  applicationId: string;
  /** Called when Cancel is clicked. If not provided, navigates to /settings/app-inventory */
  onCancel?: () => void;
}

export default function SchemaMappingTab({ applicationId, onCancel }: SchemaMappingTabProps) {
  const router = useRouter();
  const [scimAttributes, setScimAttributes] = useState<string[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mappingType, setMappingType] = useState("Direct");
  const [sourceAttribute, setSourceAttribute] = useState("");
  const [targetAttribute, setTargetAttribute] = useState("");
  const [keyfieldMapping, setKeyfieldMapping] = useState(false);
  const [maskMapping, setMaskMapping] = useState(false);
  const [defaultValue, setDefaultValue] = useState("");
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const [filteredSource, setFilteredSource] = useState<string[]>([]);
  const sourceRef = useRef<HTMLDivElement>(null);

  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [helpModalData, setHelpModalData] = useState<{ attribute: string; description: string }[]>([]);
  const [helpModalLoading, setHelpModalLoading] = useState(false);
  const [helpModalError, setHelpModalError] = useState<string | null>(null);
  const [helpModalSearch, setHelpModalSearch] = useState("");
  const [helpModalPage, setHelpModalPage] = useState(1);
  const [helpModalPageSize, setHelpModalPageSize] = useState<number | "all">(10);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSource, setEditSource] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editDefaultValue, setEditDefaultValue] = useState("");
  const [editKeyfield, setEditKeyfield] = useState(false);
  const [editMaskMapping, setEditMaskMapping] = useState(false);

  /** Attribute names from applicationinstance.configuration (matchUserAttribute, identityMatchingAttribute, etc.) – show key icon next to these */
  const [configurationAttributes, setConfigurationAttributes] = useState<Set<string>>(new Set());
  const [isPaycomApp, setIsPaycomApp] = useState(false);

  const buildMappingsFromApi = useCallback((json: any): MappingRow[] => {
    const rows: MappingRow[] = [];
    const seen = new Set<string>();
    const key = (s: string, t: string) => `${s}\0${t}`;
    let idx = 0;
    const provisioning = json?.provisioningAttrMap?.scimTargetMap ?? {};
    Object.entries(provisioning).forEach(([target, value]: [string, any]) => {
      const source = (value?.variable ?? value ?? "").toString();
      if ((source || target) && !seen.has(key(source, target))) {
        seen.add(key(source, target));
        rows.push({
          id: `p-${idx++}`,
          source,
          target,
          defaultValue: "",
          keyfieldMapping: false,
          maskMapping: false,
        });
      }
    });
    const reconciliation = json?.reconcilliationAttrMap?.scimTargetMap ?? json?.reconciliationAttrMap?.scimTargetMap ?? {};
    Object.entries(reconciliation).forEach(([source, value]: [string, any]) => {
      const target = (value?.variable ?? value ?? "").toString();
      if ((source || target) && !seen.has(key(source, target))) {
        seen.add(key(source, target));
        rows.push({
          id: `r-${idx++}`,
          source,
          target,
          defaultValue: "",
          keyfieldMapping: false,
          maskMapping: false,
        });
      }
    });
    return rows;
  }, []);

  useEffect(() => {
    if (!applicationId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const apiToken =
          typeof window !== "undefined"
            ? sessionStorage.getItem(`app-inventory-token-${applicationId}`) ?? ""
            : "";

        const [scimRes, mappedRes, configRes, appDetails] = await Promise.all([
          fetch("https://preview.keyforge.ai/schemamapper/getscim/ACMECOM", {
            method: "GET",
            headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
          }),
          fetch(
            `https://preview.keyforge.ai/schemamapper/getmappedschema/ACMECOM/${encodeURIComponent(applicationId)}`
          ),
          executeQuery<{ errorMessage?: string; resultSet?: Array<{ configuration?: Record<string, string> }> }>(
            "select configuration from applicationinstance where appid = ?",
            [applicationId]
          ),
          getApplicationDetails(applicationId, apiToken).catch(() => null),
        ]);

        if (cancelled) return;
        if (!scimRes.ok) {
          setError("Failed to load SCIM attributes");
          setScimAttributes([]);
        } else {
          const scimData = await scimRes.json();
          const list = Array.isArray(scimData?.scimAttributes)
            ? scimData.scimAttributes
            : Array.isArray(scimData)
            ? scimData
            : [];
          setScimAttributes(list);
          setFilteredSource(list);
        }

        if (!mappedRes.ok) {
          setMappings([]);
        } else {
          const mappedData = await mappedRes.json();
          setMappings(buildMappingsFromApi(mappedData));
        }

        const configAttrs = new Set<string>();
        const resultSet = configRes?.resultSet;
        if (Array.isArray(resultSet) && resultSet.length > 0) {
          const configuration = resultSet[0]?.configuration;
          if (configuration && typeof configuration === "object") {
            for (const value of Object.values(configuration)) {
              if (typeof value === "string" && value.trim()) configAttrs.add(value.trim());
            }
          }
        }
        if (!cancelled) setConfigurationAttributes(configAttrs);

        // Show Mask checkbox only for Paycom_HR_Portal app.
        const app = appDetails?.Application ?? appDetails ?? {};
        const appName = String(
          app?.ApplicationName ?? app?.applicationName ?? app?.name ?? app?.Name ?? ""
        )
          .trim()
          .toLowerCase();
        const appId = String(applicationId ?? "").trim().toLowerCase();
        if (!cancelled) {
          setIsPaycomApp(appName === "paycom_hr_portal" || appId === "paycom_hr_portal");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load schema");
          setScimAttributes([]);
          setMappings([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationId, buildMappingsFromApi]);

  const totalPages = Math.max(1, pageSize === "all" ? 1 : Math.ceil(mappings.length / (pageSize as number)));
  const pageMappings = pageSize === "all"
    ? mappings
    : mappings.slice((page - 1) * (pageSize as number), page * (pageSize as number));

  const handleAddMapping = () => {
    if (!sourceAttribute.trim() || !targetAttribute.trim()) return;
    setMappings((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        source: sourceAttribute.trim(),
        target: targetAttribute.trim(),
        defaultValue: defaultValue.trim(),
        keyfieldMapping: keyfieldMapping,
        maskMapping: maskMapping,
      },
    ]);
    setSourceAttribute("");
    setTargetAttribute("");
    setDefaultValue("");
    setKeyfieldMapping(false);
    setMaskMapping(false);
  };

  const handleDelete = (id: string) => {
    setMappings((prev) => prev.filter((m) => m.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const startEdit = (row: MappingRow) => {
    setEditingId(row.id);
    setEditSource(row.source);
    setEditTarget(row.target);
    setEditDefaultValue(row.defaultValue);
    setEditKeyfield(!!row.keyfieldMapping);
    setEditMaskMapping(!!row.maskMapping);
  };

  const saveEdit = () => {
    if (!editingId) return;
    setMappings((prev) =>
      prev.map((m) =>
        m.id === editingId
          ? {
              ...m,
              source: editSource,
              target: editTarget,
              defaultValue: editDefaultValue,
              keyfieldMapping: editKeyfield,
              maskMapping: editMaskMapping,
            }
          : m
      )
    );
    setEditingId(null);
  };

  const sourceAttrsInTable = useMemo(
    () => new Set(mappings.map((m) => m.source.trim().toLowerCase())),
    [mappings]
  );
  const availableSourceAttrs = useMemo(
    () => scimAttributes.filter((a) => !sourceAttrsInTable.has(a.trim().toLowerCase())),
    [scimAttributes, sourceAttrsInTable]
  );

  const filterSource = (term: string) => {
    setSourceAttribute(term);
    if (!term.trim()) setFilteredSource(availableSourceAttrs);
    else
      setFilteredSource(
        availableSourceAttrs.filter((a) =>
          a.toLowerCase().includes(term.toLowerCase())
        )
      );
  };

  const openHelpModal = useCallback(async () => {
    setHelpModalOpen(true);
    setHelpModalSearch("");
    setHelpModalPage(1);
    setHelpModalPageSize(10);
    setHelpModalError(null);
    setHelpModalLoading(true);
    try {
      const [scimResp, schemasResp] = await Promise.all([
        fetch("https://preview.keyforge.ai/schemamapper/getscim/ACMECOM", {
          method: "GET",
          headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        }),
        applicationId
          ? fetch(`https://preview.keyforge.ai/scim/v2/ACMECOM/${encodeURIComponent(applicationId)}/Schemas`, {
              method: "GET",
              headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
            })
          : Promise.resolve(null),
      ]);

      if (!scimResp.ok) {
        setHelpModalError(`Failed to load attribute list (${scimResp.status})`);
        setHelpModalData([]);
        return;
      }
      const scimJson = await scimResp.json();
      const raw = Array.isArray(scimJson?.scimAttributes) ? scimJson.scimAttributes : Array.isArray(scimJson) ? scimJson : [];

      const descriptionByAttr = new Map<string, string>();
      if (schemasResp?.ok) {
        try {
          const schemasJson = await schemasResp.json();
          const resources = Array.isArray(schemasJson?.Resources) ? schemasJson.Resources : Array.isArray(schemasJson) ? schemasJson : [];
          for (const res of resources) {
            const attrs = res?.attributes ?? res?.Attributes ?? [];
            for (const a of attrs) {
              const name = (a?.name ?? a?.Name ?? "").toString().trim();
              const desc = (a?.description ?? a?.Description ?? "").toString().trim();
              if (name && !descriptionByAttr.has(name)) {
                descriptionByAttr.set(name, desc);
              }
            }
          }
        } catch {
          // ignore
        }
      }

      const getDescription = (attr: string): string => {
        const key = attr.trim();
        const exact = descriptionByAttr.get(key);
        if (exact) return exact;
        const parent = key.split(/[.[]/)[0]?.trim() ?? "";
        return descriptionByAttr.get(parent) ?? "";
      };

      const list: { attribute: string; description: string }[] = raw.map((name: string) => ({
        attribute: String(name ?? ""),
        description: getDescription(String(name ?? "")),
      })).filter((r: { attribute: string }) => r.attribute.trim() !== "");
      const seen = new Set<string>();
      const deduped = list.filter((r) => {
        const key = r.attribute.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setHelpModalData(deduped);
    } catch (e) {
      setHelpModalError(e instanceof Error ? e.message : "Failed to load attribute list");
      setHelpModalData([]);
    } finally {
      setHelpModalLoading(false);
    }
  }, [applicationId]);

  const helpModalFiltered = useMemo(() => {
    const inLeftTable = new Set(mappings.map((m) => m.source.trim().toLowerCase()));
    let list = helpModalData.filter(
      (r) => !inLeftTable.has(r.attribute.trim().toLowerCase())
    );
    if (helpModalSearch.trim()) {
      const q = helpModalSearch.toLowerCase().trim();
      list = list.filter((r) => r.attribute.toLowerCase().includes(q));
    }
    return list;
  }, [helpModalData, helpModalSearch, mappings]);

  const helpModalTotalPages = Math.max(
    1,
    helpModalPageSize === "all" ? 1 : Math.ceil(helpModalFiltered.length / (helpModalPageSize as number))
  );
  const helpModalPageData =
    helpModalPageSize === "all"
      ? helpModalFiltered
      : helpModalFiltered.slice(
          (helpModalPage - 1) * (helpModalPageSize as number),
          helpModalPage * (helpModalPageSize as number)
        );

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/settings/app-inventory");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-md">{error}</div>
      )}

      <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_28rem] gap-8">
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
            <table className="w-full table-auto min-w-full" style={{ tableLayout: "fixed" }}>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[35%] min-w-[120px]">
                    Source Attribute
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[35%] min-w-[120px]">
                    Target Attribute
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%] min-w-[80px] whitespace-nowrap">
                    Default Value
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%] min-w-[90px]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pageMappings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                      No attribute mappings configured.
                    </td>
                  </tr>
                ) : (
                  pageMappings.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 align-top whitespace-pre-wrap break-words" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                        <span className="inline-flex items-center gap-1">
                          {m.source}
                          {configurationAttributes.has(m.source?.trim() ?? "") && (
                            <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="Configuration attribute" />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 align-top whitespace-pre-wrap break-words" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                        <span className="inline-flex items-center gap-1">
                          {m.target}
                          {isPaycomApp && m.target?.trim().toLowerCase() === "dob" && (
                            <span className="ml-1 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                              Masked
                            </span>
                          )}
                          {configurationAttributes.has(m.target?.trim() ?? "") && (
                            <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="Configuration attribute" />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 align-top whitespace-pre-wrap break-words" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                        {m.defaultValue || "—"}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            onClick={() => startEdit(m)}
                            aria-label="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            onClick={() => handleDelete(m.id)}
                            aria-label="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="w-full">
            <CustomPagination
              totalItems={mappings.length}
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(newPageSize) => {
                setPageSize(newPageSize);
                setPage(1);
              }}
              pageSizeOptions={[10, 20, 50, 100, "all"]}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={saving || !applicationId}
              onClick={async () => {
                if (!applicationId || saving) return;
                setSaving(true);
                setError(null);
                try {
                  const provisioningAttrMap: Record<string, { variable: string }> = {};
                  mappings.forEach((m) => {
                    if (m.target?.trim()) {
                      provisioningAttrMap[m.target.trim()] = { variable: m.source?.trim() ?? "" };
                    }
                  });
                  const payload = {
                    provisioningAttrMap,
                    reconcilliationAttrMap: {},
                  };
                  const url = `https://preview.keyforge.ai/schemamapper/mapfields/ACMECOM/${encodeURIComponent(applicationId)}`;
                  const resp = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  if (!resp.ok) {
                    const text = await resp.text();
                    setError(text || `Save failed (${resp.status})`);
                    return;
                  }
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to save mappings");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="space-y-4 bg-white border border-gray-200 rounded-lg p-6 self-start max-w-md w-full">
          {editingId ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900">Edit Mapping</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mapping Type</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={mappingType}
                    onChange={(e) => setMappingType(e.target.value)}
                  >
                    <option value="Direct">Direct</option>
                    <option value="Expression">Expression</option>
                    <option value="Constant">Constant</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Attribute{" "}
                    <span className="relative inline-block group cursor-help">
                      <Info className="w-4 h-4 inline ml-1 text-gray-400" />
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-20">
                        Provisioning gateway attributes
                      </span>
                    </span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                    placeholder="Select or enter source attribute"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Attribute{" "}
                    <span className="relative inline-block group cursor-help">
                      <Info className="w-4 h-4 inline ml-1 text-gray-400" />
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-20">
                        Target Application account attributes
                      </span>
                    </span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editTarget}
                    onChange={(e) => setEditTarget(e.target.value)}
                    placeholder="Enter target attribute"
                  />
                  <div className="mt-2 flex justify-end">
                    <div className="flex items-center gap-4">
                      {isPaycomApp && (
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={editMaskMapping}
                            onChange={(e) => setEditMaskMapping(e.target.checked)}
                          />
                          Mask
                        </label>
                      )}

                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={editKeyfield}
                          onChange={(e) => setEditKeyfield(e.target.checked)}
                        />
                        Keyfield
                      </label>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default value (optional)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editDefaultValue}
                    onChange={(e) => setEditDefaultValue(e.target.value)}
                    placeholder="Enter default value"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
                  onClick={saveEdit}
                >
                  Update
                </button>
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50"
                  onClick={() => setEditingId(null)}
                >
                  Discard
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900">Add Mapping</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mapping Type</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={mappingType}
                    onChange={(e) => setMappingType(e.target.value)}
                  >
                    <option value="Direct">Direct</option>
                    <option value="Expression">Expression</option>
                    <option value="Constant">Constant</option>
                  </select>
                </div>
                <div className="relative" ref={sourceRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Attribute{" "}
                    <span className="relative inline-block group cursor-help">
                      <Info className="w-4 h-4 inline ml-1 text-gray-400" />
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-20">
                        Provisioning gateway attributes
                      </span>
                    </span>{" "}
                    <button
                      type="button"
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      onClick={openHelpModal}
                    >
                      Help
                    </button>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={sourceAttribute}
                    onChange={(e) => filterSource(e.target.value)}
                    onFocus={() => {
                      setFilteredSource(availableSourceAttrs);
                      setSourceDropdownOpen(true);
                    }}
                    placeholder="Select or enter source attribute"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-9 text-gray-400 hover:text-gray-600"
                    onClick={() => setSourceDropdownOpen((o) => !o)}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${sourceDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {sourceDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {filteredSource.length === 0 ? (
                        <div className="px-4 py-2 text-sm text-gray-500">No attributes found</div>
                      ) : (
                        filteredSource.map((attr) => (
                          <button
                            key={attr}
                            type="button"
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50"
                            onClick={() => {
                              setSourceAttribute(attr);
                              setSourceDropdownOpen(false);
                            }}
                          >
                            {attr}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Attribute{" "}
                    <span className="relative inline-block group cursor-help">
                      <Info className="w-4 h-4 inline ml-1 text-gray-400" />
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-20">
                        Target Application account attributes
                      </span>
                    </span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={targetAttribute}
                    onChange={(e) => setTargetAttribute(e.target.value)}
                    placeholder="Enter target attribute"
                  />
                  <div className="mt-2 flex justify-end">
                    <div className="flex items-center gap-4">
                      {isPaycomApp && (
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={maskMapping}
                            onChange={(e) => setMaskMapping(e.target.checked)}
                          />
                          Mask
                        </label>
                      )}

                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={keyfieldMapping}
                          onChange={(e) => setKeyfieldMapping(e.target.checked)}
                        />
                        Keyfield
                      </label>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default value (optional)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={defaultValue}
                    onChange={(e) => setDefaultValue(e.target.value)}
                    placeholder="Enter default value"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
                  onClick={handleAddMapping}
                >
                  Add
                </button>
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50"
                  onClick={() => {
                    setSourceAttribute("");
                    setTargetAttribute("");
                    setDefaultValue("");
                    setKeyfieldMapping(false);
                    setMaskMapping(false);
                    setSourceDropdownOpen(false);
                  }}
                >
                  Discard
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {helpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Source Attribute List</h2>
              <button
                type="button"
                className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                onClick={() => setHelpModalOpen(false)}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="w-64 pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search..."
                  value={helpModalSearch}
                  onChange={(e) => {
                    setHelpModalSearch(e.target.value);
                    setHelpModalPage(1);
                  }}
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
              {helpModalLoading ? (
                <div className="py-8 text-center text-gray-500">Loading...</div>
              ) : helpModalError ? (
                <div className="py-8 text-center text-red-600">{helpModalError}</div>
              ) : (
                <table className="w-full table-auto border border-gray-200 rounded-lg overflow-hidden" style={{ tableLayout: "fixed" }}>
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[40%] min-w-[160px]">Attribute</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[60%]">Description</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {helpModalPageData.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-6 text-center text-sm text-gray-500">No attributes found.</td>
                      </tr>
                    ) : (
                      helpModalPageData.map((row, idx) => (
                        <tr key={`${row.attribute}-${idx}`}>
                          <td className="px-4 py-3 text-sm text-gray-900 align-top whitespace-pre-wrap break-words" style={{ wordBreak: "break-word" }}>
                            {row.attribute}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 align-top whitespace-pre-wrap break-words" style={{ wordBreak: "break-word" }}>
                            {row.description || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex-wrap">
              <div className="flex-1 min-w-0">
                <CustomPagination
                  totalItems={helpModalFiltered.length}
                  currentPage={helpModalPage}
                  totalPages={helpModalTotalPages}
                  pageSize={helpModalPageSize}
                  onPageChange={setHelpModalPage}
                  onPageSizeChange={(newPageSize) => {
                    setHelpModalPageSize(newPageSize);
                    setHelpModalPage(1);
                  }}
                  pageSizeOptions={[10, 20, 50, 100, "all"]}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-100"
                  onClick={() => setHelpModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
                  onClick={() => setHelpModalOpen(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
