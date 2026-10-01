"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  UserPlus,
  CheckCircle2,
  ShieldOff,
  AlertCircle,
  GitBranch,
  FileText,
  X,
  type LucideIcon,
} from "lucide-react";
import Badge from "@/components/Badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  getViolationDetail,
  addViolationComment,
  assignViolation,
  setViolationStatus,
  searchUsers,
} from "@/lib/api/rm";
import type { UserSearchRow } from "@/types/rm-simulation";

// Code-split: React Flow + the graph component only load when the user
// opens the conflict-path tab.
const ConflictGraph = dynamic(() => import("./ConflictGraph"), {
  ssr: false,
  loading: () => <div className="text-sm text-slate-500">Loading graph…</div>,
});

type Props = {
  violationId: number | null;
  onClose: () => void;
  onMutated?: () => void;
};

const STATUS_TRANSITIONS: Array<{
  code: string;
  label: string;
  icon: LucideIcon;
  variant?: "primary" | "danger";
}> = [
  { code: "MITIGATED", label: "Mark Mitigated", icon: CheckCircle2, variant: "primary" },
  { code: "REMEDIATED", label: "Mark Remediated", icon: CheckCircle2 },
  { code: "EXCEPTED", label: "Mark Excepted", icon: ShieldOff },
  { code: "OPEN", label: "Reopen", icon: AlertCircle, variant: "danger" },
];

const BTN_VARIANT = {
  primary: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
  danger: "border-red-300 bg-white text-red-700 hover:bg-red-50",
  default: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
};

