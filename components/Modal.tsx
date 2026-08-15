"use client";

import { useEffect, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  /** Wider modals (import/export) */
  wide?: boolean;
  /** Rule editor (~900px) */
  extraWide?: boolean;
  /** Policy statement tables — wider, no inner scroll */
  policyPanel?: boolean;
};

export default function Modal({ open, title, children, onClose, footer, wide, extraWide, policyPanel }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full rounded-lg border border-gray-200 bg-white shadow-xl flex flex-col ${
          policyPanel
            ? "max-w-[min(1120px,96vw)]"
            : extraWide
              ? "max-w-[900px]"
              : wide
                ? "max-w-2xl"
                : "max-w-md"
        } ${policyPanel ? "" : "max-h-[min(92vh,900px)]"}`}
      >
        {title && (
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
        )}
        <div className={`p-4 text-sm text-gray-700 ${policyPanel ? "overflow-visible" : "overflow-y-auto flex-1 min-h-0"}`}>{children}</div>
        {footer && <div className="border-t border-gray-200 px-4 py-3 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
