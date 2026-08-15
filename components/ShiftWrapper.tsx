"use client";

import React, { useEffect, useMemo } from "react";

type ShiftWrapperProps = {
  isOpen: boolean;
  widthPx?: number;
  children: React.ReactNode;
};

export default function ShiftWrapper({ isOpen, widthPx = 600, children }: ShiftWrapperProps) {
  const style = useMemo<React.CSSProperties>(() => {
    if (!isOpen || widthPx <= 0) return {};
    return {
      transform: `translateX(-${widthPx}px)`,
      transition: "transform 300ms ease-in-out",
    } as React.CSSProperties;
  }, [isOpen, widthPx]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflowX = "hidden";
    }
    return () => {
      document.body.style.overflowX = "";
    };
  }, [isOpen]);

  return <div style={style}>{children}</div>;
}


