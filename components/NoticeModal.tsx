"use client";

import { AlertCircle, CheckCircle } from "lucide-react";
import Modal from "@/components/Modal";

export type Notice = {
  tone: "success" | "error";
  title: string;
  message: string;
  /** Runs when the popup is dismissed (e.g. navigate away after a save). */
  onClose?: () => void;
};

/** In-page replacement for window.alert: one message with an OK button. */
export default function NoticeModal({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  const isSuccess = notice?.tone === "success";
  const Icon = isSuccess ? CheckCircle : AlertCircle;

  return (
    <Modal
      open={notice !== null}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
            isSuccess ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          OK
        </button>
      }
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${isSuccess ? "text-green-600" : "text-red-600"}`} />
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">{notice?.title}</h2>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-600">{notice?.message}</p>
        </div>
      </div>
    </Modal>
  );
}
