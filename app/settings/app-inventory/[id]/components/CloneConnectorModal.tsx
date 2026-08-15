"use client";

import { useState } from "react";
import { X } from "lucide-react";

type CopyOptions = {
  schemaMappings: boolean;
  ouRoutingMappings: boolean;
  directorySettings: boolean;
  advancedSettings: boolean;
};

const DEFAULT_COPY_OPTIONS: CopyOptions = {
  schemaMappings: true,
  ouRoutingMappings: false,
  directorySettings: true,
  advancedSettings: true,
};

export default function CloneConnectorModal({
  open,
  sourceConnectorName,
  onClose,
  onCreated,
}: {
  open: boolean;
  sourceConnectorName?: string;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [connectorName, setConnectorName] = useState("");
  const [targetDomain, setTargetDomain] = useState("");
  const [technicalOwner, setTechnicalOwner] = useState("");
  const [copyOptions, setCopyOptions] = useState<CopyOptions>(DEFAULT_COPY_OPTIONS);

  if (!open) return null;

  const toggleCopyOption = (key: keyof CopyOptions) =>
    setCopyOptions((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleCreate = () => {
    const name = connectorName.trim() || `${sourceConnectorName ?? "Connector"}_Clone`;
    onCreated(name);
    setConnectorName("");
    setTargetDomain("");
    setTechnicalOwner("");
    setCopyOptions(DEFAULT_COPY_OPTIONS);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Clone AD Connector</h2>
            <p className="mt-1 text-sm text-gray-500">
              Create a draft connector using selected reusable settings.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-t border-gray-200" />

        <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                New Connector Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={connectorName}
                onChange={(e) => setConnectorName(e.target.value)}
                placeholder="e.g. AD_DPWorld_Abu_Dhabi"
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                Target AD Domain <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={targetDomain}
                onChange={(e) => setTargetDomain(e.target.value)}
                placeholder="e.g. abudhabi.dpworld.local"
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">Technical Owner</label>
              <input
                type="text"
                value={technicalOwner}
                onChange={(e) => setTechnicalOwner(e.target.value)}
                placeholder="Full name"
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-900 mb-2">Copy from current connector</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={copyOptions.schemaMappings}
                  onChange={() => toggleCopyOption("schemaMappings")}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                Schema mappings
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={copyOptions.ouRoutingMappings}
                  onChange={() => toggleCopyOption("ouRoutingMappings")}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                OU routing mappings
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={copyOptions.directorySettings}
                  onChange={() => toggleCopyOption("directorySettings")}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                Directory settings
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={copyOptions.advancedSettings}
                  onChange={() => toggleCopyOption("advancedSettings")}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                Advanced settings
              </label>
            </div>
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Credentials and secret paths are never copied. The cloned connector will be created in Draft
            status.
          </div>
        </div>

        <div className="border-t border-gray-200" />

        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-md text-sm font-semibold text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!connectorName.trim() || !targetDomain.trim()}
            className="px-5 py-2.5 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Draft Connector
          </button>
        </div>
      </div>
    </div>
  );
}
