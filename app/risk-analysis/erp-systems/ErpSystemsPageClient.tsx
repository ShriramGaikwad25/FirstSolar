"use client";

import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { listErpInstances, upsertErpInstance, listExtractTemplates } from "@/lib/api/rm";
import type { ErpInstance, ExtractTemplate } from "@/types/rm-erp";
import { useLookup } from "@/hooks/useLookup";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import { Database, Plus } from "lucide-react";

const defaultForm = {
  instance_code: "",
  instance_name: "",
  system_type: "FUSION",
  environment: "Production",
  endpoint_url: "",
  auth_type: "BASIC",
} as const;

export default function ErpSystemsPageClient() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [systemType, setSystemType] = useState("FUSION");
  const [form, setForm] = useState({ ...defaultForm });

  const systemTypes = useLookup("SYSTEM_TYPE");

  const instances = useQuery({
    queryKey: ["erp-instances"],
    queryFn: async () => (await listErpInstances()).data ?? [],
  });

  const templates = useQuery({
    queryKey: ["extract-templates", systemType],
    queryFn: async () => (await listExtractTemplates(systemType)).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => upsertErpInstance(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["erp-instances"] });
      setOpen(false);
      setForm({ ...defaultForm });
    },
  });

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Database className="h-6 w-6 text-slate-600 shrink-0" />
          ERP systems
        </h1>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Connect ERP
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mt-0 mb-3">Registered instances</h2>
        {instances.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {instances.isError && (
          <p className="text-sm text-red-600">
            {instances.error instanceof Error ? instances.error.message : String(instances.error)}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed border-collapse text-sm text-left">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[32%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="py-2.5 px-3 font-medium">Code</th>
                <th className="py-2.5 px-3 font-medium">Name</th>
                <th className="py-2.5 px-3 font-medium">System</th>
                <th className="py-2.5 px-3 font-medium">Environment</th>
                <th className="py-2.5 px-3 font-medium">Endpoint</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(instances.data as ErpInstance[] | undefined)?.map((i) => (
                <tr key={i.erp_instance_id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2.5 px-3 font-semibold truncate">{i.instance_code}</td>
                  <td className="py-2.5 px-3 truncate">{i.instance_name}</td>
                  <td className="py-2.5 px-3">
                    <Badge
                      label={i.system_type_name ?? i.system_type}
                      color={i.system_color ?? "#64748b"}
                    />
                  </td>
                  <td className="py-2.5 px-3">{i.environment}</td>
                  <td className="py-2.5 px-3 text-slate-500 text-xs truncate" title={i.endpoint_url ?? ""}>
                    {i.endpoint_url}
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge label={i.status} />
                  </td>
                </tr>
              ))}
              {instances.data && (instances.data as ErpInstance[]).length === 0 && !instances.isLoading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No ERP instances yet — use Connect ERP.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h2 className="text-lg font-semibold text-gray-900 m-0">Extract templates</h2>
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm w-full sm:w-60"
            value={systemType}
            onChange={(e) => setSystemType(e.target.value)}
          >
            {systemTypes.data?.map((s) => (
              <option key={s.value_code} value={s.value_code}>
                {s.value_name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-slate-500 mb-3">
          Canonical artifacts per ERP. The ingestion worker reads these records, runs the query, and
          lands data in the staging tables. Add or override per tenant without code changes.
        </p>
        {templates.isLoading && <p className="text-sm text-slate-500">Loading templates…</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-sm text-left">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[22%]" />
              <col className="w-[44%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="py-2.5 px-3 font-medium">Artifact</th>
                <th className="py-2.5 px-3 font-medium">Kind</th>
                <th className="py-2.5 px-3 font-medium">Landing table</th>
                <th className="py-2.5 px-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {(templates.data as ExtractTemplate[] | undefined)?.map((t) => (
                <tr key={t.extract_id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2.5 px-3">
                    <b className="truncate block">{t.artifact_code}</b>
                    {t.artifact_name && (
                      <div className="text-slate-500 text-xs mt-0.5 truncate">{t.artifact_name}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge label={t.source_kind} />
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 text-xs font-mono truncate">{t.landing_table}</td>
                  <td className="py-2.5 px-3 truncate">{t.description}</td>
                </tr>
              ))}
              {templates.data && (templates.data as ExtractTemplate[]).length === 0 && !templates.isLoading && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No templates for this system type.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        title="Connect ERP instance"
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
          <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {(save.error as Error).message}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">System type</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={form.system_type}
              onChange={(e) => setForm((f) => ({ ...f, system_type: e.target.value }))}
            >
              {systemTypes.data?.map((s) => (
                <option key={s.value_code} value={s.value_code}>
                  {s.value_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Instance code</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.instance_code}
              onChange={(e) => setForm((f) => ({ ...f, instance_code: e.target.value }))}
              placeholder="FUSION_PROD"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Instance name</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.instance_name}
              onChange={(e) => setForm((f) => ({ ...f, instance_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Environment</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.environment}
              onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Endpoint URL</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.endpoint_url}
              onChange={(e) => setForm((f) => ({ ...f, endpoint_url: e.target.value }))}
              placeholder="https://ecnd-test.fa.us2.oraclecloud.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Auth type</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={form.auth_type}
              onChange={(e) => setForm((f) => ({ ...f, auth_type: e.target.value }))}
            >
              <option value="BASIC">BASIC</option>
              <option value="OAUTH2">OAUTH2</option>
              <option value="JWT">JWT</option>
              <option value="DB">DB</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
