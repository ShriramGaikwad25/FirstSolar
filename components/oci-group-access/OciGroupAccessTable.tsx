"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OciGroupAccessSummary } from "@/types/oci-group";
import { TablePagination } from "@/components/oci-group-access/TablePagination";

const WRAP_CELL = "whitespace-normal break-words [overflow-wrap:anywhere]";
const TH = `px-3 py-3.5 text-left text-[11px] font-semibold text-blue-800 uppercase tracking-wide align-middle bg-blue-50/80 border-b border-blue-100 ${WRAP_CELL}`;
const TH_CENTER = `${TH} text-center`;
const TD = `px-3 py-3 align-top text-sm leading-snug text-gray-800 bg-white ${WRAP_CELL}`;
const TD_CENTER = `${TD} text-center tabular-nums whitespace-nowrap`;
const TD_MUTED = `${TD} text-gray-600`;

export function groupAccessDetailHref(groupName: string): string {
  return `/oci-policy-analysis/group-access/${encodeURIComponent(groupName)}`;
}

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function statusClass(status: string): string {
  const lower = status.toLowerCase();
  if (lower === "active") return "bg-green-100 text-green-800";
  if (lower === "inactive") return "bg-gray-100 text-gray-700";
  if (lower === "deleted") return "bg-red-100 text-red-800";
  return "bg-blue-100 text-blue-800";
}

export function OciGroupAccessTable({ groups }: { groups: OciGroupAccessSummary[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [groups.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageGroups = groups.slice(start, start + pageSize);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th scope="col" className={TH}>
                Name
              </th>
              <th scope="col" className={TH}>
                Created On
              </th>
              <th scope="col" className={TH}>
                Created By
              </th>
              <th scope="col" className={TH_CENTER}>
                Members
              </th>
              <th scope="col" className={TH_CENTER}>
                Statements
              </th>
              <th scope="col" className={TH_CENTER}>
                Resources
              </th>
              <th scope="col" className={TH}>
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pageGroups.map((group) => (
              <tr key={group.id} className="hover:bg-slate-50">
                <td className={TD}>
                  <Link
                    href={groupAccessDetailHref(group.name)}
                    className={`font-medium text-blue-700 hover:text-blue-900 hover:underline ${WRAP_CELL}`}
                  >
                    {group.name}
                  </Link>
                  {group.description ? (
                    <p className={`mt-0.5 text-xs leading-snug text-gray-500 ${WRAP_CELL}`}>
                      {group.description}
                    </p>
                  ) : null}
                </td>
                <td className={TD_MUTED}>{formatDateOnly(group.createdOn)}</td>
                <td className={TD_MUTED}>{group.createdBy || "—"}</td>
                <td className={TD_CENTER}>{group.memberCount.toLocaleString()}</td>
                <td className={TD_CENTER}>{group.statementCount.toLocaleString()}</td>
                <td className={TD_CENTER}>{group.resourceCount.toLocaleString()}</td>
                <td className={TD}>
                  {group.status ? (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(group.status)}`}
                    >
                      {group.status}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination
        totalItems={groups.length}
        page={safePage}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
