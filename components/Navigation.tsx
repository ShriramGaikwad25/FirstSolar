"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, Search } from 'lucide-react';
import {navLinks as allNavLinks, NavItem} from './Navi';
import { useLeftSidebar } from '@/contexts/LeftSidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { isRestrictedNavUser, RESTRICTED_NAV_ITEM_NAMES } from '@/lib/restricted-nav-users';

export function Navigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const { isVisible, setSidebarWidthPx } = useLeftSidebar();
  const { user } = useAuth();

  const navigation = isRestrictedNavUser(user?.email)
    ? allNavLinks.filter((item) => RESTRICTED_NAV_ITEM_NAMES.includes(item.name))
    : allNavLinks;

  useEffect(() => {
    setSidebarWidthPx(isSidebarExpanded ? 280 : 64);
  }, [isSidebarExpanded, setSidebarWidthPx]);

  const handleLinkClick = () => {
    // No-op - removed hover reset logic
  };

  const toggleExpand = () => {
    setIsSidebarExpanded(prev => !prev);
  };

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => {
      if (prev.has(itemName)) {
        const newSet = new Set(prev);
        newSet.delete(itemName);
        return newSet;
      }
      // Accordion: only one section open at a time so sublinks don't go below the screen
      return new Set([itemName]);
    });
  };

  const normalizePath = (p: string) =>
    p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;

  const routeMatches = (href: string): boolean => {
    if (pathname === href) return true;
    if (href !== '/' && pathname.startsWith(`${href}/`)) return true;
    return false;
  };

  /** Path segment of href only (ignore ?query and #hash) for active-state matching. */
  const hrefPathOnly = (href: string): string =>
    normalizePath(href.split("?")[0].split("#")[0]);

  /** Sublinks: exact URL only. Prefix match would mark e.g. NHI "Dashboard" (/non-human-identity) active on every /non-human-identity/* route. */
  const routeMatchesExact = (href: string): boolean =>
    normalizePath(pathname) === hrefPathOnly(href);

  const isItemActive = (item: NavItem): boolean => {
    if (routeMatches(item.href)) return true;
    if (item.subItems) {
      return item.subItems.some((subItem) => routeMatches(subItem.href));
    }
    return false;
  };

  const isSubItemActive = (subItem: NavItem): boolean =>
    routeMatchesExact(subItem.href);

  useEffect(() => {
    const raItem = navigation.find((i) => i.name === "Risk Analysis");
    if (
      raItem?.subItems?.length &&
      (routeMatches(raItem.href) ||
        raItem.subItems.some((s) => routeMatches(s.href)))
    ) {
      setExpandedItems(new Set(["Risk Analysis"]));
    }
  }, [pathname]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredNavigation = normalizedSearch
    ? navigation.filter((item) => {
        const matchesHeader = item.name.toLowerCase().includes(normalizedSearch);
        const matchesSubItem = item.subItems?.some((subItem) =>
          subItem.name.toLowerCase().includes(normalizedSearch)
        );
        return matchesHeader || matchesSubItem;
      })
    : navigation;

  // Do not show back button on routes that are already first-class sidebar destinations.
  const sidebarRouteSet = useState(() => {
    const set = new Set<string>();
    navigation.forEach((item) => {
      set.add(item.href);
      item.subItems?.forEach((subItem) => set.add(subItem.href));
    });
    return set;
  })[0];
  // Approval Policy's create/edit wizard reuses the list route (with ?view=create or
  // &edit=1) instead of a distinct URL, so it would otherwise be wrongly treated as the
  // main sidebar destination and have its back link suppressed below.
  const isApprovalPolicyCreateMode =
    pathname === '/settings/gateway/manage-approval-policies' &&
    (searchParams?.get('view') === 'create' || searchParams?.get('edit') === '1');
  const isMainSidebarRoute = sidebarRouteSet.has(pathname) && !isApprovalPolicyCreateMode;

  // Back link config: first match wins (order = most specific first)
  const getBackConfig = (): { href: string; label: string } | null => {
    // App Inventory
    if (
      pathname === '/settings/app-inventory/add-application' ||
      pathname === '/settings/app-inventory/add-application-ai-agent' ||
      pathname === '/settings/app-inventory/ai-assist-app' ||
      pathname === '/settings/app-inventory/global-ad-config-management' ||
      /^\/settings\/app-inventory\/[^/]+\/(settings|schema-mapping)$/.test(pathname)
    ) {
      return { href: '/settings/app-inventory', label: 'Back to Integrations' };
    }
    // Gateway - Email Templates (dynamic back for edit page)
    const emailTemplatesEditMatch = pathname.match(/^\/settings\/gateway\/email-templates\/edit\/([^/]+)$/);
    if (emailTemplatesEditMatch) {
      return { href: `/settings/gateway/email-templates/${emailTemplatesEditMatch[1]}`, label: 'Back to Email Template' };
    }
    if (pathname === '/settings/gateway/email-templates/new') {
      return { href: '/settings/gateway/email-templates', label: 'Back to Email Templates' };
    }
    if (pathname.match(/^\/settings\/gateway\/email-templates\/[^/]+$/) && !pathname.includes('/edit/')) {
      return { href: '/settings/gateway/email-templates', label: 'Back to Email Templates' };
    }
    if (pathname === '/settings/gateway/email-templates') {
      return { href: '/settings/gateway', label: 'Back to Generic' };
    }
    // Gateway - Workflow Builder create/edit
    if (pathname === '/settings/gateway/workflow-builder/new') {
      return { href: '/settings/gateway/workflow-builder', label: 'Back to Workflow Builder' };
    }
    // Gateway - other pages
    if (pathname === '/settings/gateway/manage-access-policy/new') {
      return { href: '/settings/gateway/manage-access-policy', label: 'Back to Manage Access Policy' };
    }
    if (pathname === '/settings/gateway/manage-access-policy') {
      return { href: '/settings', label: 'Back to Administration' };
    }
    if (pathname === '/settings/gateway/manage-business-roles/new') {
      return { href: '/settings/gateway/manage-business-roles', label: 'Back to Manage Business Roles' };
    }
    if (pathname === '/settings/gateway/sod/business-process/new') {
      return { href: '/settings/gateway/sod', label: 'Back to Business Processes' };
    }
    if (pathname === '/settings/gateway/sod/business-process/review') {
      return { href: '/settings/gateway/sod', label: 'Back to Business Processes' };
    }
    if (pathname === '/settings/gateway/sod/rules/new') {
      return { href: '/settings/gateway/sod/rules', label: 'Back to Rules' };
    }
    if (pathname === '/settings/gateway/sod/rules/review') {
      return { href: '/settings/gateway/sod/rules', label: 'Back to Rules' };
    }
    if (pathname === '/settings/gateway/sod/policy/new') {
      return { href: '/settings/gateway/sod/policy', label: 'Back to SoD Policy' };
    }
    if (pathname === '/settings/gateway/sod/policy/review') {
      return { href: '/settings/gateway/sod/policy', label: 'Back to SoD Policy' };
    }
    if (pathname === '/settings/gateway/sod/mitigating-controls/new') {
      return { href: '/settings/gateway/sod/mitigating-controls', label: 'Back to Mitigating Controls' };
    }
    if (pathname === '/settings/gateway/sod/mitigating-controls/review') {
      return { href: '/settings/gateway/sod/mitigating-controls', label: 'Back to Mitigating Controls' };
    }
    if (pathname === '/settings/gateway/sod/mitigating-controls') {
      return { href: '/settings/gateway/sod', label: 'Back to SoD' };
    }
    if (pathname === '/settings/gateway/manage-approval-policies/review') {
      return { href: '/settings/gateway/manage-approval-policies', label: 'Back to Approval Policy' };
    }
    // Create/edit wizard reuses the list route with ?view=create (and optionally &edit=1) —
    // the list-mode base route is otherwise a main sidebar route, which suppresses the back link.
    if (
      pathname === '/settings/gateway/manage-approval-policies' &&
      (searchParams?.get('view') === 'create' || searchParams?.get('edit') === '1')
    ) {
      return { href: '/settings/gateway/manage-approval-policies', label: 'Back to Approval Policy' };
    }
    if (pathname === '/settings/gateway/manage-business-roles/review') {
      return { href: '/settings/gateway/manage-business-roles', label: 'Back to Manage Business Roles' };
    }
    if (pathname.match(/^\/settings\/gateway\/lookup-custom-approvers\/[^/]+$/)) {
      return {
        href: '/settings/gateway/lookup-custom-approvers',
        label: 'Back to condition rules',
      };
    }
    if (
      pathname === '/settings/gateway/transformation-provider' &&
      (searchParams?.get('view') === 'create' || searchParams?.get('view') === 'edit')
    ) {
      return {
        href: '/settings/gateway/transformation-provider',
        label: 'Back to Transformation Provider',
      };
    }
    if (pathname === '/settings/gateway/entitlement-management' || pathname === '/settings/gateway/workflow-builder' ||
        pathname === '/settings/gateway/sam' || pathname === '/settings/gateway/native-users' ||
        pathname === '/settings/gateway/admin-roles' || pathname === '/settings/gateway/custom-schema' ||
        pathname === '/settings/gateway/general' || pathname === '/settings/gateway/scheduler' ||
        pathname === '/settings/gateway/manage-business-roles' || pathname === '/settings/gateway/manage-approval-policies' ||
        pathname === '/settings/gateway/ai-insights-configuration' || pathname === '/settings/gateway/continuous-compliance' ||
        pathname === '/settings/gateway/continuous-compliance-event-definitions' ||
        pathname === '/settings/gateway/sla-escalation-policies' ||
        pathname === '/settings/gateway/agent-task-library' ||
        pathname === '/settings/gateway/nhi-settings' || pathname === '/settings/gateway/lookup-custom-approvers' ||
        pathname === '/settings/gateway/transformation-provider') {
      return { href: '/settings/gateway', label: 'Back to Generic' };
    }
    if (pathname.startsWith('/settings/gateway/manage-access-policy')) {
      return { href: '/settings/gateway/manage-access-policy', label: 'Back to Access Policy' };
    }
    if (pathname === '/non-human-identity/create-nhi') {
      return { href: '/non-human-identity/nhi-inventory', label: 'Back to NHI Inventory' };
    }
    if (pathname === '/non-human-identity/request-access') {
      return { href: '/non-human-identity', label: 'Back to Legacy NHI' };
    }
    if (pathname.match(/^\/non-human-identity\/nhi-inventory\/[^/]+$/)) {
      return { href: '/non-human-identity/nhi-inventory', label: 'Back to NHI Inventory' };
    }
    if (pathname.match(/^\/non-human-identity-2\/nhis\/[^/]+$/)) {
      return { href: '/non-human-identity-2/nhis', label: 'Back to NHIs' };
    }
    if (pathname.match(/^\/non-human-identity\/ai-agent-inventory\/[^/]+$/)) {
      return { href: '/non-human-identity/ai-agent-inventory', label: 'Back to AI Agent Inventory' };
    }
    if (pathname.match(/^\/non-human-identity\/rotation-policy\/[^/]+$/)) {
      return { href: '/non-human-identity/rotation-policy', label: 'Back to Rotation Policy' };
    }
    // App Owner / Access Review
    if (pathname === '/app-owner') {
      return { href: '/access-review', label: 'Back to Access Review' };
    }
    if (pathname === '/access-review/nhi-q3-production-review') {
      return { href: '/access-review', label: 'Back to Access Review' };
    }
    // Users
    if (pathname === '/user/create-group' || pathname === '/user/create-user') {
      return { href: '/user', label: 'Back to Users' };
    }
    if (pathname.startsWith('/user/') && pathname !== '/user' && pathname !== '/user/create-group' && pathname !== '/user/create-user') {
      return { href: '/user', label: 'Back to Users' };
    }
    if (pathname === '/profile') {
      return { href: '/user', label: 'Back to Users' };
    }
    // Campaigns
    if (pathname.startsWith('/campaigns/manage-campaigns/')) {
      const fromTab = searchParams?.get('fromTab') || searchParams?.get('tab');
      if (fromTab === 'template') {
        return { href: '/campaigns?tab=template', label: 'Back to Templates' };
      }
      return { href: '/campaigns', label: 'Back to Campaigns' };
    }
    if (pathname.startsWith('/campaigns/schedule/') || pathname.startsWith('/campaigns/new')) {
      const fromTab = searchParams?.get('fromTab') || searchParams?.get('tab');
      if (fromTab === 'template') {
        return { href: '/campaigns?tab=template', label: 'Back to Templates' };
      }
      return { href: '/campaigns', label: 'Back to Campaigns' };
    }
    // Catalog opened from CC (owner inactive) → back to Continuous Compliance list
    if (pathname === '/catalog' && searchParams?.get('ccOwnerInactive') === '1') {
      return { href: '/campaigns/continuous-compliance', label: 'Back to Continuous Compliance' };
    }
    // Continuous Compliance campaign details → back to Continuous Compliance list
    if (
      pathname === '/campaigns/continuous-compliance/review' ||
      pathname === '/campaigns/continuous-compliance/entitlement-review' ||
      pathname === '/campaigns/continuous-compliance/unlinked-accounts' ||
      pathname === '/campaigns/continuous-compliance/account-inactive-review' ||
      pathname === '/campaigns/continuous-compliance/manager-inactive-review' ||
      pathname === '/campaigns/continuous-compliance/service-account-owner-inactive-review' ||
      pathname === '/campaigns/continuous-compliance/newly-discovered-entitlement-review' ||
      pathname === '/campaigns/continuous-compliance/api-key-rotation-review' ||
      pathname === '/campaigns/continuous-compliance/secret-inactivity-review'
    ) {
      return { href: '/campaigns/continuous-compliance', label: 'Back to Continuous Compliance' };
    }
    // Applications
    if (pathname.startsWith('/applications/') && pathname !== '/applications') {
      return { href: '/applications', label: 'Back to Applications' };
    }
    // Entitlement Owner
    if (pathname === '/entitlement-owner') {
      return { href: '/access-review', label: 'Back to Access Review' };
    }
    // SoD Audit detail opened from Continuous Compliance → back to CC (not SoD list)
    if (
      pathname.startsWith('/reports/sod-audit/') &&
      pathname !== '/reports/sod-audit' &&
      searchParams?.get('source') === 'continuous-compliance'
    ) {
      return { href: '/campaigns/continuous-compliance', label: 'Back to Continuous Compliance' };
    }
    // SoD Audit detail → back to SoD Audit list
    if (pathname.startsWith('/reports/sod-audit/') && pathname !== '/reports/sod-audit') {
      return { href: '/reports/sod-audit', label: 'Back to SoD Audit' };
    }
    // Reports
    if (pathname === '/reports/filter') {
      return { href: '/reports', label: 'Back to Reports' };
    }
    // OCI Policy workspace (detail page)
    if (pathname.match(/^\/oci-policy-analysis\/policies\/[^/]+$/)) {
      return { href: '/oci-policy-analysis', label: 'Back to Policy Dashboard' };
    }
    // Oracle Reports
    if (pathname.startsWith('/oracle-reports/') && pathname !== '/oracle-reports') {
      return { href: '/oracle-reports', label: 'Back to Oracle Reports' };
    }
    // Risk Posture detail pages → back to Risk Analysis hub
    if (pathname.startsWith('/risk-posture/orphan-exposure') || pathname.startsWith('/risk-posture/user-access-drift')) {
      return { href: '/risk-analysis', label: 'Back to Risk Analysis' };
    }
    // Track Request detail → back to Track Request list
    if (pathname.startsWith('/track-request/') && pathname !== '/track-request') {
      return { href: '/track-request', label: 'Back to Track Requests' };
    }
    // My Approvals detail → back to My Approvals list
    if (
      pathname.startsWith('/access-request/pending-approvals/') &&
      pathname !== '/access-request/pending-approvals'
    ) {
      return {
        href: '/access-request/pending-approvals',
        label: 'Back to My Approvals',
      };
    }
    return null;
  };

  const backConfig = getBackConfig();

  // Don't render if sidebar is hidden
  if (!isVisible) {
    return null;
  }

  return (
    <aside 
      className="fixed left-0 top-[60px] z-40 bg-white border-r border-gray-200 flex flex-col min-h-0"
      style={{
        height: 'calc(100vh - 60px)',
        width: isSidebarExpanded ? '280px' : '64px',
        transition: 'width 300ms ease-in-out'
      }}
      aria-label="Main navigation"
    >
      {/* Navigation Links */}
      <nav 
        className="flex flex-col flex-1 min-h-0 px-3 py-4 w-full items-stretch overflow-hidden" 
        role="navigation"
        aria-label="Primary navigation"
      >
        <div className="flex flex-col w-full space-y-1 shrink-0" style={{ gap: '6px' }}>
        {/* Back - compact, before search */}
        {!isMainSidebarRoute && backConfig && (
          <div className="w-full mb-2">
            <Link
              href={backConfig.href}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-blue-400 hover:bg-blue-50 text-gray-600 hover:text-gray-900 text-xs font-medium min-w-0"
              title={backConfig.label}
            >
              <ChevronLeft className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {isSidebarExpanded && <span className="truncate">{backConfig.label}</span>}
            </Link>
          </div>
        )}
        <div className="w-full mb-3">
          {isSidebarExpanded ? (
            <div className="relative">
              <span className="absolute inset-y-0 left-2 flex items-center">
                <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search menu..."
                className="w-full pl-8 pr-2 py-1.5 text-xs rounded-md border border-gray-200 bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Search main menu"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSidebarExpanded(true)}
              className="flex items-center justify-center w-10 h-8 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100"
              aria-label="Expand sidebar to search menu"
            >
              <Search className="h-4 w-4 text-gray-500" aria-hidden="true" />
            </button>
          )}
        </div>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full flex flex-col"
          style={{ gap: '6px' }}
        >
        {filteredNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item);
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const visibleSubItems = hasSubItems
            ? (normalizedSearch
                ? item.subItems!.filter((subItem) =>
                    subItem.name.toLowerCase().includes(normalizedSearch)
                  )
                : item.subItems)
            : undefined;
          const hasVisibleSubItems = !!visibleSubItems && visibleSubItems.length > 0;
          const isExpandedBySearch = normalizedSearch && hasVisibleSubItems;
          const isExpanded = expandedItems.has(item.name) || !!isExpandedBySearch;

          return (
            <div key={item.name} className="w-full">
              {/* Main Item */}
              <div className="flex items-center">
                {hasSubItems ? (
                  // For items with sub-items, make the entire area clickable to toggle
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      // If sidebar is collapsed, expand it first
                      if (!isSidebarExpanded) {
                        setIsSidebarExpanded(true);
                        // Open only this item (accordion: one at a time)
                        setExpandedItems(new Set([item.name]));
                      } else {
                        toggleExpanded(item.name);
                      }
                    }}
                    aria-expanded={isExpanded}
                    aria-controls={`submenu-${item.name}`}
                    aria-label={!isSidebarExpanded ? item.name : `${item.name}, ${isExpanded ? 'expanded' : 'collapsed'}`}
                    className={`flex items-center gap-2 px-2 py-2 rounded-md transition-colors flex-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      isActive 
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                        : 'hover:bg-gray-50'
                    } ${!isSidebarExpanded ? 'justify-center' : 'justify-start'}`}
                    style={{
                      color: isActive ? '#2563eb' : 'var(--text-icons-base-second, #68727D)',
                      fontFamily: 'Inter',
                      fontSize: '13px',
                      fontStyle: 'normal',
                      fontWeight: '600',
                      lineHeight: '18px'
                    }}
                    title={!isSidebarExpanded ? item.name : undefined}
                  >
                    <Icon 
                      className="h-4 w-4 flex-shrink-0" 
                      style={{
                        color: isActive ? '#2563eb' : 'var(--text-icons-base-second, #68727D)'
                      }}
                      aria-hidden="true"
                    />
                    {isSidebarExpanded && <span className="whitespace-normal">{item.name}</span>}
                    {isSidebarExpanded && (
                      <div className="ml-auto" aria-hidden="true">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    )}
                  </button>
                ) : (
                  // For items without sub-items, use regular Link
                  <Link
                    href={item.href}
                    onClick={handleLinkClick}
                    className={`flex items-center gap-2 px-2 py-2 rounded-md transition-colors flex-1 ${
                      isActive 
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                        : 'hover:bg-gray-50'
                    } ${!isSidebarExpanded ? 'justify-center' : 'justify-start'}`}
                    style={{
                      color: isActive ? '#2563eb' : 'var(--text-icons-base-second, #68727D)',
                      fontFamily: 'Inter',
                      fontSize: '13px',
                      fontStyle: 'normal',
                      fontWeight: '600',
                      lineHeight: '18px'
                    }}
                    title={!isSidebarExpanded ? item.name : undefined}
                  >
                    <Icon 
                      className="h-4 w-4 flex-shrink-0" 
                      style={{
                        color: isActive ? '#2563eb' : 'var(--text-icons-base-second, #68727D)'
                      }}
                    />
                    {isSidebarExpanded && <span className="whitespace-normal">{item.name}</span>}
                  </Link>
                )}
              </div>

              {/* Sub Items */}
              {hasVisibleSubItems && isExpanded && isSidebarExpanded && (
                <ul 
                  id={`submenu-${item.name}`}
                  className="ml-4 mt-1 space-y-0.5"
                  role="menu"
                >
                  {visibleSubItems!.map((subItem) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = isSubItemActive(subItem);
                    
                    return (
                      <li key={subItem.name} role="none">
                        <Link
                          href={subItem.href}
                          onClick={handleLinkClick}
                          role="menuitem"
                          aria-current={isSubActive ? 'page' : undefined}
                          aria-label={subItem.beta ? `${subItem.name} (Beta)` : undefined}
                          className={`flex items-center gap-2 px-2 py-1.25 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            isSubActive 
                              ? 'bg-green-50 text-green-700 border-l-2 border-green-600' 
                              : 'hover:bg-slate-50 text-slate-600'
                          }`}
                          style={{
                            color: isSubActive ? '#15803d' : '#475569',
                            fontFamily: 'Inter',
                            fontSize: '12px',
                            fontStyle: 'normal',
                            fontWeight: '500',
                            lineHeight: '16px'
                          }}
                        >
                          <SubIcon 
                            className="h-3.5 w-3.5 flex-shrink-0" 
                            style={{
                              color: isSubActive ? '#15803d' : '#475569'
                            }}
                            aria-hidden="true"
                          />
                          <span className="whitespace-normal inline-flex items-baseline gap-0.5">
                            {subItem.name}
                            {subItem.beta && (
                              <span
                                className="text-[11px] font-semibold text-amber-600 leading-none ml-0.5"
                                aria-hidden
                              >
                                β
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
        </div>
        
        {/* Expand/Collapse Arrow Button - Just below last item */}
        <div className={`flex items-center w-full mt-2 shrink-0 ${isSidebarExpanded ? 'px-2' : 'pl-2 justify-start'}`}>
          <button
            onClick={toggleExpand}
            aria-label={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={isSidebarExpanded}
            className={`flex items-center justify-center h-10 rounded-lg bg-blue-50 hover:bg-blue-100 active:bg-blue-200 transition-all duration-200 border border-blue-200 hover:border-blue-300 hover:shadow-md group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isSidebarExpanded ? 'w-full' : 'w-10'
            }`}
            title={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
            style={{
              color: '#2563eb'
            }}
          >
            {isSidebarExpanded ? (
              <ChevronLeft className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-[-2px]" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-[2px]" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>
    </aside>
  );
}