"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Dropdown from "./Dropdown";
import { formatDateMMDDYY } from "@/utils/utils";
import { UserRowData } from "@/types/certification";
import HorizontalTabs from "@/components/HorizontalTabs";
import { ChevronDown, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ChartData } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import "@/lib/ag-grid-setup";
import CertificationProgress from "./CertificationProgress";
import UserProgress from "./UserProgress";
import { navLinks, NavItem } from "./Navi";
import { useAuth } from "@/contexts/AuthContext";
import { getCookie, COOKIE_NAMES, getCurrentUser } from "@/lib/auth";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";
import UserDisplayName from "@/components/UserDisplayName";

// Register Chart.js components and plugin
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, ChartDataLabels);

// Dynamically import AgGridReact with SSR disabled
const AgGridReact = dynamic(() => import("ag-grid-react").then((mod) => mod.AgGridReact), {
  ssr: false,
});

// Dynamically import Bar chart with SSR disabled
const Bar = dynamic(() => import("react-chartjs-2").then((mod) => mod.Bar), {
  ssr: false,
});

const PopupButton = ({
  username,
  userId,
  userStatus,
  manager,
  department,
  jobTitle,
  userType,
  onClose,
}: {
  username: string;
  userId: string;
  userStatus: string;
  manager: string;
  department: string;
  jobTitle: string;
  userType: "Internal" | "External";
  onClose: () => void;
}) => {
  const [formData, setFormData] = useState({
    name: username,
    email: "",
    comments: "",
  });
  const [tabIndex, setTabIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  // Ensure chart and grid render only on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    onClose();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Sample user data adapted to PopupButton props
  const userData = {
    firstName: username.split(" ")[0] || "Unknown",
    lastName: username.split(" ")[1] || "",
    email: `${username.replace(" ", ".").toLowerCase()}@example.com`,
    displayName: username,
    alias: userId.toLowerCase(),
    phone: "+1 (555) 123-4567",
    title: jobTitle,
    department: department,
    startDate: "2023-01-15",
    userType: userType,
    managerEmail: manager.includes("@") ? manager : `${manager.replace(" ", ".").toLowerCase()}@example.com`,
    tags: ["User", userType],
  };

  // Sample access data
  const accessData = {
    accounts: 20,
    apps: 10,
    entitlements: 60,
    violations: 5,
  };

  // Sample account data
  const accountData = [
    {
      accountId: "ACC001",
      accountStatus: "Active",
      risk: "Low",
      appName: "CRM App",
      discoveryDate: "2023-06-01",
      lastSyncDate: "2025-08-20",
      lastAccessReview: "2025-07-15",
      insights: "High usage",
      mfa: "Enabled",
      complianceViolation: "None",
    },
    {
      accountId: "ACC002",
      accountStatus: "Suspended",
      risk: "High",
      appName: "HR Portal",
      discoveryDate: "2023-05-10",
      lastSyncDate: "2025-08-18",
      lastAccessReview: "2025-06-30",
      insights: "Inactive account",
      mfa: "Disabled",
      complianceViolation: "SoD Violation",
    },
  ];

  const ProfileTab = () => {
    const initials = `${userData.firstName[0]}${userData.lastName[0] || ""}`.toUpperCase();
    const colors = ["#7f3ff0", "#0099cc", "#777", "#d7263d", "#ffae00"];
    const bgColor = colors[userData.email.length % colors.length];

    return (
      <div className="flex flex-col gap-4 p-4 bg-white rounded-lg">
        <div className="flex-shrink-0">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-semibold"
            style={{ backgroundColor: bgColor }}
          >
            {initials}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500">Name</label>
            <p className="text-sm text-gray-900">
              <UserDisplayName
                displayName={userData.displayName}
                userType={userData.userType}
                tags={userData.tags}
              />
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Email</label>
            <p className="text-sm text-blue-600">{userData.email}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Title</label>
            <p className="text-sm text-gray-900">{userData.title}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Department</label>
            <p className="text-sm text-gray-900">{userData.department}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Manager Email</label>
            <p className="text-sm text-blue-600">{userData.managerEmail}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">User Type</label>
            <p className="text-sm text-gray-900">{userData.userType}</p>
          </div>
        </div>
      </div>
    );
  };

  const AccessTab = () => {
    const accountColumnDefs = useMemo(
      () => [
        {
          headerName: "Account ID",
          field: "accountId",
          flex: 1,
          cellRenderer: (params: any) => (
            <span>
              {params.value} ({params.data.accountStatus})
            </span>
          ),
        },
        { headerName: "App Name", field: "appName", flex: 1 },
        {
          headerName: "MFA",
          field: "mfa",
          flex: 1,
          cellRenderer: (params: any) => (
            <span className={params.value === "Enabled" ? "text-green-600" : "text-red-600"}>
              {params.value}
            </span>
          ),
        },
        {
          headerName: "Compliance Violation",
          field: "complianceViolation",
          flex: 1,
          cellRenderer: (params: any) => (
            <span className={params.value === "None" ? "text-green-600" : "text-red-600"}>
              {params.value}
            </span>
          ),
        },
      ] as any[],
      []
    );

    return (
      <div className="p-4 bg-white rounded-lg">
        <div className="ag-theme-alpine" style={{ height: 150, width: "100%" }}>
          <AgGridReact
            rowData={accountData}
            columnDefs={accountColumnDefs}
            defaultColDef={{ sortable: true, filter: true }}
          />
        </div>
      </div>
    );
  };

  const tabsData = [
    {
      label: "Profile",
      icon: ChevronDown,
      iconOff: ChevronRight,
      component: ProfileTab,
    },
    {
      label: "Access",
      icon: ChevronDown,
      iconOff: ChevronRight,
      component: AccessTab,
    },
  ];

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-3">
      <div className="bg-white p-3 rounded-lg shadow-lg w-full max-w-sm max-h-[75vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-4 text-gray-500 hover:text-gray-700 text-lg font-semibold"
        >
          X
        </button>
        <HorizontalTabs
          tabs={tabsData}
          activeIndex={tabIndex}
          onChange={setTabIndex}
        />
      </div>
    </div>
  );
};

