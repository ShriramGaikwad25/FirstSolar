"use client";

import React from "react";
import { useRightSidebar } from "@/contexts/RightSidebarContext";

const LayoutContentShift = ({ children }: { children: React.ReactNode }) => {
	const { isOpen, widthPx } = useRightSidebar();
	return (
		<div style={{ marginRight: isOpen ? widthPx : 0, transition: "margin-right 200ms ease" }}>
			<main id="main-content" role="main">
				{children}
			</main>
		</div>
	);
};

export default LayoutContentShift;


