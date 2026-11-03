"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
  /** Pinned above the scrolling body (e.g. title, actions, tabs); used instead of `title` */
  header?: ReactNode;
  /** Fixed height so the dialog doesn't jump in size between tabs or while loading */
  fixedHeight?: boolean;
};

export default function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  wide,
  extraWide,
  policyPanel,
  header,
  fixedHeight,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // Portal to <body> so the dialog isn't clipped by the page's scroll container and, being later in the DOM,
  // stacks above the fixed header (same z-50) while dropdowns portaled after it still stack above it.
  return createPortal(
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
        } ${policyPanel ? "" : fixedHeight ? "h-[min(85vh,760px)]" : "max-h-[min(92vh,900px)]"}`}
      >
        {header ? (
          <div className="shrink-0 border-b border-gray-200 px-4 pt-3">{header}</div>
        ) : (
          title && (
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            </div>
          )
        )}
        <div className={`p-4 text-sm text-gray-700 ${policyPanel ? "overflow-visible" : "overflow-y-auto flex-1 min-h-0"}`}>{children}</div>
        {footer && <div className="border-t border-gray-200 px-4 py-3 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