const HeaderContent = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const closeUserMenuRef = useRef<(() => void) | null>(null);
  const router = useRouter();
  const { logout, user } = useAuth();
  const { isVisible, toggleSidebar } = useLeftSidebar();

  // State for header info and user details
  const [headerInfo, setHeaderInfo] = useState({
    campaignName: "",
    status: "",
    snapshotAt: "",
    dueDate: "",
    daysLeft: 0,
  });

  const [userDetails, setUserDetails] = useState<{
    username: string;
    userId: string;
    userStatus: string;
    manager: string;
    department: string;
    jobTitle: string;
    userType: "Internal" | "External";
  } | null>(null);

  // State for certification progress
  const [progressData, setProgressData] = useState({
    totalItems: 0,
    approvedCount: 0,
    pendingCount: 0,
    revokedCount: 0,
    delegatedCount: 0,
    remediatedCount: 0,
  });

  // State for user-based progress (matching access review page)
  const [userProgressData, setUserProgressData] = useState({
    totalItems: 0,
    approvedCount: 0,
    pendingCount: 0,
    percentage: 0,
  });

  // State for PopupButton
  const [showPopupButton, setShowPopupButton] = useState(false);

  // State for application details
  const [applicationDetails, setApplicationDetails] = useState<{
    applicationName: string;
    owner: string;
    lastSync: string;
  } | null>(null);


  const [avatarErrorIndexByKey, setAvatarErrorIndexByKey] = useState<Record<string, number>>({});

  const getHeaderUserKey = (u: any): string => {
    if (!u) return "";
    return String(u.userId || u.username || u.email || u.id || u.username || "");
  };

  const getAvatarCandidates = (u: any): string[] => {
    // Always try the shared User.jpg first for every user,
    // then fall back to the generic avatar pool if needed.
    const availablePictures = [
      "/User.jpg",
      "/pictures/user_image1.avif",
      "/pictures/user_image4.avif",
      "/pictures/user_image7.avif",
      "/pictures/user_image8.avif",
    ];

    return availablePictures;
  };

  const renderUserAvatar = (u: any, size: number, roundedClass: string) => {
    if (!u) return null;
    
    const userKey = getHeaderUserKey(u);
    const candidates = getAvatarCandidates(u);
    
    // Generate initials as fallback
    const userName = u?.username || u?.userName || u?.fullName || u?.displayName || u?.email || u?.userId || 'User';
    const initials = userName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
    const bgColor = `hsl(${(userKey.charCodeAt(0) * 137.508) % 360}, 70%, 50%)`;
    
    // If no candidates or all candidates tried, show initials
    if (!candidates || candidates.length === 0) {
      return (
        <div
          className={`${roundedClass} flex items-center justify-center text-white font-semibold`}
          style={{ width: size, height: size, backgroundColor: bgColor, fontSize: size * 0.4 }}
        >
          {initials}
        </div>
      );
    }
    
    const index = Math.max(0, avatarErrorIndexByKey[userKey] ?? 0);
    const src = candidates[Math.min(index, candidates.length - 1)];
    
    // If we've tried all candidates, show initials
    if (index >= candidates.length - 1 || !src) {
      return (
        <div
          className={`${roundedClass} flex items-center justify-center text-white font-semibold`}
          style={{ width: size, height: size, backgroundColor: bgColor, fontSize: size * 0.4 }}
        >
          {initials}
        </div>
      );
    }
    
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <Image
          src={src}
          alt={`Profile picture of ${userName}`}
          width={size}
          height={size}
          className={`${roundedClass}`}
          unoptimized={true}
          loading="lazy"
          onError={(e) => {
            try {
              setAvatarErrorIndexByKey((prev) => {
                const next = { ...prev } as Record<string, number>;
                const currentIndex = prev[userKey] ?? 0;
                const nextIndex = Math.min(currentIndex + 1, candidates.length - 1);
                next[userKey] = nextIndex;
                return next;
              });
            } catch (error) {
              // Silently handle error state update failures
              console.debug('Avatar error handling failed:', error);
            }
          }}
        />
      </div>
    );
  };

  // Check if we should show the header (for access-review pages, but not app-owner or individual applications)
  const shouldShowHeader =
    pathname?.includes('/access-review/') &&
    !pathname?.includes('/applications/');

  // Check if we should show app-owner specific header
  const shouldShowAppOwnerHeader = pathname?.includes('/app-owner');

  // Check if we should show entitlement-owner specific header
  const shouldShowEntitlementOwnerHeader = pathname?.includes('/entitlement-owner');

  // Check if we should show campaign-specific header (only when inside a specific campaign)
  const shouldShowCampaignHeader = pathname?.includes('/campaigns/manage-campaigns/');

  const flattenNavItems = (items: NavItem[]): NavItem[] => {
    const out: NavItem[] = [];
    for (const item of items) {
      out.push(item);
      if (item.subItems?.length) {
        out.push(...flattenNavItems(item.subItems));
      }
    }
    return out;
  };

  const getHeadingFromNav = (currentPath: string): string | null => {
    const allItems = flattenNavItems(navLinks);
    const navPath = (href: string) => href.split("?")[0].split("#")[0];
    const candidates = allItems.filter((item) => {
      if (!item.href || item.href === "/") return currentPath === "/";
      const h = navPath(item.href);
      return currentPath === h || currentPath.startsWith(`${h}/`);
    });

    if (candidates.length === 0) return null;

    const bestMatch = candidates.sort((a, b) => b.href.length - a.href.length)[0];
    return bestMatch?.name || null;
  };

  const toTitleCaseFromSlug = (value: string): string => {
    return value
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const getGenericGatewayPageTitle = (currentPath: string): string | null => {
    if (!currentPath.startsWith("/settings/gateway/")) return null;
    const rest = currentPath.replace("/settings/gateway/", "");
    if (!rest) return null;

    const parts = rest.split("/").filter(Boolean);
    if (parts.length === 0) return null;

    const last = parts[parts.length - 1];
    const prev = parts.length > 1 ? parts[parts.length - 2] : "";

    if (last === "new" || last === "create" || last === "review" || last === "edit") {
      const action = toTitleCaseFromSlug(last);
      const subject = toTitleCaseFromSlug(prev || "page");
      return `${action} ${subject}`;
    }

    return toTitleCaseFromSlug(last);
  };

  const getNavbarHeading = (): string | null => {
    if (!pathname) return null;

    // Access Request area
    if (pathname.startsWith("/access-request/pending-approvals")) return "My Approvals";
    if (pathname.startsWith("/access-request")) return "Access Request";

    // Gateway settings headings that previously rendered blank in header
    if (pathname === "/settings/gateway/manage-access-policy") return "Manage Access Policy";
    if (pathname === "/settings/gateway/manage-access-policy/new") {
      const isView = searchParams?.get("view") === "1";
      const isEdit = searchParams?.get("edit") === "1";
      if (isView && isEdit) return "Edit Access Policy";
      if (isView) return "Review Access Policy";
      return "Create Access Policy";
    }
    if (pathname === "/settings/gateway/manage-approval-policies") {
      const isEdit = searchParams?.get("edit") === "1";
      return isEdit ? "Edit Approval Policy" : "Manage Approval Policies";
    }
    if (pathname === "/settings/gateway/manage-approval-policies/review") return "Review Approval Policy";
    if (pathname === "/settings/gateway/nhi-settings") return "NHI Settings";
    if (pathname === "/settings/gateway/lookup-custom-approvers") return "Lookup For Custom Approvers";
    if (pathname === "/settings/gateway/lookup-custom-approvers/new") {
      return "New condition rule";
    }
    if (
      /^\/settings\/gateway\/lookup-custom-approvers\/[^/]+$/.test(pathname) &&
      pathname !== "/settings/gateway/lookup-custom-approvers"
    ) {
      return "Lookup rule details";
    }
    if (pathname === "/non-human-identity/request-access") return "Request Access / Breakglass";
    if (pathname === "/non-human-identity/create-nhi") return "Create new NHI";

    const headingFromNav = getHeadingFromNav(pathname);
    if (headingFromNav && headingFromNav !== "Generic") return headingFromNav;

    const genericGatewayTitle = getGenericGatewayPageTitle(pathname);
    if (genericGatewayTitle) return genericGatewayTitle;

    return headingFromNav;
  };

  const navbarHeading = getNavbarHeading();


  // Calculate days left
  const calculateDaysLeft = (expirationDateStr: string): number => {
    if (!expirationDateStr) return 0;
    const expiration = new Date(expirationDateStr);
    const now = new Date();
    const diffTime = expiration.getTime() - now.getTime();
    return Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 0);
  };

  const handleUserDropdownCloseMenu = useCallback((closeFunc: () => void) => {
    closeUserMenuRef.current = closeFunc;
  }, []);

  // Handler for Profile click in dropdown
  const handleProfileClick = () => {
    closeUserMenuRef.current?.();
    if (userDetails) {
      router.push(`/profile`);
    }
  };

  // Handler for Logout click in dropdown
  const handleLogoutClick = () => {
    closeUserMenuRef.current?.();
    logout();
  };

  // Update header data function
  const updateHeaderData = (data: UserRowData[]) => {
    if (data.length > 0) {
      const firstItem = data[0];
      const daysLeft = calculateDaysLeft(firstItem.certificationExpiration || "");

      setHeaderInfo({
        campaignName: firstItem.certificationName || "Campaign Name",
        status: "",
        snapshotAt: "",
        dueDate: firstItem.certificationExpiration || "",
        daysLeft: daysLeft,
      });

      setUserDetails({
        username: firstItem.fullName || "IAM Admin",
        userId: firstItem.id || "N/A",
        userStatus: firstItem.status || "Active",
        manager: firstItem.manager || "N/A",
        department: firstItem.department || "N/A",
        jobTitle: firstItem.jobtitle || "N/A",
        userType: firstItem.userType || "Internal",
      });
    }
  };

  // Update progress data function
  const updateProgressData = (data: any) => {
    setProgressData(data);
  };

  // Calculate user-based progress (matching access review page)
  const calculateUserProgress = (userData: any) => {
    const total = userData.numOfEntitlements || 0;
    const approved = userData.numOfEntitlementsCertified || 0;
    const rejected = userData.numOfEntitlementsRejected || 0;
    const revoked = userData.numOfEntitlementsRevoked || 0;
    const completed = approved + rejected + revoked; // Certified, rejected, and revoked all count as progress
    const pending = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      totalItems: total,
      approvedCount: approved,
      rejectedCount: rejected,
      revokedCount: revoked,
      completedCount: completed,
      pendingCount: pending,
      percentage: percentage,
    };
  };

  // Effect to populate header info from localStorage
  useEffect(() => {
    const updateHeaderData = () => {
      try {
        // Prefer campaign summary if available (for campaign manage pages)
        const selectedCampaignSummary = localStorage.getItem("selectedCampaignSummary");
        if (selectedCampaignSummary) {
          const summary = JSON.parse(selectedCampaignSummary);
          const daysLeft = calculateDaysLeft(summary.dueDate || "");

          setHeaderInfo({
            campaignName: summary.campaignName || "Campaign Name",
            status: summary.status || "",
            snapshotAt: summary.snapshotAt || "",
            dueDate: summary.dueDate || "",
            daysLeft: daysLeft,
          });
        }

        const sharedRowData = localStorage.getItem("sharedRowData");
        if (sharedRowData) {
          const data = JSON.parse(sharedRowData);
          if (Array.isArray(data) && data.length > 0) {
            const firstItem = data[0];
            const daysLeft = calculateDaysLeft(firstItem.certificationExpiration || "");

            // Only update header info if we don't have campaign summary data
            if (!selectedCampaignSummary) {
              setHeaderInfo((prev) => ({
                campaignName: firstItem.certificationName || prev.campaignName || "Campaign Name",
                status: prev.status || "",
                snapshotAt: prev.snapshotAt || "",
                dueDate: firstItem.certificationExpiration || prev.dueDate || "",
                daysLeft: prev.dueDate ? prev.daysLeft : daysLeft,
              }));
            }

            setUserDetails({
              username: firstItem.fullName || "IAM Admin",
              userId: firstItem.id || "N/A",
              userStatus: firstItem.status || "Active",
              manager: firstItem.manager || "N/A",
              department: firstItem.department || "N/A",
              jobTitle: firstItem.jobtitle || "N/A",
              userType: firstItem.userType || "Internal",
            });

            // Prefer campaign progress from Access Review list (same % as list) on campaign pages
            const currentPath = pathnameRef.current ?? pathname;
            const onCampaignPage = currentPath?.includes("/app-owner") || currentPath?.includes("/access-review");
            const summary = selectedCampaignSummary ? JSON.parse(selectedCampaignSummary) : null;
            const useListProgress =
              onCampaignPage &&
              summary?.progress != null &&
              summary?.totalItems != null &&
              summary?.approvedCount !== undefined &&
              summary?.pendingCount !== undefined;
            if (useListProgress) {
              setUserProgressData({
                totalItems: summary.totalItems,
                approvedCount: summary.approvedCount ?? 0,
                pendingCount: summary.pendingCount ?? 0,
                percentage: summary.progress,
              });
            } else {
              const userProgress = calculateUserProgress(firstItem);
              setUserProgressData(userProgress);
            }
          }
        }
      } catch (error) {
        console.error("Error parsing localStorage data:", error);
      }
    };

    // Initial call
    updateHeaderData();

    // Listen for storage changes
    const handleStorageChange = () => {
      updateHeaderData();
    };

    // Listen for custom localStorage change event
    const handleLocalStorageChange = () => {
      updateHeaderData();
    };

    // Listen for progress data changes
    const handleProgressDataChange = (event: CustomEvent) => {
      updateProgressData(event.detail);

      // Check if it's user-based progress data (from getUserProgress)
      if (event.detail && event.detail.percentage !== undefined) {
        // This is user-based progress data
        const userProgress = {
          totalItems: event.detail.total || 0,
          approvedCount: event.detail.approved || 0,
          pendingCount: event.detail.pending || 0,
          percentage: event.detail.percentage || 0
        };
        setUserProgressData(userProgress);
      } else if (event.detail && event.detail.totalItems !== undefined) {
        // This is entitlement-based progress data (fallback)
        const userProgress = {
          totalItems: event.detail.totalItems,
          approvedCount: event.detail.approvedCount,
          pendingCount: event.detail.pendingCount,
          percentage: event.detail.totalItems > 0 ?
            Math.round(((event.detail.approvedCount + event.detail.revokedCount + event.detail.delegatedCount + event.detail.remediatedCount) / event.detail.totalItems) * 100) : 0
        };
        setUserProgressData(userProgress);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageChange', handleLocalStorageChange);
    window.addEventListener('progressDataChange', handleProgressDataChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange', handleLocalStorageChange);
      window.removeEventListener('progressDataChange', handleProgressDataChange as EventListener);
    };
  }, []);

  // Effect to handle application details
  useEffect(() => {
    const handleApplicationDataChange = (event: CustomEvent) => {
      console.log('Application data change event received:', event.detail);
      setApplicationDetails(event.detail);
    };

    // Load application details from localStorage on mount
    const loadApplicationDetails = () => {
      try {
        const stored = localStorage.getItem('applicationDetails');
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log('Loaded application details from localStorage:', parsed);
          setApplicationDetails(parsed);
        }
      } catch (error) {
        console.error('Error loading application details:', error);
      }
    };

    // Initial load
    loadApplicationDetails();

    // Listen for application data changes
    window.addEventListener('applicationDataChange', handleApplicationDataChange as EventListener);

    return () => {
      window.removeEventListener('applicationDataChange', handleApplicationDataChange as EventListener);
    };
  }, []);


  // Debug logging
  useEffect(() => {
    console.log('HeaderContent - pathname:', pathname);
    console.log('HeaderContent - applicationDetails:', applicationDetails);
    console.log('HeaderContent - shouldShowHeader:', shouldShowHeader);
    console.log('HeaderContent - shouldShowAppOwnerHeader:', shouldShowAppOwnerHeader);
    console.log('HeaderContent - shouldShowCampaignHeader:', shouldShowCampaignHeader);
  }, [pathname, applicationDetails, shouldShowHeader, shouldShowAppOwnerHeader, shouldShowCampaignHeader]);

  return (
    <div
      className="flex h-[60px] w-full items-center justify-between text-xs md:text-sm pl-0 pr-4"
      style={{ backgroundColor: '#27B973' }}
    >
      {/* Left Section */}
      <div className="flex items-center h-full -ml-3 flex-1">
        {/* Hamburger Menu Button */}
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center px-3 py-3 mr-4 text-white hover:bg-white/10 rounded-md transition-colors"
          title={isVisible ? "Hide sidebar" : "Show sidebar"}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="transition-transform duration-200 h-5 w-5 flex-shrink-0"
          >
            <path
              d="M3 12H21M3 6H21M3 18H21"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Logo and Brand */}
        <div className="flex items-center gap-3 mr-8">
          <button
            onClick={() => router.push('/')}
            className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2"
            aria-label="Navigate to Dashboard"
          >
            {/* Icon-only logo (previous logo) */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="flex-shrink-0"
            >
              <path
                d="M22.6616 6.01866L6.00958 22.6705C6.90371 23.9896 8.03687 25.1227 9.34707 25.9903L25.9725 9.3649C25.1049 8.04584 23.9718 6.91268 22.6527 6.02741L22.6616 6.01866Z"
                fill="#58E5A1"
              />
              <path
                d="M16.0043 4.00021C9.37365 4.00021 4 9.37375 4 16.0044C4 16.6064 4.04429 17.1995 4.13281 17.775L17.7749 4.13303C17.1994 4.0445 16.5975 4.00021 16.0043 4.00021Z"
                fill="white"
              />
              <path
                d="M27.8672 14.2426L14.2429 27.867C14.8183 27.9555 15.4114 27.9998 16.0045 27.9998C22.6352 27.9998 28 22.635 28 16.0043C28 15.4023 27.9557 14.8181 27.8672 14.2426Z"
                fill="#58E5A1"
              />
            </svg>

            {/* Brand name text */}
            <span className="text-xl md:text-2xl font-semibold tracking-tight text-white">
              KeyForge
            </span>
          </button>
        </div>

        {applicationDetails && pathname?.includes('/applications/') ? (
          <div className="flex h-full items-center header-content gap-2 md:gap-4 overflow-hidden">
            <div className="flex items-center px-4 min-w-0">
              <p
                className="font-medium text-white truncate"
                title={applicationDetails.applicationName}
              >
                Application: {applicationDetails.applicationName}
              </p>
            </div>
            <div className="flex items-center px-2">
              <span className="text-white text-lg">•</span>
            </div>
            <div className="flex items-center px-4 min-w-0">
              <p
                className="font-medium text-white truncate"
                title={applicationDetails.owner}
              >
                Owner: {applicationDetails.owner}
              </p>
            </div>
            <div className="flex items-center px-2">
              <span className="text-white text-lg">•</span>
            </div>
            <div className="flex items-center px-4 min-w-0">
              <p
                className="font-medium text-white truncate"
                title={applicationDetails.lastSync}
              >
                Last Sync: {formatDateMMDDYY(applicationDetails.lastSync)}
              </p>
            </div>
          </div>
        ) : shouldShowHeader ? (
          <div className="flex h-full items-center header-content gap-1.5 md:gap-2 overflow-hidden">
            <div className="flex items-center px-2 min-w-0 max-w-[280px] md:max-w-[380px]">
              <p
                className="font-semibold text-white text-xs md:text-sm whitespace-normal break-words leading-tight line-clamp-2"
                title={headerInfo.campaignName || "Quarterly Access Review - Megan Jackson"}
              >
                {headerInfo.campaignName || "Quarterly Access Review - Megan Jackson"}
              </p>
            </div>
            <div className="flex items-center px-1 flex-shrink-0">
              <span className="text-white text-base">•</span>
            </div>
            <div className="flex items-center px-1 min-w-0">
              <p className="font-medium text-white whitespace-nowrap text-xs md:text-sm">
                Generated On {headerInfo.snapshotAt ? formatDateMMDDYY(headerInfo.snapshotAt) : "N/A"}
              </p>
            </div>
            <div className="flex items-center px-1 flex-shrink-0">
              <span className="text-white text-base">•</span>
            </div>
            <div className="flex items-center px-1 min-w-0">
              <p className="font-medium text-white whitespace-nowrap text-xs md:text-sm">
                Due In {headerInfo.daysLeft || 0} days
                <span className="font-medium ml-1 text-white text-xs md:text-sm">
                  ({headerInfo.dueDate ? formatDateMMDDYY(headerInfo.dueDate) : "N/A"})
                </span>
              </p>
            </div>
            {/* User Progress - single line only */}
            <div className="flex items-center px-2 flex-shrink-0 whitespace-nowrap">
              <UserProgress progressData={userProgressData} />
            </div>
          </div>
        ) : shouldShowCampaignHeader ? (
          <div className="flex h-full items-center header-content gap-2 md:gap-3 overflow-hidden">
            <div className="flex items-center px-3 min-w-0 max-w-[320px] md:max-w-[420px]">
              <p
                className="font-semibold text-white text-sm md:text-base whitespace-normal break-words leading-tight line-clamp-2"
                title={headerInfo.campaignName || "Campaign"}
              >
                {headerInfo.campaignName || "Campaign"}
              </p>
            </div>
            <div className="flex items-center px-1 flex-shrink-0">
              <span className="text-white text-base">•</span>
            </div>
            <div className="flex items-center px-1 min-w-0">
              <p className="font-medium text-white whitespace-nowrap text-xs md:text-sm">
                {headerInfo.status ? `Status: ${headerInfo.status}` : "Status: N/A"}
              </p>
            </div>
            <div className="flex items-center px-1 flex-shrink-0">
              <span className="text-white text-base">•</span>
            </div>
            <div className="flex items-center px-1 min-w-0">
              <p className="font-medium text-white whitespace-nowrap text-xs md:text-sm">
                {headerInfo.snapshotAt ? `Data Snapshot: ${formatDateMMDDYY(headerInfo.snapshotAt)}` : "Data Snapshot: N/A"}
              </p>
            </div>
            <div className="flex items-center px-1 flex-shrink-0">
              <span className="text-white text-base">•</span>
            </div>
            <div className="flex items-center px-1 min-w-0">
              <p className="font-medium text-white whitespace-nowrap leading-tight text-xs md:text-sm">
                {headerInfo.dueDate ? `Due on ${formatDateMMDDYY(headerInfo.dueDate)}` : "Due on N/A"}
                <span className="font-bold text-white ml-1 text-xs md:text-sm">
                  ({headerInfo.daysLeft || 0} days left)
                </span>
              </p>
            </div>
          </div>
        ) : shouldShowAppOwnerHeader ? (
          <div className="flex h-full items-center header-content gap-1.5 md:gap-2 overflow-hidden">
            <div className="flex items-center px-2 min-w-0 max-w-[260px] md:max-w-[360px]">
              <p
                className="font-semibold text-white text-xs md:text-sm whitespace-normal break-words leading-tight line-clamp-2"
                title={headerInfo.campaignName || "App Owner Review"}
              >
                {headerInfo.campaignName || "App Owner Review"}
              </p>
            </div>
            <div className="flex items-center px-1 flex-shrink-0">
              <span className="text-white text-xs md:text-sm">•</span>
            </div>
            <div className="flex items-center px-1 min-w-0">
              <p className="font-medium text-white whitespace-nowrap text-[10px] md:text-xs">
                Generated On: {headerInfo.snapshotAt ? formatDateMMDDYY(headerInfo.snapshotAt) : "N/A"}
              </p>
            </div>
            <div className="flex items-center px-1 flex-shrink-0">
              <span className="text-white text-xs md:text-sm">•</span>
            </div>
            <div className="flex items-center px-1 min-w-0">
              <p className="font-medium text-white whitespace-nowrap text-[10px] md:text-xs">
                Due In {headerInfo.daysLeft || 0} days
                <span className="font-bold ml-1 text-white text-[10px] md:text-xs">
                  ({headerInfo.dueDate ? formatDateMMDDYY(headerInfo.dueDate) : "N/A"})
                </span>
              </p>
            </div>
            {/* User Progress - single line only */}
            <div className="flex items-center px-1.5 flex-shrink-0 whitespace-nowrap">
              <UserProgress progressData={userProgressData} />
            </div>
          </div>
        ) : shouldShowEntitlementOwnerHeader ? (
          <div className="flex h-full items-center header-content gap-2 md:gap-3 overflow-hidden">
            <div className="flex items-center px-3 min-w-0 max-w-[320px] md:max-w-[420px]">
              <p
                className="font-semibold text-white text-sm md:text-base whitespace-normal break-words leading-tight line-clamp-2"
                title={headerInfo.campaignName || "Entitlement Owner Review"}
              >
                {headerInfo.campaignName || "Entitlement Owner Review"}
              </p>
            </div>
            <div className="flex items-center px-1 flex-shrink-0">
              <span className="text-white text-base">•</span>
            </div>
            <div className="flex items-center px-1 min-w-0">
              <p className="font-medium text-white whitespace-nowrap text-xs md:text-sm">
                Generated On: {headerInfo.snapshotAt ? formatDateMMDDYY(headerInfo.snapshotAt) : "N/A"}
              </p>
            </div>
            <div className="flex items-center px-1 flex-shrink-0">
              <span className="text-white text-base">•</span>
            </div>
            <div className="flex items-center px-1 min-w-0">
              <p className="font-medium text-white whitespace-nowrap text-xs md:text-sm">
                Due In {headerInfo.daysLeft || 0} days
                <span className="font-bold ml-1 text-white text-xs md:text-sm">
                  ({headerInfo.dueDate ? formatDateMMDDYY(headerInfo.dueDate) : "N/A"})
                </span>
              </p>
            </div>
            <div className="flex items-center px-2 flex-shrink-0 whitespace-nowrap">
              <UserProgress progressData={userProgressData} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center flex-1 px-4">
            {navbarHeading && (
              <p className="text-lg font-semibold text-white">
                {navbarHeading}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center h-full justify-end gap-2 px-3">
        <div className="flex items-center gap-3">
          {renderUserAvatar(userDetails, 36, "object-cover rounded-full w-9 h-9")}
          <span className="text-white font-medium text-[11px] md:text-xs max-w-[180px] truncate">
            {(() => {
              // Prefer authenticated user from context (set to userid at login)
              if (user?.email) return user.email;
              // Fallback to cookie `uidTenant`
              try {
                const raw = getCookie(COOKIE_NAMES.UID_TENANT);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed?.userid) return parsed.userid;
                }
              } catch {}
              // Fallback to any current user util
              const current = getCurrentUser();
              if (current?.email) return current.email;
              return userDetails?.username || "IAM Admin";
            })()}
          </span>
          <Dropdown
            Icon={() => (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 9L12 15L18 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            className="!p-0 !bg-transparent !border-0"
            title="User profile"
            onCloseMenu={handleUserDropdownCloseMenu}
          >
            <button
              onClick={handleProfileClick}
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left"
            >
              Profile
            </button>
            {/* <a
              href="#"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
            >
              Settings
            </a> */}
            <button
              onClick={handleLogoutClick}
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left"
            >
              Logout
            </button>
          </Dropdown>
        </div>
      </div>

      {/* PopupButton */}
      {showPopupButton && userDetails && (
        <PopupButton
          username={userDetails.username}
          userId={userDetails.userId}
          userStatus={userDetails.userStatus}
          manager={userDetails.manager}
          department={userDetails.department}
          jobTitle={userDetails.jobTitle}
          userType={userDetails.userType}
          onClose={() => setShowPopupButton(false)}
        />
      )}
    </div>
  );
};

export default HeaderContent;