"use client";

import React, { useEffect, useRef } from "react";
import RightSidebar from "./RightSideBar";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import { usePathname } from "next/navigation";

const RightSideBarHost = () => {
	const { isOpen, widthPx, closeSidebar, content, title, closeOnOutsideClick } = useRightSidebar();
	const pathname = usePathname();
	const prevPathRef = useRef<string | null>(null);

	useEffect(() => {
		// Close sidebar only on actual route changes (not initial mount)
		if (prevPathRef.current !== null && prevPathRef.current !== pathname && isOpen) {
			closeSidebar();
		}
		prevPathRef.current = pathname;
	}, [pathname, isOpen, closeSidebar]);

	return (
		<RightSidebar
			isOpen={isOpen}
			widthPx={widthPx}
			onClose={closeSidebar}
			topOffsetPx={60}
			title={title}
			closeOnOutsideClick={closeOnOutsideClick}
		>
			{content}
		</RightSidebar>
	);
};

export default RightSideBarHost;


