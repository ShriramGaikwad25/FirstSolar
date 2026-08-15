"use client";

import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { listMitigations, upsertMitigation } from "@/lib/api/rm";
import type { MitigationListRow } from "@/types/rm-mitigations";
import type { RmLookupValue } from "@/hooks/useLookup";
import { useLookup } from "@/hooks/useLookup";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import { Plus, BookOpen } from "lucide-react";

const defaultForm = {
  mitigation_code: "",
  mitigation_name: "",
  description: "",
  control_type: "DETECTIVE",
  control_frequency: "MONTHLY",
} as const;

function lookupLabel(arr: RmLookupValue[] | undefined, code: string): RmLookupValue | undefined {
  return arr?.find((x) => x.value_code === code);
}

export default function MitigationsPageClient() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });

  const types = useLookup("CONTROL_TYPE");
  const freqs = useLookup("CONTROL_FREQUENCY");
  const statuses = useLookup("MITIGATION_STATUS");

  const q = useQuery({
    queryKey: ["mitigations"],
    queryFn: async () => (await listMitigations()).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => upsertMitigation(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mitigations"] });
      setOpen(false);
      setForm({ ...defaultForm });
    },
  });

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-emerald-700 shrink-0" />
          Mitigations &amp; Controls
        </h1>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New control
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {q.isLoading && <div className="p-4 text-sm text-slate-500">Loading…</div>}
        {q.isError && (
          <div className="p-4 text-sm text-red-600">
            {q.error instanceof Error ? q.error.message : String(q.error)}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-sm text-left">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[34%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="py-2.5 px-3 font-medium">Code</th>
                <th className="py-2.5 px-3 font-medium">Name</th>
                <th className="py-2.5 px-3 font-medium">Type</th>
                <th className="py-2.5 px-3 font-medium">Frequency</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.map((m: MitigationListRow) => {
                const typeLk = lookupLabel(types.data, m.control_type);
                const freqLk = lookupLabel(freqs.data, m.control_frequency);
                const statLk = lookupLabel(statuses.data, m.status);
                return (
                  <tr key={m.mitigation_id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 px-3 font-semibold text-gray-900 truncate">{m.mitigation_code}</td>
                    <td className="py-2.5 px-3 text-gray-800 truncate">{m.mitigation_name}</td>
                    <td className="py-2.5 px-3">
                      <Badge
                        label={typeLk?.value_name ?? m.control_type}
                        color={typeLk?.color_hex ?? "#64748b"}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {freqLk?.value_name ?? m.control_frequency}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        label={statLk?.value_name ?? m.status}
                        color={statLk?.color_hex ?? "#64748b"}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!q.isLoading && !q.data?.length && (
          <div className="p-8 text-center text-slate-500 text-sm">No mitigations yet.</div>
        )}
      </div>

      <Modal
        open={open}
        title="New control"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              disabled={save.isPending}
              onClick={() => void save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        {save.isError && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {(save.error as Error)?.message ?? String(save.error)}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Code</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.mitigation_code}
              onChange={(e) => setForm((f) => ({ ...f, mitigation_code: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Name</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.mitigation_name}
              onChange={(e) => setForm((f) => ({ ...f, mitigation_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Control type</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={form.control_type}
              onChange={(e) => setForm((f) => ({ ...f, control_type: e.target.value }))}
            >
              {types.data?.map((x) => (
                <option key={x.value_code} value={x.value_code}>
                  {x.value_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Frequency</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={form.control_frequency}
              onChange={(e) => setForm((f) => ({ ...f, control_frequency: e.target.value }))}
            >
              {freqs.data?.map((x) => (
                <option key={x.value_code} value={x.value_code}>
                  {x.value_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Description</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
