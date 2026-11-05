"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History } from "lucide-react";
import Badge from "@/components/Badge";
import { listImportJobs, type ImportJob } from "@/lib/api/rm";
import { JOB_STATUS, artifactTitle, isJobActive, jobDuration } from "./constants";

/** Latest background imports; polls while one is running and refreshes the lists when it finishes. */
export function RecentImports() {
  const qc = useQueryClient();
  const jobs = useQuery({
    queryKey: ["import-jobs"],
    queryFn: () => listImportJobs(8),
    refetchInterval: (q) => (q.state.data?.some(isJobActive) ? 3000 : false),
  });

  const running = useRef(new Set<ImportJob["job_id"]>());
  useEffect(() => {
    const now = new Set((jobs.data ?? []).filter(isJobActive).map((j) => j.job_id));
    const finished = [...running.current].some((id) => !now.has(id));
    running.current = now;
    if (finished) {
      void qc.invalidateQueries({ queryKey: ["privileges"] });
      void qc.invalidateQueries({ queryKey: ["functions"] });
    }
  }, [jobs.data, qc]);

  const rows = jobs.data ?? [];
  if (!rows.length) return null;

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <History className="h-4 w-4" />
        Recent imports
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-left text-slate-600">
              <th className="p-2">Started</th>
              <th className="p-2">Import</th>
              <th className="p-2">File</th>
              <th className="p-2">Rows</th>
              <th className="p-2">Status</th>
              <th className="p-2">By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => {
              const st = JOB_STATUS[j.status] ?? { label: j.status, color: "#64748b" };
              const took = jobDuration(j);
              return (
                <tr key={j.job_id} className="border-b border-slate-100 align-top">
                  <td className="whitespace-nowrap p-2">{new Date(j.created_at).toLocaleString()}</td>
                  <td className="p-2">
                    {artifactTitle(j.artifact_code)} <span className="text-[11px] text-slate-500">· {j.system_type}</span>
                  </td>
                  <td className="break-all p-2">{j.file_name ?? "—"}</td>
                  <td className="whitespace-nowrap p-2 tabular-nums">
                    {j.rows_written != null ? j.rows_written.toLocaleString() : "—"}
                    {!!j.rows_skipped && (
                      <span className="text-amber-700"> +{j.rows_skipped.toLocaleString()} skipped</span>
                    )}
                  </td>
                  <td className="p-2">
                    <Badge label={st.label} color={st.color} />
                    {took && <span className="ml-1 text-[11px] text-slate-500">{took}</span>}
                    {j.status === "FAILED" && j.error_message && (
                      <div className="mt-0.5 max-w-[360px] text-[11px] text-red-800" title={j.error_message}>
                        {j.error_message.length > 160 ? `${j.error_message.slice(0, 160)}…` : j.error_message}
                      </div>
                    )}
                  </td>
                  <td className="p-2">{j.created_by ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
