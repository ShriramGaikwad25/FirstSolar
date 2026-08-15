"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";

type ViewTransform = {
  scale: number;
  x: number;
  y: number;
};

const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;

type ZoomPanViewportProps = {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  fitKey?: string | number;
  className?: string;
};

export function ZoomPanViewport({
  title,
  children,
  footer,
  empty = false,
  emptyMessage = "Nothing to display.",
  fitKey,
  className = "",
}: ZoomPanViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const updateSize = () => {
      setContentSize({
        width: content.scrollWidth,
        height: content.scrollHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(content);
    return () => observer.disconnect();
  }, [children, fitKey]);

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || empty || contentSize.width === 0 || contentSize.height === 0) return;

    const padding = 32;
    const availableWidth = viewport.clientWidth - padding * 2;
    const availableHeight = viewport.clientHeight - padding * 2;
    const scale = Math.min(
      MAX_SCALE,
      Math.max(
        MIN_SCALE,
        Math.min(availableWidth / contentSize.width, availableHeight / contentSize.height)
      )
    );

    const x = (viewport.clientWidth - contentSize.width * scale) / 2;
    const y = (viewport.clientHeight - contentSize.height * scale) / 2;
    setTransform({ scale, x, y });
  }, [contentSize.height, contentSize.width, empty]);

  useEffect(() => {
    if (!empty && contentSize.width > 0 && contentSize.height > 0) {
      fitToView();
    }
  }, [contentSize.height, contentSize.width, empty, fitKey, fitToView]);

  const handleZoom = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    setTransform((current) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
      const centerX = viewport.clientWidth / 2;
      const centerY = viewport.clientHeight / 2;
      const worldX = (centerX - current.x) / current.scale;
      const worldY = (centerY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: centerX - worldX * nextScale,
        y: centerY - worldY * nextScale,
      };
    });
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const factor = event.deltaY < 0 ? 1.1 : 0.9;

    setTransform((current) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
      const rect = viewport.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const worldX = (pointerX - current.x) / current.scale;
      const worldY = (pointerY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: pointerX - worldX * nextScale,
        y: pointerY - worldY * nextScale,
      };
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
    setTransform((current) => {
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        tx: current.x,
        ty: current.y,
      };
      return current;
    });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const panStart = panStartRef.current;
    if (!panStart) return;
    event.preventDefault();
    const dx = event.clientX - panStart.x;
    const dy = event.clientY - panStart.y;
    setTransform((current) => ({
      ...current,
      x: panStart.tx + dx,
      y: panStart.ty + dy,
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsPanning(false);
    panStartRef.current = null;
  };

  return (
    <div className={`flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-white ${className}`}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <span className="font-medium text-gray-700">{title}</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => handleZoom(1.2)}
            className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(1 / 1.2)}
            className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={fitToView}
            className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"
            aria-label="Fit to view"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`relative min-h-0 flex-1 touch-none overflow-hidden bg-[#f8fafc] select-none ${
          isPanning ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
          backgroundSize: `${22 * transform.scale}px ${22 * transform.scale}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
        }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDragStart={(event) => event.preventDefault()}
      >
        {empty ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-sm text-gray-500">
            {emptyMessage}
          </div>
        ) : (
          <div
            className="absolute left-0 top-0 origin-top-left select-none"
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            }}
          >
            <div ref={contentRef} className="inline-block select-none">
              {children}
            </div>
          </div>
        )}
      </div>

      {footer ? (
        <div className="shrink-0 border-t border-gray-200 px-4 py-2.5 text-xs text-gray-500 tabular-nums">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
