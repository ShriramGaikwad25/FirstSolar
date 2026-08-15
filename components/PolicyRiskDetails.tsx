"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Edit3 } from "lucide-react";

export interface PolicyRiskEntitlementData {
  name: string;
  description?: string;
  type?: string;
  applicationName?: string;
  risk?: string | null;
  lastReviewed?: string;
  lastSync?: string;
  appInstanceId?: string;
  entitlementId?: string;
}

interface PolicyRiskDetailsProps {
  entitlementData: PolicyRiskEntitlementData | null;
}

const PolicyRiskDetails: React.FC<PolicyRiskDetailsProps> = ({ entitlementData }) => {
  const [policyRiskLoading, setPolicyRiskLoading] = useState(false);
  const [policyRiskError, setPolicyRiskError] = useState<string | null>(null);
  const [policyRiskData, setPolicyRiskData] = useState<any>(null);

  const [policySelections, setPolicySelections] = useState<
    Array<{ controls: string; accepted: string; lastUpdate: string }>
  >([]);
  const [policyOpen, setPolicyOpen] = useState<boolean[]>([]);
  const [editStates, setEditStates] = useState<{ controls: boolean[]; accepted: boolean[] }>(
    { controls: [], accepted: [] }
  );

  useEffect(() => {
    if (entitlementData?.entitlementId) {
      fetchPolicyRiskData();
    } else {
      setPolicyRiskData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitlementData?.entitlementId]);

  useEffect(() => {
    if (policyRiskData && Array.isArray(policyRiskData.items)) {
      const today = new Date().toISOString().slice(0, 10);
      const controlOptions = [
        "Integrated with Cloud Guard",
        "Periodic Access Review",
        "MFA Setup",
        "Dynamic Group Controls",
      ];
      const acceptedOptions = ["Yes", "No", "Under Review"];

      setPolicySelections(
        policyRiskData.items.map(() => ({
          controls: controlOptions[Math.floor(Math.random() * controlOptions.length)],
          accepted: acceptedOptions[Math.floor(Math.random() * acceptedOptions.length)],
          lastUpdate: today,
        }))
      );
      setPolicyOpen(policyRiskData.items.map(() => false));
      setEditStates({
        controls: policyRiskData.items.map(() => false),
        accepted: policyRiskData.items.map(() => false),
      });
    } else {
      setPolicySelections([]);
      setPolicyOpen([]);
      setEditStates({ controls: [], accepted: [] });
    }
  }, [policyRiskData]);

  const fetchPolicyRiskData = async () => {
    setPolicyRiskLoading(true);
    setPolicyRiskError(null);
    setPolicyRiskData(null);
    try {
      const entitlementId = entitlementData?.entitlementId;
      if (entitlementId) {
        const resp = await fetch(
          `https://preview.keyforge.ai/entities/api/v1/ACMECOM/policyrisk/entitlement/${encodeURIComponent(entitlementId)}`
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        setPolicyRiskData(json);
      } else {
        setPolicyRiskError("Missing entitlementId");
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("Policy risk fetch failed:", e);
      setPolicyRiskError(e?.message || "Failed to load policy risk");
    } finally {
      setPolicyRiskLoading(false);
    }
  };

  const toggleEditMode = (type: "controls" | "accepted", index: number) => {
    setEditStates((prev) => ({
      ...prev,
      [type]: prev[type].map((isEdit, i) => (i === index ? !isEdit : isEdit)),
    }));
  };

  if (!entitlementData) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-blue-800 break-words whitespace-normal">
            Policy Risk Details
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-4">
        <div className="space-y-6">
          <div className="space-y-3">
            {policyRiskLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                <span className="ml-3 text-sm text-gray-600">Loading policy risk…</span>
              </div>
            )}
            {policyRiskError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="text-sm text-red-600 mt-1">{policyRiskError}</p>
              </div>
            )}
            {!policyRiskLoading &&
              !policyRiskError &&
              policyRiskData &&
              Array.isArray(policyRiskData.items) &&
              policyRiskData.items.length > 0 && (
                <div className="space-y-3">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4 text-sm space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase text-gray-500 font-medium">Policy Name:</span>
                      <span className="font-semibold text-gray-900">
                        {policyRiskData.items[0]?.policy_name || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase text-gray-500 font-medium">Risk Level:</span>
                      <span className="font-semibold text-gray-900 border border-red-300 bg-red-50 px-2 py-1 rounded text-red-800">
                        {entitlementData?.risk ?? "-"}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-gray-500 font-medium mb-1">Compartment ID</div>
                      <div className="font-semibold text-gray-900 break-all bg-gray-50 px-2 py-1 rounded border text-xs">
                        {policyRiskData.items[0]?.compartment || "-"}
                      </div>
                    </div>
                  </div>

                  {policyRiskData.items.map((it: any, idx: number) => (
                    <div key={idx} className="border border-gray-200 rounded-xl shadow-sm overflow-hidden bg-white">
                      <button
                        className="w-full flex items-start justify-between px-4 py-3 bg-white font-semibold text-sm hover:bg-gray-50 transition-colors group"
                        onClick={() =>
                          setPolicyOpen((prev) => prev.map((v, i) => (i === idx ? !v : v)))
                        }
                        aria-expanded={policyOpen[idx] ? "true" : "false"}
                      >
                        <span className="flex-1 text-left mr-3 whitespace-pre-wrap break-words text-blue-600 leading-relaxed">
                          {it.statement || "Statement"}
                        </span>
                        <div className="flex-shrink-0">
                          {policyOpen[idx] ? (
                            <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                          )}
                        </div>
                      </button>
                      {policyOpen[idx] && (
                        <div className="p-4 text-sm space-y-4 bg-gray-50 border-t border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="text-xs uppercase text-gray-500 font-medium">Risk Level:</span>
                            <span className="justify-between font-semibold text-gray-900 border border-red-300 bg-red-50 px-2 py-1 rounded text-red-800">
                              {it.risk_level || "-"}
                            </span>
                          </div>
                          <div className="bg-white p-3 rounded-lg border">
                            <strong className="text-gray-700 block mb-2">Risk Factors:</strong>
                            <div className="text-gray-700 leading-relaxed">{it.explanation || "-"}</div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs text-gray-500 mb-2 font-medium">Mitigating Controls</label>
                              <div className="flex items-center gap-2">
                                <select
                                  value={policySelections[idx]?.controls || ""}
                                  onChange={(e) => {
                                    setPolicySelections((prev) =>
                                      prev.map((s, i) => (i === idx ? { ...s, controls: e.target.value } : s))
                                    );
                                    setEditStates((prev) => ({
                                      ...prev,
                                      controls: prev.controls.map((isEdit, i) => (i === idx ? false : isEdit)),
                                    }));
                                  }}
                                  disabled={!editStates.controls[idx]}
                                  className={`border border-gray-300 rounded-lg px-2 py-1.5 text-xs transition-colors flex-1 ${
                                    editStates.controls[idx]
                                      ? "bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                      : "bg-gray-100 text-gray-500 cursor-not-allowed"
                                  }`}
                                >
                                  <option>Integrated with Cloud Guard</option>
                                  <option>Periodic Access Review</option>
                                  <option>MFA Setup</option>
                                  <option>Dynamic Group Controls</option>
                                </select>
                                <button
                                  onClick={() => toggleEditMode("controls", idx)}
                                  className="p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                                  title="Edit controls"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-gray-600 hover:text-blue-600" />
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-2 font-medium">Risk Accepted</label>
                              <div className="flex items-center gap-2">
                                <select
                                  value={policySelections[idx]?.accepted || "Under Review"}
                                  onChange={(e) => {
                                    setPolicySelections((prev) =>
                                      prev.map((s, i) => (i === idx ? { ...s, accepted: e.target.value } : s))
                                    );
                                    setEditStates((prev) => ({
                                      ...prev,
                                      accepted: prev.accepted.map((isEdit, i) => (i === idx ? false : isEdit)),
                                    }));
                                  }}
                                  disabled={!editStates.accepted[idx]}
                                  className={`border border-gray-300 rounded-lg px-2 py-1.5 text-xs transition-colors flex-1 ${
                                    editStates.accepted[idx]
                                      ? "bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                      : "bg-gray-100 text-gray-500 cursor-not-allowed"
                                  }`}
                                >
                                  <option>Yes</option>
                                  <option>No</option>
                                  <option>Under Review</option>
                                </select>
                                <button
                                  onClick={() => toggleEditMode("accepted", idx)}
                                  className="p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                                  title="Edit risk acceptance"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-gray-600 hover:text-blue-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-2 font-medium">Last Update</label>
                            <input
                              type="date"
                              disabled
                              value={policySelections[idx]?.lastUpdate || new Date().toISOString().slice(0, 10)}
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-100 cursor-not-allowed w-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolicyRiskDetails;


