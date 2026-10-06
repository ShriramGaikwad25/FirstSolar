"use client";

import { useEffect, useState } from "react";
import { getUserAdminRoles } from "@/lib/auth";
import type { NavItem } from "@/components/Navi";

/**
 * Page access by admin role (from the JWT "adminRoles" claim):
 *  - Domain Administrator: every page.
 *  - Help Desk Administrator (and anyone without Domain Administrator): Dashboard,
 *    My Workspace and Request Management only.
 */
export type RoleAccess = { isDomainAdmin: boolean; isHelpDeskAdmin: boolean };

/** Route prefixes a Help Desk Administrator may open (sections + their detail pages). */
const HELP_DESK_ROUTE_PREFIXES = [
  "/dashboard",
  // My Workspace
  "/profile",
  "/user",
  "/applications",
  // Request Management
  "/access-request",
  "/track-request",
];

/** "Domain Administrator", "DOMAIN_ADMINISTRATOR", "domain-administrator" -> "domainadministrator" */
const normalizeRole = (role: string) => role.toLowerCase().replace(/[^a-z]/g, "");

export function readRoleAccess(): RoleAccess {
  const roles = (getUserAdminRoles() ?? "").split(",").map(normalizeRole).filter(Boolean);
  return {
    isDomainAdmin: roles.includes("domainadministrator"),
    isHelpDeskAdmin: roles.includes("helpdeskadministrator"),
  };
}

/** Role access for the signed-in user; null until read on the client (cookies). */
export function useRoleAccess(): RoleAccess | null {
  const [access, setAccess] = useState<RoleAccess | null>(null);
  useEffect(() => {
    setAccess(readRoleAccess());
  }, []);
  return access;
}

export function canAccessPath(pathname: string, access: RoleAccess): boolean {
  if (access.isDomainAdmin) return true;
  return HELP_DESK_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Sidebar / quick links limited to the pages the user may open. */
export function filterNavForRole(items: NavItem[], access: RoleAccess): NavItem[] {
  if (access.isDomainAdmin) return items;
  return items
    .map((item) => {
      if (!item.subItems?.length) return canAccessPath(item.href, access) ? item : null;
      const subItems = item.subItems.filter((s) => canAccessPath(s.href.split("?")[0], access));
      return subItems.length ? { ...item, subItems } : null;
    })
    .filter((item): item is NavItem => item !== null);
}
