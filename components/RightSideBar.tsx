// components/RightSidebar.jsx
"use client";

import { useEffect, useRef, useState } from "react";

interface RightSidebarProps {
  isOpen: boolean;
  widthPx?: number; // default will be 600
  onClose: () => void;
  closeOnOutsideClick?: boolean;
  children?: React.ReactNode;
  topOffsetPx?: number; // space below fixed header when navbar visible; default 60
  title?: React.ReactNode; // optional title/header content for the sidebar (string or custom node)
}

const DEFAULT_WIDTH = 500;
const DEFAULT_TOP_OFFSET = 60;

const RightSidebar = ({
  isOpen,
  widthPx = DEFAULT_WIDTH,
  onClose,
  closeOnOutsideClick = true,
  children,
  topOffsetPx = DEFAULT_TOP_OFFSET,
  title,
}: RightSidebarProps) => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const scrollableMainRef = useRef<Element | null>(null);
  const [effectiveTop, setEffectiveTop] = useState(topOffsetPx);

  // When navbar scrolls out of view, sidebar comes from top (0); otherwise respect navbar space.
  // Listen to both viewport scroll and the main content area scroll (layout uses main.overflow-auto).
  useEffect(() => {
    const updateTop = () => {
      const mainScroll = scrollableMainRef.current?.scrollTop ?? 0;
      const windowScroll = typeof window !== "undefined" ? window.scrollY : 0;
      const scrollY = Math.max(mainScroll, windowScroll);
      setEffectiveTop(scrollY >= topOffsetPx ? 0 : topOffsetPx);
    };
    const scrollableMain =
      document.querySelector("main.flex-1.overflow-auto") ?? document.querySelector("main");
    if (scrollableMain) {
      scrollableMainRef.current = scrollableMain;
      scrollableMain.addEventListener("scroll", updateTop, { passive: true });
    }
    window.addEventListener("scroll", updateTop, { passive: true });
    updateTop();
    return () => {
      window.removeEventListener("scroll", updateTop);
      const m = scrollableMainRef.current;
      if (m) {
        m.removeEventListener("scroll", updateTop);
        scrollableMainRef.current = null;
      }
    };
  }, [topOffsetPx]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element) {
        // Portals (`createPortal` to `document.body`) sit outside the sidebar node — don't close the bar for those.
        if (target.closest("[data-right-sidebar-keep]")) {
          return;
        }
      }
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen && closeOnOutsideClick) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, closeOnOutsideClick]);

  return (
    <>
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed right-0 bg-white shadow-lg z-50 border-l border-gray-200 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          width: widthPx,
          top: effectiveTop,
          height: `calc(100vh - ${effectiveTop}px)`,
          transition: 'top 0.2s ease-out, height 0.2s ease-out',
        }}
      >
        <div className="flex justify-between items-center p-4 border-b gap-3">
          {title && (
            typeof title === "string" ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-1.5 h-6 bg-blue-600 rounded-full shrink-0" aria-hidden />
                <h2 className="text-lg font-semibold text-gray-800 truncate">{title}</h2>
              </div>
            ) : (
              <div className="flex-1 min-w-0">{title}</div>
            )
          )}
          <button
            onClick={onClose} 
            className="flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all duration-200"
            title="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div 
          className="p-4 overflow-auto hide-scrollbar" 
          style={{ 
            height: `calc(100% - 80px)`,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};

export default RightSidebar;

