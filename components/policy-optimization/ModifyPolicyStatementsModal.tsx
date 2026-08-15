"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import Modal from "@/components/Modal";
import {
  MODAL_TH,
  MODAL_TD,
  POLICY_NAME_WRAP_TD,
  PolicyStatementTableColgroup,
  STATEMENT_TEXT_TD,
} from "@/components/policy-optimization/policyStatementModalTable";
import type { PolicyOptimizationGrant } from "@/types/oci-policy";

function grantKey(grant: PolicyOptimizationGrant): string {
  return `${grant.policyName}::${grant.ref}`;
}

function dedupeGrants(grants: PolicyOptimizationGrant[]): PolicyOptimizationGrant[] {
  const seen = new Set<string>();
  return grants.filter((grant) => {
    const key = grantKey(grant);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function grantsForModify(row: {
  redundantGrants?: PolicyOptimizationGrant[];
  coveredBy?: PolicyOptimizationGrant[];
  policyName?: string;
  statement?: string;
  rawStatement?: string;
  coveredByStatement?: string | null;
  coveredByRaw?: string | null;
}): PolicyOptimizationGrant[] {
  const combined = dedupeGrants([
    ...(row.redundantGrants ?? []),
    ...(row.coveredBy ?? []),
  ]);
  if (combined.length > 0) return combined;

  const fallback: PolicyOptimizationGrant[] = [];
  if (row.policyName && row.rawStatement) {
    fallback.push({
      policyName: row.policyName,
      ref: row.statement ?? "—",
      raw: row.rawStatement,
    });
  }
  if (row.policyName && row.coveredByRaw) {
    fallback.push({
      policyName: row.policyName,
      ref: row.coveredByStatement ?? "—",
      raw: row.coveredByRaw,
    });
  }
  return dedupeGrants(fallback);
}

export function ModifyPolicyStatementsModal({
  open,
  onClose,
  initialGrants,
}: {
  open: boolean;
  onClose: () => void;
  initialGrants: PolicyOptimizationGrant[];
}) {
  const [grants, setGrants] = useState<PolicyOptimizationGrant[]>(initialGrants);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PolicyOptimizationGrant | null>(null);
  const [deleteComment, setDeleteComment] = useState("");
  const [deleteCommentError, setDeleteCommentError] = useState<string | null>(null);
  const lastSyncedGrantsKeyRef = useRef("");

  const initialGrantsKey = useMemo(
    () => initialGrants.map((grant) => `${grantKey(grant)}::${grant.raw}`).join("|"),
    [initialGrants]
  );

  useEffect(() => {
    if (!open) {
      lastSyncedGrantsKeyRef.current = "";
      return;
    }
    if (lastSyncedGrantsKeyRef.current === initialGrantsKey) return;

    lastSyncedGrantsKeyRef.current = initialGrantsKey;
    setGrants(initialGrants);
    setEditingKey(null);
    setEditDraft("");
    setPendingDelete(null);
    setDeleteComment("");
    setDeleteCommentError(null);
  }, [open, initialGrants, initialGrantsKey]);

  const startEdit = (grant: PolicyOptimizationGrant) => {
    setPendingDelete(null);
    setDeleteComment("");
    setDeleteCommentError(null);
    const key = grantKey(grant);
    setEditingKey(key);
    setEditDraft(grant.raw);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditDraft("");
  };

  const saveEdit = (grant: PolicyOptimizationGrant) => {
    const key = grantKey(grant);
    setGrants((current) =>
      current.map((item) =>
        grantKey(item) === key ? { ...item, raw: editDraft.trim() || item.raw } : item
      )
    );
    cancelEdit();
  };

  const requestDelete = (grant: PolicyOptimizationGrant) => {
    cancelEdit();
    setPendingDelete(grant);
    setDeleteComment("");
    setDeleteCommentError(null);
  };

  const cancelDelete = () => {
    setPendingDelete(null);
    setDeleteComment("");
    setDeleteCommentError(null);
  };

  const confirmDelete = () => {
    const comment = deleteComment.trim();
    if (!comment) {
      setDeleteCommentError("A comment is required before deleting a statement.");
      return;
    }

    if (!pendingDelete) return;

    const key = grantKey(pendingDelete);
    setGrants((current) => current.filter((item) => grantKey(item) !== key));
    cancelDelete();
  };

  return (
    <Modal
      open={open}
      title="Modify policy statements"
      onClose={onClose}
      policyPanel
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Close
        </button>
      }
    >
      {grants.length === 0 ? (
        <p className="text-sm text-gray-600">No policy statements available for this finding.</p>
      ) : (
        <div className="rounded-md border border-blue-100">
          <table className="w-full table-fixed border-collapse text-sm">
            <PolicyStatementTableColgroup actionsWidth="4rem" showStatementRef={false} />
            <thead>
              <tr>
                <th scope="col" className={MODAL_TH}>
                  Policy
                </th>
                <th scope="col" className={MODAL_TH}>
                  Statement text
                </th>
                <th scope="col" className={`${MODAL_TH} text-center`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grants.map((grant) => {
                const key = grantKey(grant);
                const isEditing = editingKey === key;

                return (
                  <tr key={key}>
                    <td className={POLICY_NAME_WRAP_TD}>{grant.policyName}</td>
                    <td className={STATEMENT_TEXT_TD}>
                      {isEditing ? (
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={4}
                          className="w-full rounded-md border border-blue-300 px-2.5 py-2 font-mono text-xs leading-relaxed text-gray-800 break-words [overflow-wrap:anywhere] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          aria-label={`Edit statement ${grant.ref}`}
                        />
                      ) : (
                        <p className="m-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-mono text-xs leading-relaxed text-gray-700">
                          {grant.raw}
                        </p>
                      )}
                    </td>
                    <td className={`${MODAL_TD} text-center`}>
                      <div className="inline-flex items-center justify-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(grant)}
                              className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50"
                              aria-label="Save statement"
                              title="Save"
                            >
                              <Check className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                              aria-label="Cancel edit"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" aria-hidden />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(grant)}
                              className="rounded-md p-1.5 text-blue-700 hover:bg-blue-50"
                              aria-label="Edit statement"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDelete(grant)}
                              className="rounded-md p-1.5 text-red-700 hover:bg-red-50"
                              aria-label="Delete statement"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete && (
        <div className="mt-3 space-y-2 rounded-md border border-red-200 bg-red-50/60 p-3">
          <p className="text-xs font-medium text-red-950">
            Delete statement <span className="font-mono">{pendingDelete.ref}</span> from{" "}
            <span className="font-semibold">{pendingDelete.policyName}</span>?
          </p>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-red-800">
              Comment <span className="text-red-600">*</span>
            </span>
            <textarea
              value={deleteComment}
              onChange={(e) => {
                setDeleteComment(e.target.value);
                if (deleteCommentError) setDeleteCommentError(null);
              }}
              rows={2}
              placeholder="Reason for removal…"
              className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 ${
                deleteCommentError
                  ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                  : "border-red-200 focus:border-red-400 focus:ring-red-500/20"
              }`}
              aria-invalid={Boolean(deleteCommentError)}
              aria-describedby={deleteCommentError ? "delete-comment-error" : undefined}
            />
          </label>
          {deleteCommentError ? (
            <p id="delete-comment-error" className="text-xs text-red-700">
              {deleteCommentError}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-1.5">
            <button
              type="button"
              onClick={cancelDelete}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
            >
              Confirm delete
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
