import React, { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    ctaText: string;
    onConfirm: () => void;
  }

  const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, title, ctaText, onConfirm, children }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle ESC key to close modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
    // Trap focus within dialog using Tab key
    if (e.key === "Tab" && dialogRef.current) {
      const focusableElements = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }
  }, [onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Add event listeners
      document.addEventListener("keydown", handleKeyDown);
      
      // Focus the dialog title after a short delay to ensure it's rendered
      setTimeout(() => {
        titleRef.current?.focus();
      }, 0);
      
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      // Remove event listeners
      document.removeEventListener("keydown", handleKeyDown);
      
      // Restore body scroll
      document.body.style.overflow = '';
      
      // Return focus to the previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center bg-gray-900/50 px-3 z-[99]"
      onClick={handleBackdropClick}
      role="presentation"
      aria-hidden={!isOpen}
    >
      <div 
        ref={dialogRef}
        className="bg-white rounded-lg shadow-lg max-w-md w-full p-4 focus:outline-none" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {/* Header */}
        <h2 
          ref={titleRef}
          id="dialog-title"
          className="text-xl font-semibold text-gray-800"
          tabIndex={-1}
        >
          {title}
        </h2>

        {/* Body */}
        <div className="text-gray-600 mt-2">{children}</div>

        {/* Actions */}
        <div className="mt-3 flex justify-end space-x-2">
          <button 
            onClick={onClose} 
            className="px-3 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label={ctaText}
          >
            {ctaText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Dialog;