function Btn({
  children,
  onClick,
  icon,
  variant = "default",
  disabled,
  loading,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  variant?: keyof typeof BTN_VARIANT;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${BTN_VARIANT[variant]}`}
    >
      {icon}
      {loading ? "…" : children}
    </button>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function fmtDate(v: string | null | undefined, withTime = false): string {
  if (!v) return "";
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) return "";
  return withTime ? t.toLocaleString() : t.toLocaleDateString();
}

export default function ViolationDrawer({ violationId, onClose, onMutated }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const actor = user?.email;
  const panelRef = useRef<HTMLElement>(null);

  const [tab, setTab] = useState<"detail" | "graph">("detail");
  const [comment, setComment] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const open = violationId !== null;

  // Reset per-violation UI state when a different violation opens.
  const [prevId, setPrevId] = useState(violationId);
  if (prevId !== violationId) {
    setPrevId(violationId);
    setTab("detail");
    setComment("");
    setStatusNotes("");
    setAssigning(false);
    setUserSearch("");
    setDueDate("");
    setNotice(null);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const q = useQuery({
    queryKey: ["violation-detail", violationId],
    enabled: open,
    queryFn: async () => {
      const { data } = await getViolationDetail(violationId!);
      if (!data) throw new Error("Violation not found");
      return data;
    },
  });
  const v = q.data;

  const users = useQuery({
    queryKey: ["user-search", userSearch],
    enabled: assigning && userSearch.length >= 1,
    queryFn: async () => (await searchUsers(userSearch, 10)).data ?? [],
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["violation-detail", violationId] });
    void qc.invalidateQueries({ queryKey: ["violations"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    onMutated?.();
  };
  const fail = (e: unknown) => setNotice({ kind: "err", text: (e as Error).message });

  const commentMut = useMutation({
    mutationFn: async () => addViolationComment(violationId!, comment, actor),
    onSuccess: () => {
      setComment("");
      setNotice({ kind: "ok", text: "Comment added" });
      invalidate();
    },
    onError: fail,
  });

  const statusMut = useMutation({
    mutationFn: async (status: string) =>
      setViolationStatus({
        violation_id: violationId!,
        status,
        notes: statusNotes || undefined,
        actor,
      }),
    onSuccess: (_r, status) => {
      setNotice({ kind: "ok", text: `Status changed to ${status}` });
      setStatusNotes("");
      invalidate();
    },
    onError: fail,
  });

  const assignMut = useMutation({
    mutationFn: async (u: UserSearchRow) =>
      assignViolation({
        violation_id: violationId!,
        assignee_id: u.userid,
        due_date: dueDate || null,
        actor,
      }),
    onSuccess: (_r, u) => {
      setNotice({ kind: "ok", text: `Assigned to ${u.displayname || u.username}` });
      setAssigning(false);
      setUserSearch("");
      setDueDate("");
      invalidate();
    },
    onError: fail,
  });

  const unassignMut = useMutation({
    mutationFn: async () =>
      assignViolation({ violation_id: violationId!, assignee_id: null, due_date: null, actor }),
    onSuccess: () => {
      setNotice({ kind: "ok", text: "Unassigned" });
      invalidate();
    },
    onError: fail,
  });

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={v ? `Violation #${v.violation_id}` : "Violation"}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[640px] flex-col bg-slate-50 shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {v ? `Violation #${v.violation_id}` : "Violation"}
          </h3>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {notice && (
            <div
              role="status"
              className={`mb-3 rounded border px-3 py-2 text-sm ${
                notice.kind === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {notice.text}
            </div>
          )}
          {q.isLoading && <div className="text-sm text-slate-500">Loading…</div>}
          {q.error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {(q.error as Error).message}
            </div>
          )}

          {v && (
            <>
              <div role="tablist" className="mb-3.5 flex gap-1 border-b border-gray-200">
                {(
                  [
                    { id: "detail", label: "Detail", icon: FileText },
                    { id: "graph", label: "Conflict path", icon: GitBranch },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] ${
                      tab === t.id
                        ? "border-blue-600 font-semibold text-blue-600"
                        : "border-transparent font-medium text-slate-600"
                    }`}
                  >
                    <t.icon className="h-3.5 w-3.5" /> {t.label}
                  </button>
                ))}
              </div>

              {tab === "graph" && <ConflictGraph violationId={v.violation_id} />}

              {tab === "detail" && (
                <div className="flex flex-col gap-4">
                  {/* Header */}
                  <div>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge label={v.severity_name ?? v.severity} color={v.severity_color ?? undefined} />
                      <Badge
                        label={v.status_name ?? v.violation_status}
                        color={v.status_color ?? undefined}
                      />
                      {v.risk_score != null && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                          Risk {v.risk_score}
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-semibold text-gray-900">{v.rule_code}</h4>
                    {v.rule_name && <div className="text-sm text-slate-500">{v.rule_name}</div>}
                  </div>

                  {/* User */}
                  <Section title="User">
                    <div className="font-semibold">{v.display_name || v.username}</div>
                    <div className="text-xs text-slate-500">
                      {v.username}
                      {v.email ? ` · ${v.email}` : ""}
                    </div>
                  </Section>

                  {/* Assignment */}
                  <Section
                    title="Assignment"
                    action={
                      v.assignee_id ? (
                        <Btn onClick={() => unassignMut.mutate()} loading={unassignMut.isPending}>
                          Unassign
                        </Btn>
                      ) : (
                        <Btn icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setAssigning((b) => !b)}>
                          {assigning ? "Cancel" : "Assign"}
                        </Btn>
                      )
                    }
                  >
                    {v.assignee_id ? (
                      <div>
                        <div className="font-semibold">{v.assignee_name}</div>
                        <div className="text-xs text-slate-500">
                          Assigned {fmtDate(v.assigned_at, true)}
                          {v.due_date && ` · due ${fmtDate(v.due_date)}`}
                        </div>
                      </div>
                    ) : assigning ? (
                      <div className="flex flex-col gap-2">
                        <input
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                          placeholder="Search user…"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          autoFocus
                        />
                        <input
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                          type="date"
                          aria-label="Due date (optional)"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                        />
                        {users.data && users.data.length > 0 && (
                          <div className="max-h-[180px] overflow-auto rounded-md border border-gray-200">
                            {users.data.map((u) => (
                              <button
                                key={u.userid}
                                type="button"
                                onClick={() => assignMut.mutate(u)}
                                disabled={assignMut.isPending}
                                className="block w-full border-b border-slate-100 px-2.5 py-2 text-left last:border-0 hover:bg-slate-50"
                              >
                                <div className="text-[13px] font-semibold">{u.displayname || u.username}</div>
                                <div className="text-[11px] text-slate-500">
                                  {u.username}
                                  {u.department ? ` · ${u.department}` : ""}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Unassigned</div>
                    )}
                  </Section>

                  {/* Status transitions */}
                  <Section title="Change status">
                    <input
                      className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Reason / notes (optional)"
                      value={statusNotes}
                      onChange={(e) => setStatusNotes(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_TRANSITIONS.filter((t) => t.code !== v.violation_status).map((t) => (
                        <Btn
                          key={t.code}
                          variant={t.variant}
                          icon={<t.icon className="h-3.5 w-3.5" />}
                          loading={statusMut.isPending}
                          onClick={() => statusMut.mutate(t.code)}
                        >
                          {t.label}
                        </Btn>
                      ))}
                    </div>
                  </Section>

                  {/* Detail breakdown */}
                  {v.details.length > 0 && (
                    <Section title={`Conflicting functions (${v.details.length})`}>
                      {v.details.map((d) => (
                        <div
                          key={d.violation_detail_id}
                          className="flex flex-wrap items-center gap-2 py-1 text-[13px]"
                        >
                          {d.system_type && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
                              {d.system_type}
                            </span>
                          )}
                          <b>{d.function_code}</b>
                          {d.privilege_code && <span className="text-slate-500">via {d.privilege_code}</span>}
                          {d.data_scope_name ? (
                            <span
                              className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-800"
                              title="Org scope where this side applies — for SAME_SCOPE rules, both sides matched here"
                            >
                              {(d.data_scope_type ?? "SCOPE").replaceAll("_", " ")}: {d.data_scope_name}
                            </span>
                          ) : d.is_global_scope ? (
                            <span
                              className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800"
                              title="Unscoped grant — overlaps every org scope"
                            >
                              GLOBAL
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* Comments */}
                  <Section title={`Comments (${v.comments.length})`}>
                    <div className="mb-3 flex flex-col">
                      {v.comments.map((c) => (
                        <div key={c.comment_id} className="flex gap-2.5 border-b border-slate-100 py-2 last:border-0">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-800">
                            {(c.posted_by_name ?? "?").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs">
                              <span className="font-semibold text-gray-900">{c.posted_by_name ?? "Unknown"}</span>
                              <span className="ml-2 text-slate-500">{fmtDate(c.posted_at, true)}</span>
                            </div>
                            <div className="whitespace-pre-wrap text-[13px] text-gray-800">{c.body}</div>
                          </div>
                        </div>
                      ))}
                      {v.comments.length === 0 && <div className="text-sm text-slate-500">No comments yet.</div>}
                    </div>
                    <div className="flex items-start gap-1.5">
                      <textarea
                        className="flex-1 resize-y rounded-md border border-gray-300 px-3 py-2 text-sm"
                        rows={2}
                        placeholder="Add a comment…"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                      <Btn
                        variant="primary"
                        icon={<Send className="h-3.5 w-3.5" />}
                        disabled={!comment.trim()}
                        loading={commentMut.isPending}
                        onClick={() => commentMut.mutate()}
                      >
                        Send
                      </Btn>
                    </div>
                  </Section>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-200 bg-white px-4 py-3">
          <Btn onClick={onClose}>Close</Btn>
        </div>
      </aside>
    </>
  );
}
