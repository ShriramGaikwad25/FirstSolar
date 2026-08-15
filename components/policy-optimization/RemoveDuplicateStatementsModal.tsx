"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import { grantsForModify } from "@/components/policy-optimization/ModifyPolicyStatementsModal";
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

export function RemoveDuplicateStatementsModal({
  open,
  onClose,
  initialGrants,
}: {
  open: boolean;
  onClose: () => void;
  initialGrants: PolicyOptimizationGrant[];
}) {
  const [grants, setGrants] = useState<PolicyOptimizationGrant[]>(initialGrants);
  const [pendingDelete, setPendingDelete] = useState<PolicyOptimizationGrant | null>(null);
  const [deleteComment, setDeleteComment] = useState("");
  const [deleteCommentError, setDeleteCommentError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setGrants(initialGrants);
    setPendingDelete(null);
    setDeleteComment("");
    setDeleteCommentError(null);
  }, [open, initialGrants]);

  const requestDelete = (grant: PolicyOptimizationGrant) => {
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
      title="Remove duplicate statements"
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
        <p className="text-sm text-gray-600">No duplicate statements available for this finding.</p>
      ) : (
        <div className="rounded-md border border-blue-100">
          <table className="w-full table-fixed border-collapse text-sm">
            <PolicyStatementTableColgroup showStatementRef={false} />
            <thead>
              <tr>
                <th scope="col" className={MODAL_TH}>
                  Policy
                </th>
                <th scope="col" className={MODAL_TH}>
                  Statement text
                </th>
                <th scope="col" className={`${MODAL_TH} text-center`}>
                  <span className="sr-only">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grants.map((grant) => (
                <tr key={grantKey(grant)}>
                  <td className={POLICY_NAME_WRAP_TD}>{grant.policyName}</td>
                  <td className={STATEMENT_TEXT_TD}>
                    <p className="m-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-mono text-xs leading-relaxed text-gray-700">
                      {grant.raw}
                    </p>
                  </td>
                  <td className={`${MODAL_TD} text-center`}>
                    <button
                      type="button"
                      onClick={() => requestDelete(grant)}
                      className="rounded-md p-1.5 text-red-700 hover:bg-red-50"
                      aria-label={`Delete statement ${grant.ref}`}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete && (
        <div className="mt-3 space-y-2 rounded-md border border-red-200 bg-red-50/60 p-3">
          <p className="text-xs font-medium text-red-950">
            Delete duplicate statement <span className="font-mono">{pendingDelete.ref}</span> from{" "}
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
              aria-describedby={deleteCommentError ? "remove-duplicate-comment-error" : undefined}
            />
          </label>
          {deleteCommentError ? (
            <p id="remove-duplicate-comment-error" className="text-xs text-red-700">
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

export { grantsForModify as grantsForRemoveDuplicate };
