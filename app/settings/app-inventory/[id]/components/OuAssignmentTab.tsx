"use client";

import { useCallback, useMemo, useState } from "react";
import { X } from "lucide-react";

type OuMapping = {
  id: string;
  attribute: string;
  operator: string;
  value: string;
  priority: number;
  targetOu: string;
  active: boolean;
};

const ATTRIBUTE_OPTIONS = ["department", "employeeType", "location", "department + employeeType"];

const OPERATOR_OPTIONS = ["Equals", "Matches all"];

let mappingIdCounter = 0;
function nextMappingId(): string {
  mappingIdCounter += 1;
  return `ou-new-${mappingIdCounter}`;
}

type MappingFormState = {
  attribute: string;
  operator: string;
  value: string;
  priority: string;
  targetOu: string;
};

function emptyForm(nextPriority: number): MappingFormState {
  return {
    attribute: ATTRIBUTE_OPTIONS[0],
    operator: OPERATOR_OPTIONS[0],
    value: "",
    priority: String(nextPriority),
    targetOu: "",
  };
}

export default function OuAssignmentTab({
  onCancel,
}: {
  appName?: string;
  onCancel?: () => void;
}) {
  const [mappings, setMappings] = useState<OuMapping[]>([]);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MappingFormState>(emptyForm(1));

  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const sortedMappings = useMemo(
    () => [...mappings].sort((a, b) => a.priority - b.priority),
    [mappings]
  );

  const filteredMappings = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sortedMappings;
    return sortedMappings.filter((m) => {
      const haystack = [m.attribute, m.operator, m.value, m.targetOu].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [sortedMappings, search]);

  const openAddModal = useCallback(() => {
    setEditingId(null);
    const nextPriority = mappings.length ? Math.max(...mappings.map((m) => m.priority)) + 1 : 1;
    setForm(emptyForm(nextPriority));
    setModalOpen(true);
  }, [mappings]);

  const openEditModal = useCallback((mapping: OuMapping) => {
    setEditingId(mapping.id);
    setForm({
      attribute: mapping.attribute,
      operator: mapping.operator,
      value: mapping.value,
      priority: String(mapping.priority),
      targetOu: mapping.targetOu,
    });
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const removeMapping = useCallback((id: string) => {
    setMappings((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const saveMapping = useCallback(() => {
    const value = form.value.trim();
    const targetOu = form.targetOu.trim();
    if (!value || !targetOu) return;
    const priority = Number.parseInt(form.priority, 10) || 1;

    setMappings((prev) => {
      if (editingId) {
        return prev.map((m) =>
          m.id === editingId
            ? { ...m, attribute: form.attribute, operator: form.operator, value, priority, targetOu }
            : m
        );
      }
      return [
        ...prev,
        {
          id: nextMappingId(),
          attribute: form.attribute,
          operator: form.operator,
          value,
          priority,
          targetOu,
          active: true,
        },
      ];
    });
    setModalOpen(false);
  }, [editingId, form]);

  const saveAllMappings = useCallback(() => {
    setSavedMessage("OU mappings saved.");
    window.setTimeout(() => setSavedMessage(null), 3000);
  }, []);

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search mappings"
          className="w-64 px-4 py-2.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            + Add Mapping
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 tracking-wide">PRIORITY</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 tracking-wide">USER ATTRIBUTE</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 tracking-wide">OPERATOR</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 tracking-wide">ATTRIBUTE VALUE</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 tracking-wide">TARGET OU</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 tracking-wide">STATUS</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 tracking-wide">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredMappings.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">
                  No mappings found.
                </td>
              </tr>
            )}
            {filteredMappings.map((m) => (
              <tr key={m.id} className="border-b border-gray-100 last:border-b-0">
                <td className="px-5 py-4 text-gray-700">{m.priority}</td>
                <td className="px-5 py-4 text-blue-700 font-medium">{m.attribute}</td>
                <td className="px-5 py-4 text-gray-700">{m.operator}</td>
                <td className="px-5 py-4 text-blue-700">{m.value}</td>
                <td className="px-5 py-4 text-blue-700 font-mono text-xs">{m.targetOu}</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      m.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {m.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(m)}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold text-gray-900 border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMapping(m.id)}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3 mt-6">
        {savedMessage && <span className="text-sm text-emerald-600 font-medium">{savedMessage}</span>}
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-full text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={saveAllMappings}
          className="px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          Save OU Mappings
        </button>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? "Edit OU Mapping" : "Add OU Mapping"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">Map one or more user attributes to a target OU.</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
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
                    User Attribute <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.attribute}
                    onChange={(e) => setForm((f) => ({ ...f, attribute: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {ATTRIBUTE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Operator</label>
                  <select
                    value={form.operator}
                    onChange={(e) => setForm((f) => ({ ...f, operator: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {OPERATOR_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                    Attribute Value <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    placeholder="e.g. Legal"
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Priority</label>
                  <input
                    type="number"
                    min={1}
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Target OU <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.targetOu}
                  onChange={(e) => setForm((f) => ({ ...f, targetOu: e.target.value }))}
                  placeholder="OU=Legal,OU=Users,DC=..."
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1.5 text-xs text-gray-500">Enter the distinguished name manually.</p>
              </div>
            </div>

            <div className="border-t border-gray-200" />

            <div className="flex items-center justify-end gap-3 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 rounded-md text-sm font-semibold text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveMapping}
                className="px-5 py-2.5 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                {editingId ? "Save Changes" : "Add Mapping"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
