"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { approveException, listExceptions } from "@/lib/api/rm";
import type { ExceptionListRow } from "@/types/rm-exceptions";
import { useLookup } from "@/hooks/useLookup";
import Badge from "@/components/Badge";
import { Flag } from "lucide-react";

function formatDate(s: string | null | undefined): string {
  if (s == null || s === "") return "—";
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? String(s) : t.toLocaleDateString();
}

export default function ExceptionsPageClient() {
  const qc = useQueryClient();
  const statuses = useLookup("EXCEPTION_STATUS");

  const q = useQuery({
    queryKey: ["exceptions"],
    queryFn: async () => {
      const r = await listExceptions();
      return r.data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (exceptionId: number) =>
      approveException(exceptionId, "Approved from UI"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["exceptions"] });
    },
  });

  const lk = (code: string) => statuses.data?.find((x) => x.value_code === code);

  return (
    <div className="w-full min-w-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Flag className="h-6 w-6 text-amber-600 shrink-0" />
          Exceptions &amp; Risk Acceptance
        </h1>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {q.isLoading && <div className="p-4 text-sm text-slate-500">Loading…</div>}
        {q.isError && (
          <div className="p-4 text-sm text-red-600">
            {q.error instanceof Error ? q.error.message : String(q.error)}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] table-fixed border-collapse text-sm text-left">
            <colgroup>
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[24%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="py-2.5 px-3 font-medium">Exception</th>
                <th className="py-2.5 px-3 font-medium">Violation</th>
                <th className="py-2.5 px-3 font-medium">Requested by</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium">Effective</th>
                <th className="py-2.5 px-3 font-medium">Expires</th>
                <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.map((e: ExceptionListRow) => {
                const st = lk(e.exception_status);
                return (
                  <tr key={e.exception_id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 px-3 tabular-nums font-medium">#{e.exception_id}</td>
                    <td className="py-2.5 px-3 tabular-nums">#{e.violation_id}</td>
                    <td className="py-2.5 px-3 text-gray-800 truncate">
                      {e.requested_by_name ?? e.requested_by ?? "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        label={st?.value_name ?? e.exception_status}
                        color={st?.color_hex ?? "#64748b"}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                      {formatDate(e.effective_from)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                      {formatDate(e.effective_to)}
                    </td>
                    <td className="py-2.5 pl-3 pr-2 text-right whitespace-nowrap">
                      {e.exception_status === "PENDING" && (
                        <button
                          type="button"
                          className="rounded-md border border-blue-600 bg-blue-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                          disabled={approve.isPending}
                          onClick={() => void approve.mutate(e.exception_id)}
                        >
                          {approve.isPending ? "…" : "Approve"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!q.isLoading && !q.data?.length && (
          <div className="p-8 text-center text-slate-500 text-sm">No exceptions.</div>
        )}
        {approve.isError && (
          <div className="p-3 text-sm text-red-600 border-t border-gray-100">
            {(approve.error as Error)?.message ?? String(approve.error)}
          </div>
        )}
      </div>
    </div>
  );
}
