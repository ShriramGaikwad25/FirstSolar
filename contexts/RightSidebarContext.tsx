"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type SidebarContent = React.ReactNode;

interface RightSidebarContextValue {
	isOpen: boolean;
	widthPx: number;
	closeOnOutsideClick: boolean;
	openSidebar: (
		content: SidebarContent,
		options?: { widthPx?: number; title?: string; closeOnOutsideClick?: boolean }
	) => void;
	closeSidebar: () => void;
	setWidth: (widthPx: number) => void;
	content: SidebarContent;
	title?: string;
}

const RightSidebarContext = createContext<RightSidebarContextValue | undefined>(undefined);

export const RightSidebarProvider = ({ children }: { children: React.ReactNode }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [widthPx, setWidthPx] = useState(500);
	const [content, setContent] = useState<SidebarContent>(null);
	const [title, setTitle] = useState<string | undefined>(undefined);
	const [closeOnOutsideClick, setCloseOnOutsideClick] = useState(true);

	const openSidebar = useCallback((
		newContent: SidebarContent,
		options?: { widthPx?: number; title?: string; closeOnOutsideClick?: boolean }
	) => {
		if (options?.widthPx) setWidthPx(options.widthPx);
		setTitle(options?.title);
		setCloseOnOutsideClick(options?.closeOnOutsideClick ?? true);
		setContent(newContent);
		setIsOpen(true);
	}, []);

	const closeSidebar = useCallback(() => {
		setIsOpen(false);
		setContent(null);
		setTitle(undefined);
		setCloseOnOutsideClick(true);
	}, []);

	const setWidth = useCallback((newWidth: number) => {
		setWidthPx(newWidth);
	}, []);

	const value = useMemo<RightSidebarContextValue>(() => ({
		isOpen,
		widthPx,
		closeOnOutsideClick,
		openSidebar,
		closeSidebar,
		setWidth,
		content,
		title,
	}), [isOpen, widthPx, closeOnOutsideClick, openSidebar, closeSidebar, setWidth, content, title]);

	return (
		<RightSidebarContext.Provider value={value}>
			{children}
		</RightSidebarContext.Provider>
	);
};

export const useRightSidebar = (): RightSidebarContextValue => {
	const ctx = useContext(RightSidebarContext);
	if (!ctx) {
		throw new Error("useRightSidebar must be used within a RightSidebarProvider");
	}
	return ctx;
};


