"use client";
import SegmentedControl from "@/components/SegmentedControl";
import { themeQuartz } from "ag-grid-community";
import {
  History,
  CircleX,
  CirclePlus,
  Search,
  Plus,
  Ban,
  Calendar,
  Edit,
  Trash2,
  Printer,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { executeQuery } from "@/lib/api";
import type { ColDef } from "ag-grid-enterprise";
import dynamic from "next/dynamic";
import { useReactToPrint } from "react-to-print";
import "@/components/scheduler/SchedulerManager.css";

// Dynamically import AgGridReact with SSR disabled
const AgGridReact = dynamic(() => import("ag-grid-react").then((mod) => mod.AgGridReact), {
  ssr: false,
});
import "@/lib/ag-grid-setup";

// Dynamically import Bar chart with SSR disabled
const Bar = dynamic(() => import("react-chartjs-2").then((mod) => mod.Bar), {
  ssr: false,
});

import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  ChartData,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import UserDisplayName from "@/components/UserDisplayName";
import ActionCompletedToast from "@/components/ActionCompletedToast";
import { formatDateMMDDYYSlashes } from "@/utils/utils";
import {
  loadJitAccessHistory,
  saveJitAccessHistory,
  type JitAccessHistoryRow,
} from "@/lib/jitAccessHistoryStorage";

const JIT_HISTORY_SEED: JitAccessHistoryRow[] = [
  {
    id: "seed-1",
    date: "02/12/2026",
    requestedDuration: 4,
    startTime: "02:30 PM",
    endTime: "06:30 PM",
    status: "Completed",
  },
  {
    id: "seed-2",
    date: "11/14/2025",
    requestedDuration: 1,
    startTime: "11:00 AM",
    endTime: "12:00 PM",
    status: "Completed",
  },
  {
    id: "seed-3",
    date: "12/16/2025",
    requestedDuration: 1,
    startTime: "09:00 AM",
    endTime: "10:00 AM",
    status: "Completed",
  },
];

// Register Chart.js components and plugin
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, ChartDataLabels);

type ProfileUser = {
  firstName: string;
  lastName: string;
  email: string;
  displayName: string;
  alias: string;
  phone?: string;
  title?: string;
  department?: string;
  startDate?: string;
  userType?: string;
  managerEmail?: string;
  tags: string[];
  status?: string;
  /** ISO date string yyyy-mm-dd when known */
  dob?: string;
};

const buildUserFromStorage = (): ProfileUser => {
  try {
    // Prefer the full raw user saved from the list page
    const fullStr = localStorage.getItem("selectedUserRawFull");
    if (fullStr) {
      const u = JSON.parse(fullStr);
      const displayName = u.displayname || u.displayName || `${u.firstname ?? ""} ${u.lastname ?? ""}`.trim() || u.username || "Unknown";
      const email = u.email?.work || u.customattributes?.emails?.[0]?.value || u.username || "no-email@example.com";
      return {
        firstName: u.firstname || u.customattributes?.name?.givenName || displayName.split(" ")[0] || "",
        lastName: u.lastname || u.customattributes?.name?.familyName || displayName.split(" ").slice(1).join(" ") || "",
        email,
        displayName,
        alias: u.username || u.customattributes?.id || email,
        phone: u.phonenumber?.work || u.customattributes?.phoneNumbers?.[0]?.value || "",
        title: u.title || u.customattributes?.title || "",
        department: u.department || u.customattributes?.enterpriseUser?.department || "",
        startDate: u.startdate || u.customattributes?.["urn:ietf:params:scim:schemas:extension:custom"]?.startdate || "",
        userType: u.employeetype || u.customattributes?.userType || "",
        managerEmail: u.managername || u.customattributes?.enterpriseUser?.manager?.value || "",
        dob: u.dob || u.customattributes?.birthdate || "",
        tags: [u.employeetype || u.customattributes?.userType || "User"].filter(Boolean),
        status:
          u.status ||
          u.userstatus ||
          u.accountstatus ||
          u.customattributes?.status ||
          "Active",
      };
    }
  } catch {}
  try {
    // Fallback to the lightweight selected row
    const sel = localStorage.getItem("selectedUserRaw");
    if (sel) {
      const s = JSON.parse(sel);
      const displayName = s.name || "Unknown";
      const [fn, ...rest] = displayName.split(" ");
      return {
        firstName: fn || "",
        lastName: rest.join(" "),
        email: s.email || "no-email@example.com",
        displayName,
        alias: s.email || displayName,
        phone: "",
        title: s.title || "",
        department: s.department || "",
        startDate: "",
        userType: s.tags || "",
        managerEmail: s.managerName || "",
        dob: "",
        tags: [s.tags || "User"].filter(Boolean),
        status: s.status || "Active",
      };
    }
  } catch {}
  // Final fallback
  return {
    firstName: "",
    lastName: "",
    email: "no-email@example.com",
    displayName: "Unknown",
    alias: "",
    phone: "",
    title: "",
    department: "",
    startDate: "",
    userType: "",
    managerEmail: "",
    dob: "",
    tags: ["User"],
    status: "Active",
  };
};

function persistProfileUserToStorage(profile: ProfileUser) {
  try {
    const fullStr = localStorage.getItem("selectedUserRawFull");
    if (fullStr) {
      const u = JSON.parse(fullStr);
      u.firstname = profile.firstName;
      u.lastname = profile.lastName;
      if (typeof u.email === "object" && u.email !== null && "work" in u.email) {
        u.email = { ...u.email, work: profile.email };
      } else {
        u.email = profile.email;
      }
      u.displayname = profile.displayName;
      u.displayName = profile.displayName;
      u.username = profile.alias;
      u.title = profile.title;
      u.department = profile.department;
      u.startdate = profile.startDate;
      u.employeetype = profile.userType;
      u.managername = profile.managerEmail;
      u.status = profile.status;
      u.userstatus = profile.status;
      if (profile.dob) {
        u.dob = profile.dob;
      }
      localStorage.setItem("selectedUserRawFull", JSON.stringify(u));
    }
  } catch {
    // ignore
  }
  try {
    const sel = localStorage.getItem("selectedUserRaw");
    if (sel) {
      const s = JSON.parse(sel);
      s.name = profile.displayName;
      s.email = profile.email;
      s.title = profile.title;
      s.department = profile.department;
      s.tags = profile.tags?.[0] ?? profile.userType ?? "";
      s.managerName = profile.managerEmail;
      s.status = profile.status;
      localStorage.setItem("selectedUserRaw", JSON.stringify(s));
    }
  } catch {
    // ignore
  }
}

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
    entitlements: [
      { entName: "CRM_READ", risk: "Low", description: "Read-only access to CRM", assignedOn: "2023-06-01", lastReviewed: "2025-07-15", tags: ["Read", "CRM"] },
      { entName: "CRM_WRITE", risk: "Medium", description: "Write access to CRM", assignedOn: "2023-06-01", lastReviewed: "2025-07-15", tags: ["Write", "CRM"] },
    ],
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
    entitlements: [
      { entName: "HR_ADMIN", risk: "High", description: "Admin access to HR Portal", assignedOn: "2023-05-10", lastReviewed: "2025-06-30", tags: ["Admin", "HR"] },
    ],
  },
];

// Add Proxy User Sidebar Component
const AddProxyUserSidebar = ({
  onClose,
  onProxyUserCreated,
}: {
  onClose: () => void;
  onProxyUserCreated: () => Promise<void>;
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [apiUsers, setApiUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [justification, setJustification] = useState("");
  const [capabilities, setCapabilities] = useState({
    requestAccess: false,
    reviewAndApprove: false,
    performAccessReviews: false,
  });
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch users from API with debounce
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (searchValue.trim().length >= 2) {
      setIsLoadingUsers(true);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const query = `SELECT * FROM usr WHERE username ILIKE ? OR email::text ILIKE ? ORDER BY username ASC LIMIT 25`;
          const response = await executeQuery(query, [`%${searchValue}%`, `%${searchValue}%`]);
          
          let usersData: any[] = [];
          if (response?.resultSet && Array.isArray(response.resultSet)) {
            usersData = response.resultSet.map((user: any) => {
              let emailValue = "";
              if (user.email) {
                if (typeof user.email === "string") {
                  emailValue = user.email;
                } else if (user.email.work) {
                  emailValue = user.email.work;
                } else if (Array.isArray(user.email) && user.email.length > 0) {
                  const primaryEmail = user.email.find((e: any) => e.primary) || user.email[0];
                  emailValue = primaryEmail?.value || "";
                }
              }
              const internalId =
                user.userid ?? user.id ?? user.userUniqueID ?? "";
              return {
                userid: internalId,
                id: internalId,
                username: user.username || "",
                email: emailValue,
              };
            });
          }
          // Remove duplicates by userid/id and hide the currently selected profile user
          const currentProfileUserId = (() => {
            try {
              const raw = localStorage.getItem("selectedUserRawFull");
              if (!raw) return "";
              const parsed = JSON.parse(raw);
              return parsed?.userid ?? parsed?.id ?? parsed?.userId ?? "";
            } catch {
              return "";
            }
          })();
          const seen = new Set<string>();
          const deduped = usersData.filter((u) => {
            const id = String(u.userid ?? u.id ?? "");
            if (!id || id === currentProfileUserId || seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          setApiUsers(deduped);
        } catch (error) {
          console.error("Error fetching users:", error);
          setApiUsers([]);
        } finally {
          setIsLoadingUsers(false);
        }
      }, 500);
    } else {
      setApiUsers([]);
      setIsLoadingUsers(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchValue]);

  const filteredUsers = useMemo(() => {
    if (!searchValue.trim()) return [];
    return apiUsers.filter((user) => {
      const searchLower = searchValue.toLowerCase();
      return (
        user.username?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      );
    });
  }, [apiUsers, searchValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      alert("Please select a user");
      return;
    }
    if (!startDate || !endDate) {
      alert("Please select start and end dates");
      return;
    }
    if (!justification.trim()) {
      alert("Please provide a justification");
      return;
    }
    if (
      !capabilities.requestAccess &&
      !capabilities.reviewAndApprove &&
      !capabilities.performAccessReviews
    ) {
      alert("Please select at least one capability");
      return;
    }

    const proxyUserId =
      selectedUser.userid ?? selectedUser.id ?? selectedUser.userUniqueID ?? "";
    if (!proxyUserId) {
      alert("Could not resolve the selected user's id. Please pick another user or try again.");
      return;
    }

    // identity must be the proxy target user's UUID (usr.userid), not email/username
    const proxyUserData = {
      startDate,
      endDate,
      identity: proxyUserId,
      userName: selectedUser.username || "",
      justification,
      capabilities: [
        capabilities.requestAccess && "Request Access",
        capabilities.reviewAndApprove && "Review and approve Requests",
        capabilities.performAccessReviews && "Perform Access Reviews",
      ]
        .filter(Boolean)
        .join(", "),
    };

    // Resolve userid of the current user from localStorage, falling back to a default UUID
    const getUserIdForProxy = (): string => {
      try {
        const fullStr = localStorage.getItem("selectedUserRawFull");
        if (fullStr) {
          const u = JSON.parse(fullStr);
          return (
            u.userid ||
            u.id ||
            u.userId ||
            u.customattributes?.id ||
            "0109868e-b00c-4f24-ae5f-258029cce1d6"
          );
        }
      } catch {}
      try {
        const sel = localStorage.getItem("selectedUserRaw");
        if (sel) {
          const s = JSON.parse(sel);
          return s.id || s.userId || "0109868e-b00c-4f24-ae5f-258029cce1d6";
        }
      } catch {}
      return "0109868e-b00c-4f24-ae5f-258029cce1d6";
    };

    const userid = getUserIdForProxy();

    const existingProxyUsers = (() => {
      try {
        const fullStr = localStorage.getItem("selectedUserRawFull");
        if (!fullStr) return [];
        const parsed = JSON.parse(fullStr);
        const current = Array.isArray(parsed?.proxy_user) ? parsed.proxy_user : [];
        return current.map((p: any) => ({
          startDate: p?.startDate || p?.startdate || "",
          endDate: p?.endDate || p?.enddate || "",
          identity: p?.identity || "",
          userName: p?.userName || p?.username || "",
          justification: p?.justification || "",
          capabilities: p?.capabilities || "",
        }));
      } catch {
        return [];
      }
    })();

    const mergedProxyUsers = [...existingProxyUsers, proxyUserData];

    // Build payload for kf_apply_object_change('identity', 'PATCH', ?::jsonb)
    const proxyPayload = {
      userid,
      proxy_user: mergedProxyUsers,
    };

    try {
      await executeQuery(
        "SELECT kf_apply_object_change('identity', 'PATCH', ?::jsonb)",
        // The entities API accepts arbitrary JSON for parameters, including objects
        [proxyPayload as any]
      );
      await onProxyUserCreated();
      onClose();
    } catch (error) {
      console.error("Error adding proxy user:", error);
      alert("Failed to add proxy user. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* User Search Section */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Search and Select User
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="text-gray-400 w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchValue}
            onFocus={() => setShowResults(true)}
            onChange={(e) => {
              setSearchValue(e.target.value);
              setShowResults(true);
              setSelectedUser(null);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        
        {/* User Results */}
        {isLoadingUsers && showResults && (
          <div className="mt-2 text-sm text-gray-500">Searching...</div>
        )}
        {!isLoadingUsers && showResults && searchValue.trim().length >= 2 && filteredUsers.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
            {filteredUsers.map((user, index) => (
              <div
                key={String(user.id ?? user.userid ?? user.username ?? index)}
                onClick={() => {
                  setSelectedUser(user);
                  setSearchValue(user.username || user.email);
                  setApiUsers([]);
                  setShowResults(false);
                }}
                className={`p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                  (selectedUser?.userid ?? selectedUser?.id) === (user.userid ?? user.id) ? "bg-blue-50 border-blue-200" : ""
                }`}
              >
                <div className="font-medium text-gray-900">{user.username || "N/A"}</div>
                <div className="text-sm text-gray-600">{user.email || "N/A"}</div>
              </div>
            ))}
          </div>
        )}
        {!isLoadingUsers && showResults && searchValue.trim().length >= 2 && filteredUsers.length === 0 && (
          <div className="mt-2 text-sm text-gray-500">No users found.</div>
        )}
        {!isLoadingUsers && showResults && searchValue.trim().length > 0 && searchValue.trim().length < 2 && (
          <div className="mt-2 text-sm text-gray-500">Type at least 2 characters to search.</div>
        )}
        {selectedUser && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
            <span className="text-sm font-medium text-blue-700">
              Selected: {selectedUser.username || selectedUser.email}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedUser(null);
                setSearchValue("");
                setShowResults(true);
              }}
              className="ml-2 text-blue-600 hover:text-blue-800 text-sm"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Date Section */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            End Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            required
          />
        </div>
      </div>

      {/* Justification Section */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Justification <span className="text-red-500">*</span>
        </label>
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          rows={4}
          placeholder="Enter justification for proxy access..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          required
        />
      </div>

      {/* Capabilities Section */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Capabilities <span className="text-red-500">*</span>
        </label>
        <div className="space-y-3">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={capabilities.requestAccess}
              onChange={(e) =>
                setCapabilities({ ...capabilities, requestAccess: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Request Access</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={capabilities.reviewAndApprove}
              onChange={(e) =>
                setCapabilities({ ...capabilities, reviewAndApprove: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Review and approve Requests</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={capabilities.performAccessReviews}
              onChange={(e) =>
                setCapabilities({ ...capabilities, performAccessReviews: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Perform Access Reviews</span>
          </label>
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Proxy User
        </button>
      </div>
    </form>
  );
};

export default function UserDetailPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [userData, setUserData] = useState<ProfileUser>(() => buildUserFromStorage());
  const [showProxyCreatedToast, setShowProxyCreatedToast] = useState(false);
  const [proxyUsersRefreshKey, setProxyUsersRefreshKey] = useState(0);
  const { openSidebar, closeSidebar } = useRightSidebar();

  const getUserIdFromStorage = (): string => {
    try {
      const fullStr = localStorage.getItem("selectedUserRawFull");
      if (fullStr) {
        const u = JSON.parse(fullStr);
        return (
          u.userid ||
          u.id ||
          u.userId ||
          u.customattributes?.id ||
          "0109868e-b00c-4f24-ae5f-258029cce1d6"
        );
      }
    } catch {}
    try {
      const sel = localStorage.getItem("selectedUserRaw");
      if (sel) {
        const s = JSON.parse(sel);
        return s.id || s.userId || "0109868e-b00c-4f24-ae5f-258029cce1d6";
      }
    } catch {}
    return "0109868e-b00c-4f24-ae5f-258029cce1d6";
  };

  const refreshSelectedUserData = async () => {
    const userid = getUserIdFromStorage();
    try {
      const res: any = await executeQuery("select * from usr where userid = ?::uuid", [userid]);
      const latestUser = Array.isArray(res?.resultSet) ? res.resultSet[0] : null;
      if (latestUser) {
        localStorage.setItem("selectedUserRawFull", JSON.stringify(latestUser));
      }
    } catch (error) {
      console.error("Error refreshing selected user data:", error);
    } finally {
      setUserData(buildUserFromStorage());
      setProxyUsersRefreshKey((prev) => prev + 1);
      setShowProxyCreatedToast(true);
    }
  };

  // Ensure chart and grid render only on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Re-read after mount to ensure access to localStorage
    setUserData(buildUserFromStorage());
  }, []);

  const ProfileTab = () => {
    const initials = `${(userData.firstName || "")[0] || "U"}${(userData.lastName || "")[0] || ""}`.toUpperCase();
    const colors = ["#7f3ff0", "#0099cc", "#777", "#d7263d", "#ffae00"];
    // Ensure same color on server and initial client render to avoid hydration mismatch
    const bgColor = isMounted
      ? colors[(userData.email || "").length % colors.length]
      : colors[0];
    const displayedInitials = isMounted ? initials : "";

    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileDraft, setProfileDraft] = useState<ProfileUser>(() => ({ ...userData }));
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordFeedback, setPasswordFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
    const [showPasswordResetFields, setShowPasswordResetFields] = useState(false);
    const [showOldPasswordPlain, setShowOldPasswordPlain] = useState(false);
    const [showNewPasswordPlain, setShowNewPasswordPlain] = useState(false);
    const [showConfirmPasswordPlain, setShowConfirmPasswordPlain] = useState(false);

    useEffect(() => {
      if (!isEditingProfile) {
        setProfileDraft({ ...userData });
      }
    }, [userData, isEditingProfile]);

    const enterProfileEdit = () => {
      setProfileDraft({
        ...userData,
        tags: [...(userData.tags || [])],
        dob: userData.dob || "",
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback(null);
      setShowPasswordResetFields(false);
      setShowOldPasswordPlain(false);
      setShowNewPasswordPlain(false);
      setShowConfirmPasswordPlain(false);
      setIsEditingProfile(true);
    };

    const cancelProfileEdit = () => {
      setIsEditingProfile(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback(null);
      setShowPasswordResetFields(false);
      setShowOldPasswordPlain(false);
      setShowNewPasswordPlain(false);
      setShowConfirmPasswordPlain(false);
    };

    const saveProfile = () => {
      const next: ProfileUser = {
        ...profileDraft,
        firstName: profileDraft.firstName?.trim() ?? "",
        lastName: profileDraft.lastName?.trim() ?? "",
        email: profileDraft.email?.trim() || "no-email@example.com",
        displayName: (profileDraft.displayName || "").trim() || "Unknown",
        alias: profileDraft.alias?.trim() ?? "",
        title: profileDraft.title?.trim() ?? "",
        department: profileDraft.department?.trim() ?? "",
        startDate: profileDraft.startDate?.trim() ?? "",
        userType: profileDraft.userType?.trim() ?? "",
        managerEmail: profileDraft.managerEmail?.trim() ?? "",
        status: profileDraft.status || "Active",
        tags: (profileDraft.tags || []).map((t) => String(t).trim()).filter(Boolean),
        dob: profileDraft.dob?.trim() || "",
      };
      if (!next.tags.length) {
        next.tags = ["User"];
      }
      setUserData(next);
      persistProfileUserToStorage(next);
      setIsEditingProfile(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback(null);
      setShowPasswordResetFields(false);
      setShowOldPasswordPlain(false);
      setShowNewPasswordPlain(false);
      setShowConfirmPasswordPlain(false);
    };

    const handleResetPassword = () => {
      setPasswordFeedback(null);
      if (!oldPassword.trim()) {
        setPasswordFeedback({ type: "err", text: "Enter your current password." });
        return;
      }
      if (!newPassword && !confirmPassword) {
        setPasswordFeedback({ type: "err", text: "Enter a new password and confirmation." });
        return;
      }
      if (newPassword.length < 8) {
        setPasswordFeedback({ type: "err", text: "Password must be at least 8 characters." });
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordFeedback({ type: "err", text: "Passwords do not match." });
        return;
      }
      if (oldPassword === newPassword) {
        setPasswordFeedback({ type: "err", text: "New password must be different from the current password." });
        return;
      }
      setPasswordFeedback({ type: "ok", text: "Password reset completed successfully." });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordResetFields(false);
      setShowOldPasswordPlain(false);
      setShowNewPasswordPlain(false);
      setShowConfirmPasswordPlain(false);
    };

    const inputClass =
      "mt-0.5 w-full text-xs border border-gray-300 rounded px-2 py-1 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none";

    return (
      <div className="relative bg-white rounded-lg shadow-md p-3">
        {!isEditingProfile && (
          <div className="no-print absolute top-3 right-3 z-10 flex items-center gap-2">
            <button
              type="button"
              onClick={enterProfileEdit}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
              title="Edit profile"
              aria-label="Edit profile"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
          {/* Profile Picture - Centered */}
          <div className="flex-shrink-0 flex justify-center">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-semibold"
              style={{ backgroundColor: bgColor }}
            >
              {displayedInitials}
            </div>
          </div>

          {/* User Details - Right Side */}
          <div className={`flex-1 w-full min-w-0 space-y-4 ${!isEditingProfile ? "sm:pr-9" : ""}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">First Name</label>
                {isEditingProfile ? (
                  <input
                    className={inputClass}
                    value={profileDraft.firstName}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, firstName: e.target.value }))}
                    aria-label="First name"
                  />
                ) : (
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{userData.firstName}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Name</label>
                {isEditingProfile ? (
                  <input
                    className={inputClass}
                    value={profileDraft.lastName}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, lastName: e.target.value }))}
                    aria-label="Last name"
                  />
                ) : (
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{userData.lastName}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</label>
                <p className="text-xs font-semibold text-blue-600 mt-0.5">{userData.email}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Display Name</label>
                {isEditingProfile ? (
                  <input
                    className={inputClass}
                    value={profileDraft.displayName}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, displayName: e.target.value }))}
                    aria-label="Display name"
                  />
                ) : (
                  <div className="text-xs font-semibold text-gray-900 mt-0.5">
                    <UserDisplayName
                      displayName={userData.displayName}
                      userType={userData.userType}
                      tags={userData.tags}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date Of Birth</label>
                <p
                  className="text-xs font-semibold text-gray-900 mt-0.5 tracking-widest"
                  aria-label="Date of birth hidden"
                >
                  xx-xx-xxxx
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Username</label>
                <p className="text-xs font-semibold text-gray-900 mt-0.5">{userData.alias}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Title</label>
                {isEditingProfile ? (
                  <input
                    className={inputClass}
                    value={profileDraft.title ?? ""}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, title: e.target.value }))}
                    aria-label="Title"
                  />
                ) : (
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{userData.title}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Department</label>
                {isEditingProfile ? (
                  <input
                    className={inputClass}
                    value={profileDraft.department ?? ""}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, department: e.target.value }))}
                    aria-label="Department"
                  />
                ) : (
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{userData.department}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Start Date</label>
                {isEditingProfile ? (
                  <input
                    type="date"
                    className={inputClass}
                    value={profileDraft.startDate || ""}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, startDate: e.target.value }))}
                    aria-label="Start date"
                  />
                ) : (
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{userData.startDate || "N/A"}</p>
                )}
              </div>

              {(!!userData.tags?.length || isEditingProfile) && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tags</label>
                  {isEditingProfile ? (
                    <input
                      className={inputClass}
                      value={(profileDraft.tags || []).join(", ")}
                      onChange={(e) =>
                        setProfileDraft((d) => ({
                          ...d,
                          tags: e.target.value
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        }))
                      }
                      placeholder="e.g. Employee, Contractor"
                      aria-label="Tags, comma-separated"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {userData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-block bg-blue-100 border border-blue-300 text-blue-800 text-xs px-2 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">User Type</label>
                <p className="text-xs font-semibold text-gray-900 mt-0.5">{userData.userType}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Manager Email</label>
                {isEditingProfile ? (
                  <input
                    type="email"
                    className={inputClass}
                    value={profileDraft.managerEmail ?? ""}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, managerEmail: e.target.value }))}
                    aria-label="Manager email"
                  />
                ) : (
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">{userData.managerEmail}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
                {isEditingProfile ? (
                  <select
                    className={inputClass}
                    value={profileDraft.status || "Active"}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, status: e.target.value }))}
                    aria-label="Status"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Disable">Disable</option>
                  </select>
                ) : (
                  <div className="mt-0.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        (userData.status || "Active") === "Active"
                          ? "border border-green-500 text-green-700 bg-green-50"
                          : "border border-gray-300 text-gray-800 bg-gray-50"
                      }`}
                    >
                      {userData.status || "Active"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {isEditingProfile && (
              <div className="border border-gray-200 rounded-md px-2.5 py-2 bg-gray-50/90 no-print">
                {!showPasswordResetFields ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordResetFields(true);
                      setPasswordFeedback(null);
                    }}
                    className="inline-flex items-center px-3 py-1.5 rounded-md text-[11px] font-medium text-white bg-gray-800 hover:bg-gray-900"
                  >
                    Reset password
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                        Reset password
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordResetFields(false);
                          setOldPassword("");
                          setNewPassword("");
                          setConfirmPassword("");
                          setPasswordFeedback(null);
                          setShowOldPasswordPlain(false);
                          setShowNewPasswordPlain(false);
                          setShowConfirmPasswordPlain(false);
                        }}
                        className="text-[11px] font-medium text-gray-500 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-3 sm:gap-y-1.5">
                      <div className="flex flex-1 flex-wrap items-end gap-2 min-w-0 sm:max-w-4xl">
                        <div className="flex-1 min-w-[8rem]">
                          <label className="text-[10px] font-medium text-gray-500">Old password</label>
                          <div className="relative mt-0.5">
                            <input
                              type={showOldPasswordPlain ? "text" : "password"}
                              autoComplete="current-password"
                              className="w-full bg-white text-xs border border-gray-300 rounded pl-2 pr-9 py-1 text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none"
                              value={oldPassword}
                              onChange={(e) => setOldPassword(e.target.value)}
                              aria-label="Old password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowOldPasswordPlain((v) => !v)}
                              className="absolute inset-y-0 right-0 flex items-center justify-center px-1.5 text-gray-500 hover:text-gray-800"
                              aria-label={showOldPasswordPlain ? "Hide old password" : "Show old password"}
                            >
                              {showOldPasswordPlain ? (
                                <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                              ) : (
                                <Eye className="w-4 h-4" strokeWidth={1.75} />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 min-w-[8rem]">
                          <label className="text-[10px] font-medium text-gray-500">New</label>
                          <div className="relative mt-0.5">
                            <input
                              type={showNewPasswordPlain ? "text" : "password"}
                              autoComplete="new-password"
                              className="w-full bg-white text-xs border border-gray-300 rounded pl-2 pr-9 py-1 text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              aria-label="New password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPasswordPlain((v) => !v)}
                              className="absolute inset-y-0 right-0 flex items-center justify-center px-1.5 text-gray-500 hover:text-gray-800"
                              aria-label={showNewPasswordPlain ? "Hide new password" : "Show new password"}
                            >
                              {showNewPasswordPlain ? (
                                <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                              ) : (
                                <Eye className="w-4 h-4" strokeWidth={1.75} />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 min-w-[8rem]">
                          <label className="text-[10px] font-medium text-gray-500">Confirm</label>
                          <div className="relative mt-0.5">
                            <input
                              type={showConfirmPasswordPlain ? "text" : "password"}
                              autoComplete="new-password"
                              className="w-full bg-white text-xs border border-gray-300 rounded pl-2 pr-9 py-1 text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              aria-label="Confirm password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPasswordPlain((v) => !v)}
                              className="absolute inset-y-0 right-0 flex items-center justify-center px-1.5 text-gray-500 hover:text-gray-800"
                              aria-label={showConfirmPasswordPlain ? "Hide confirm password" : "Show confirm password"}
                            >
                              {showConfirmPasswordPlain ? (
                                <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                              ) : (
                                <Eye className="w-4 h-4" strokeWidth={1.75} />
                              )}
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetPassword}
                          className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-medium text-white bg-gray-800 hover:bg-gray-900 sm:mb-0.5"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {passwordFeedback && (
                  <p
                    className={`text-[11px] mt-1.5 ${
                      passwordFeedback.type === "ok" ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {passwordFeedback.text}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        {isEditingProfile && (
          <div className="no-print flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={cancelProfileEdit}
              className="inline-flex items-center px-5 py-2.5 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveProfile}
              className="inline-flex items-center px-5 py-2.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        )}
      </div>
    );
  };

  const AllAccessTab = () => {
    const [rowData, setRowData] = useState<any[]>([]);
    const [dynamicCols, setDynamicCols] = useState<ColDef[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>("");
    const gridRef = useRef<any>(null);

    const handleDeleteRow = (row: any) => {
      setRowData((prev) => prev.filter((r) => r !== row));
    };

    useEffect(() => {
      const getUserIdFromStorage = (): string => {
        try {
          const fullStr = localStorage.getItem("selectedUserRawFull");
          if (fullStr) {
            const u = JSON.parse(fullStr);
            return (
              u.userid || u.id || u.userId || u.customattributes?.id || "0109868e-b00c-4f24-ae5f-258029cce1d6"
            );
          }
        } catch {}
        try {
          const sel = localStorage.getItem("selectedUserRaw");
          if (sel) {
            const s = JSON.parse(sel);
            return s.id || s.userId || "0109868e-b00c-4f24-ae5f-258029cce1d6";
          }
        } catch {}
        return "0109868e-b00c-4f24-ae5f-258029cce1d6";
      };

      // Identify the currently selected user for conditional entitlements
      const currentUser = buildUserFromStorage();

      const maybeAugmentWithTraining = (rows: any[]): any[] => {
        if (
          currentUser.displayName &&
          currentUser.displayName.trim().toLowerCase() === "alexander lane"
        ) {
          const primaryAccount =
            rows.find((r) => r.accountName)?.accountName ?? "";

          return [
            ...rows,
            {
              entitlementName: "SEC-101: Information Security Awareness 2025",
              entitlementType: "Training",
              application: "CornerStone LMS",
              accountName: primaryAccount,
              lastLogin: null,
            },
          ];
        }
        return rows;
      };

      const fetchAllAccess = async () => {
        try {
          const userId = getUserIdFromStorage();
          const res: any = await executeQuery<any>(
            "select * from vw_user_with_applications_entitlements where userid = ?::uuid",
            [userId]
          );
          // Handle concrete response shape: { resultSet: [ { applications: [ { entitlements: [...] } ] } ] }
          if (Array.isArray(res?.resultSet)) {
            const flatEntRows: any[] = [];
            for (const user of res.resultSet) {
              const apps = Array.isArray(user?.applications) ? user.applications : [];
              for (const app of apps) {
                const ents = Array.isArray(app?.entitlements) ? app.entitlements : [];
                for (const ent of ents) {
                  flatEntRows.push({
                    entitlementName: ent?.entitlementname,
                    entitlementType: ent?.entitlementType,
                    application: app?.application,
                    accountName: app?.accountname,
                    lastLogin: app?.lastlogin,
                  });
                }
              }
            }

            const finalRows = maybeAugmentWithTraining(flatEntRows);

            setRowData(finalRows);

            const desiredCols: ColDef[] = [
              { headerName: "Entitlement ", field: "entitlementName", flex: 1.5 },
              { headerName: "Type", field: "entitlementType", flex: 1 },
              { headerName: "Application", field: "application", flex: 1.2 },
              { headerName: "Account", field: "accountName", flex: 1.2 },
              {
                headerName: "Last Login",
                field: "lastLogin",
                flex: 1,
                valueFormatter: (p: any) => require("@/utils/utils").formatDateMMDDYYSlashes(p.value),
              },
              {
                headerName: "",
                colId: "actions",
                flex: 0.5,
                sortable: false,
                filter: false,
                cellRenderer: (p: any) => (
                  <div className="flex items-center justify-center h-full">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRow(p.data);
                      }}
                      className="p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-900 border border-red-200 hover:border-red-300 transition-colors"
                      title="Remove entitlement"
                      aria-label="Remove entitlement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ),
              },
            ];
            setDynamicCols(desiredCols);
            return;
          }
          // Normalize possible response shapes
          const items = ((): any[] => {
            if (Array.isArray(res?.items)) return res.items;
            if (Array.isArray(res?.data?.items)) return res.data.items;
            if (Array.isArray(res?.rows)) return res.rows;
            if (Array.isArray(res?.data?.rows)) return res.data.rows;
            if (Array.isArray(res?.results)) return res.results;
            if (Array.isArray(res?.data?.results)) return res.data.results;
            if (Array.isArray(res?.data)) return res.data;
            if (Array.isArray(res)) return res;
            if (res && typeof res === "object") {
              // As a last resort, try to find an array property
              const firstArray = Object.values(res).find((v: any) => Array.isArray(v));
              if (Array.isArray(firstArray)) return firstArray as any[];
            }
            return [];
          })();
          const finalRows = maybeAugmentWithTraining(items);
          setRowData(finalRows);
          // Helper to resolve a value from multiple possible key aliases on each row
          const valueByAliases = (data: any, aliases: string[]) => {
            for (const a of aliases) {
              if (data[a] !== undefined) return data[a];
              const lower = a.toLowerCase();
              const hit = Object.keys(data).find((k) => k.toLowerCase() === lower);
              if (hit) return data[hit];
            }
            return undefined;
          };

          const desiredCols: ColDef[] = [
            {
              headerName: "Entitlement Name",
              colId: "entitlementName",
              valueGetter: (p: any) =>
                valueByAliases(p.data, ["entitlementname", "entitlement_name", "ent_name", "entname"]),
              flex: 1.5,
            },
            {
              headerName: "entitlementType",
              colId: "entitlementType",
              valueGetter: (p: any) =>
                valueByAliases(p.data, [
                  "entitlementtype",
                  "entitlement_type",
                  "ent_type",
                  "enttype",
                  "entitlementcategory",
                ]),
              flex: 1,
            },
            {
              headerName: "Application",
              colId: "application",
              valueGetter: (p: any) =>
                valueByAliases(p.data, [
                  "application",
                  "applicationname",
                  "application_name",
                  "appname",
                  "app_name",
                  "applicationdisplayname",
                ]),
              flex: 1.2,
            },
            {
              headerName: "Account name",
              colId: "accountName",
              valueGetter: (p: any) =>
                valueByAliases(p.data, [
                  "account",
                  "accountname",
                  "account_name",
                  "username",
                  "useraccount",
                  "user_name",
                ]),
              flex: 1.2,
            },
            {
              headerName: "Last Login",
              colId: "lastLogin",
              valueGetter: (p: any) =>
                valueByAliases(p.data, [
                  "lastlogin",
                  "last_login",
                  "lastlogindate",
                  "last_login_date",
                ]),
              flex: 1,
            },
            {
              headerName: "",
              colId: "actions",
              flex: 0.5,
              sortable: false,
              filter: false,
              cellRenderer: (p: any) => (
                <div className="flex items-center justify-center h-full">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRow(p.data);
                    }}
                    className="p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-900 border border-red-200 hover:border-red-300 transition-colors"
                    title="Remove entitlement"
                    aria-label="Remove entitlement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ),
            },
          ];
          // If none of the desired columns resolve for the first row, fall back to showing all keys
          const desiredResolved = desiredCols.some((c) => {
            try {
              const val = (c as any).valueGetter?.({ data: items[0] });
              return val !== undefined && val !== null;
            } catch {
              return false;
            }
          });
          if (desiredResolved) {
            setDynamicCols(desiredCols);
          } else {
            const keys = Object.keys(items[0] || {});
            const fallback = keys.map((k) => ({ headerName: k, field: k, flex: 1 } as ColDef));
            setDynamicCols(fallback);
          }
        } catch (e) {
          setRowData([]);
          setDynamicCols([]);
        }
      };

      fetchAllAccess();
    }, []);

    // Filter data based on search term
    const filteredData = useMemo(() => {
      if (!searchTerm.trim()) {
        return rowData;
      }
      const searchLower = searchTerm.toLowerCase();
      return rowData.filter((row) => {
        // Helper to get cell value for search
        const getValue = (col: ColDef, data: any): string => {
          if (col.field) return String(data[col.field] || '').toLowerCase();
          if ((col as any).valueGetter) {
            try {
              return String((col as any).valueGetter({ data }) || '').toLowerCase();
            } catch {
              return '';
            }
          }
          if ((col as any).colId) {
            const colId = (col as any).colId;
            if (colId === 'entitlementName') {
              return String(data.entitlementName || data.entitlementname || data.entitlement_name || '').toLowerCase();
            }
            if (colId === 'entitlementType') {
              return String(data.entitlementType || data.entitlementtype || data.entitlement_type || '').toLowerCase();
            }
            if (colId === 'application') {
              return String(data.application || data.applicationname || data.application_name || '').toLowerCase();
            }
            if (colId === 'accountName') {
              return String(data.accountName || data.accountname || data.account_name || '').toLowerCase();
            }
            if (colId === 'lastLogin') {
              const date = data.lastLogin || data.lastlogin || data.last_login || '';
              return date ? require("@/utils/utils").formatDateMMDDYYSlashes(date).toLowerCase() : '';
            }
            return String(data[colId] || '').toLowerCase();
          }
          return '';
        };

        // Search across all columns
        return dynamicCols.some((col) => {
          const value = getValue(col, row);
          return value.includes(searchLower);
        });
      });
    }, [rowData, searchTerm, dynamicCols]);

      return (
        <div className="bg-white rounded-lg shadow-md p-3">
          {/* Search Box */}
          <div className="mb-4">
            <div className="relative max-w-md">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="text-gray-400 w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Search by entitlement, application, account..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            {searchTerm && (
              <p className="text-sm text-gray-600 mt-1">
                Showing {filteredData.length} result(s) for "{searchTerm}"
              </p>
            )}
          </div>

          {/* Simple AG Grid table */}
          <div className="ag-theme-alpine" style={{ width: "100%", minHeight: 400 }}>
            {isMounted && (
              <AgGridReact
                ref={gridRef}
                rowData={filteredData}
                columnDefs={dynamicCols}
                defaultColDef={{ sortable: true, filter: true, resizable: true }}
                suppressRowVirtualisation={false}
                domLayout="autoHeight"
                theme={themeQuartz}
              />
            )}
          </div>
        </div>
      );
  };

  const UnderReviewTab = () => {
    const formatTime12h = (d: Date) =>
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

    const parseTimeToDate = (timeHHmm: string, base: Date) => {
      const [h, m] = timeHHmm.split(":").map(Number);
      const out = new Date(base);
      out.setHours(h, m, 0, 0);
      return out;
    };

    const hoursBetweenTimes = (startHHmm: string, endHHmm: string): number => {
      const [sh, sm] = startHHmm.split(":").map(Number);
      const [eh, em] = endHHmm.split(":").map(Number);
      let mins = eh * 60 + em - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60;
      return Math.round((mins / 60) * 10) / 10;
    };

    const transientItems = [
      {
        title: "ORA_HRC_HUMAN_CAPITAL_MANAGEMENT_INTEGRATION_SPECIALIST_JOB",
        description:
          "This role provides elevated administrative access focused on integration, data loading, and system configuration tasks that support overall HCM administration",
        application: "Oracle_Fusion_HCM",
        entitlement: "HCM Admin Account",
      },
      {
        title: "SAP_ALL",
        description:
          "This role provides super user profile that grants unrestricted access across the entire SAP system, including all administrative, configuration, and HR/HCM functions.",
        application: "SAP_S4",
        entitlement: "Finance Analyst",
      },
    ];

    const [selectedIdx, setSelectedIdx] = useState(0);
    const selectedItem = transientItems[selectedIdx] || transientItems[0];

    // Side panel state for Start Access
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [accessMode, setAccessMode] = useState<"now" | "schedule">("now");
    const [hours, setHours] = useState<string>("");
    const [scheduleDate, setScheduleDate] = useState<string>("");
    const [startTime, setStartTime] = useState<string>("");
    const [endTime, setEndTime] = useState<string>("");
    const [justification, setJustification] = useState<string>("");

    const [historyRows, setHistoryRows] = useState<JitAccessHistoryRow[]>(JIT_HISTORY_SEED);
    const skipJitHistoryPersist = useRef(true);

    useEffect(() => {
      const uid = getUserIdFromStorage();
      const loaded = loadJitAccessHistory(uid);
      setHistoryRows(loaded ?? JIT_HISTORY_SEED);
      skipJitHistoryPersist.current = true;
    }, [userData.email]);

    useEffect(() => {
      if (skipJitHistoryPersist.current) {
        skipJitHistoryPersist.current = false;
        return;
      }
      saveJitAccessHistory(getUserIdFromStorage(), historyRows);
    }, [historyRows]);

    const resetForm = () => {
      setAccessMode("now");
      setHours("");
      setScheduleDate("");
      setStartTime("");
      setEndTime("");
      setJustification("");
    };

    const openDrawer = () => {
      resetForm();
      setIsDrawerOpen(true);
    };

    const closeDrawer = () => {
      setIsDrawerOpen(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      const today = new Date();
      const todayFormatted = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;

      let row: JitAccessHistoryRow;

      if (accessMode === "now") {
        const h = parseFloat(hours);
        if (Number.isNaN(h) || h <= 0) return;
        const start = new Date();
        const end = new Date(start.getTime() + h * 60 * 60 * 1000);
        row = {
          id: `jit-${Date.now()}`,
          date: todayFormatted,
          requestedDuration: h,
          startTime: formatTime12h(start),
          endTime: formatTime12h(end),
          status: "In progress",
        };
      } else {
        const durationH = hoursBetweenTimes(startTime, endTime);
        const dateLabel = scheduleDate
          ? formatDateMMDDYYSlashes(scheduleDate)
          : todayFormatted;
        const base = scheduleDate ? new Date(`${scheduleDate}T12:00:00`) : today;
        const startD = parseTimeToDate(startTime, base);
        const endD = parseTimeToDate(endTime, base);
        row = {
          id: `jit-${Date.now()}`,
          date: dateLabel,
          requestedDuration: durationH,
          startTime: formatTime12h(startD),
          endTime: formatTime12h(endD),
          status: "In progress",
        };
      }

      setHistoryRows((prev) => [row, ...prev]);
      console.log("Start Access submit", {
        item: selectedItem,
        accessMode,
        hours,
        scheduleDate,
        startTime,
        endTime,
        justification,
        row,
      });
      setIsDrawerOpen(false);
      resetForm();
    };

    return (
      <div className="p-6 bg-gray-50">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ gridTemplateColumns: isDrawerOpen ? "280px 1fr 0" : undefined }}>
          {/* Left: Transient Access list */}
          <div className="lg:col-span-1">
            <div className="triggers-panel" style={{ width: "100%", height: "100%" }}>
              <div className="triggers-header">
                <h3>JIT Access</h3>
                <button
                  className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                  onClick={() => { /* TODO: open create transient access modal */ }}
                >
                  New
                </button>
              </div>
              <div className="trigger-list">
                {transientItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`trigger-item ${selectedIdx === idx ? "selected" : ""}`}
                    onClick={() => setSelectedIdx(idx)}
                  >
                    <div className="trigger-name">{item.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Access History */}
          <div className="lg:col-span-2" style={{ marginRight: isDrawerOpen ? 420 : 0, transition: "margin-right 200ms ease" }}>
            {/* Top card styled like scheduler trigger card */}
            <div className="jobs-section" style={{ padding: 0, marginBottom: 20, height: "auto", gap: 0, display: "block" }}>
              <div className="trigger-card-section" style={{ height: "auto", marginBottom: 4 }}>
                <div className="trigger-card" style={{ marginBottom: 0 }}>
                  <div className="trigger-card-header" style={{ paddingTop: 6, paddingBottom: 6 }}>
                    <h4>{selectedItem?.title || "ORA_HRC_HUMAN_CAPITAL_MANAGEMENT_INTEGRATION_SPECIALIST_JOB"}</h4>
                  </div>
                  <div className="trigger-card-content" style={{ padding: 8 }}>
                    <div className="trigger-info-rows" style={{ gap: 8 }}>
                      <div className="trigger-info-row">
                        <div
                          className="info-item bg-gray-100 rounded"
                          style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "row", alignItems: "center", gap: 8, padding: "8px 12px" }}
                        >
                          <span className="info-label" style={{ marginRight: 4 }}>Description:</span>
                          <span className="info-value whitespace-normal break-words">{selectedItem?.description || "N/A"}</span>
                        </div>
                      </div>
                      <div className="trigger-info-row" style={{ gridTemplateColumns: "1fr 1fr auto", columnGap: 16 }}>
                        <div className="info-item">
                          <span className="info-label">Application</span>
                          <span className="info-value">{selectedItem?.application || "N/A"}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label"></span>
                          <span className="info-value"></span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Action</span>
                          <button
                            className="px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                            onClick={openDrawer}
                          >
                            Request Access
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="trigger-card-section" style={{ height: "auto" }}>
              <div className="trigger-card">
                <div className="trigger-card-header" style={{ paddingTop: 8, paddingBottom: 8 }}>
                  <h4>Access History</h4>
                </div>
                <div className="trigger-card-content" style={{ padding: 0 }}>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100 border-b">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Requested Duration</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Start Time</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">End Time</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((h) => (
                        <tr key={h.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700">{h.date}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{h.requestedDuration} hours</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{h.startTime}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{h.endTime || "-"}</td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs ${
                                h.status === "Completed"
                                  ? "bg-gray-100 text-gray-700"
                                  : h.status === "Active"
                                  ? "bg-green-100 text-green-700"
                                  : h.status === "In progress"
                                  ? "bg-blue-100 text-blue-800"
                                  : h.status === "Submitted"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {h.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              {h.status !== "In progress" && (
                                <button
                                  className="text-blue-600 hover:text-blue-800 flex items-center justify-center"
                                  onClick={() => console.log('Activity', h)}
                                  title="Activity"
                                >
                                  <History size={24} />
                                </button>
                              )}
                              {h.status === "In progress" && (
                                <>
                                  <button
                                    type="button"
                                    className="px-2.5 py-1 text-xs font-medium rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                                    onClick={() =>
                                      setHistoryRows((prev) =>
                                        prev.map((r) =>
                                          r.id === h.id ? { ...r, status: "Completed" } : r
                                        )
                                      )
                                    }
                                  >
                                    Stop
                                  </button>
                                  <button
                                    type="button"
                                    className="px-2.5 py-1 text-xs font-medium rounded border border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
                                    onClick={() => console.log("Extend", h)}
                                  >
                                    Extend
                                  </button>
                                </>
                              )}
                              {h.status === "Active" && (
                                <>
                                  <button
                                    className="text-red-600 hover:text-red-800 flex items-center justify-center ml-2"
                                    onClick={() => console.log('End Session')}
                                    title="End Session"
                                  >
                                    <CircleX size={24} />
                                  </button>
                                  <button
                                    className="text-green-600 hover:text-green-800 flex items-center justify-center ml-2"
                                    onClick={() => console.log('Extend')}
                                    title="Extend"
                                  >
                                    <CirclePlus size={24} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            {/* Right Drawer for Start Access */}
            {isDrawerOpen && (
              <>
                {/* Drawer */}
                <div className="fixed right-0 w-96 md:w-[420px] bg-white shadow-2xl z-50 flex flex-col" style={{ top: 80, height: "calc(100% - 80px)" }}>
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <div className="text-base font-semibold">Start Transient Access</div>
                    <button
                      className="text-gray-500 hover:text-gray-700 text-xl leading-none"
                      onClick={closeDrawer}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1">
                    {/* Toggle NOW / Schedule */}
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-gray-500 mb-1">Access Duration</div>
                      <div className="inline-flex bg-gray-100 rounded-md p-1">
                        <button
                          type="button"
                          onClick={() => setAccessMode("now")}
                          className={`px-3 py-1 text-sm rounded ${
                            accessMode === "now" ? "bg-blue-600 text-white" : "text-gray-600"
                          }`}
                        >
                          Now
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccessMode("schedule")}
                          className={`px-3 py-1 text-sm rounded ${
                            accessMode === "schedule" ? "bg-blue-600 text-white" : "text-gray-600"
                          }`}
                        >
                          Schedule for Later
                        </button>
                      </div>
                    </div>

                    {accessMode === "now" ? (
                      <div className="mb-4">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Duration (hours)
                        </label>
                        <input
                          type="number"
                          min="1"
                          className="w-full border rounded px-3 py-2 text-sm"
                          placeholder="e.g., 4"
                          value={hours}
                          onChange={(e) => setHours(e.target.value)}
                          required
                        />
                      </div>
                    ) : (
                      <div className="mb-4 space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Date</label>
                          <input
                            type="date"
                            className="w-full border rounded px-3 py-2 text-sm"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Start Time</label>
                            <input
                              type="time"
                              className="w-full border rounded px-3 py-2 text-sm"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">End Time</label>
                            <input
                              type="time"
                              className="w-full border rounded px-3 py-2 text-sm"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Justification</label>
                      <textarea
                        className="w-full border rounded px-3 py-2 text-sm"
                        rows={4}
                        placeholder="Why is this access needed?"
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        required
                      />
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        className="px-4 py-2 rounded border text-sm"
                        onClick={closeDrawer}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm"
                      >
                        Submit
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const ProxyUsersTab = ({ refreshTrigger }: { refreshTrigger: number }) => {
    const [proxyUsers, setProxyUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState<string>("");

    useEffect(() => {
      const loadProxyUsersFromSelectedUser = () => {
        try {
          setLoading(true);

          const fullStr = typeof window !== "undefined"
            ? window.localStorage.getItem("selectedUserRawFull")
            : null;

          if (!fullStr) {
            setProxyUsers([]);
            return;
          }

          const rawUser = JSON.parse(fullStr);
          const proxyArr = Array.isArray(rawUser?.proxy_user) ? rawUser.proxy_user : [];

          const today = new Date();
          const normalized = proxyArr.map((p: any) => {
            const start = p.startDate || p.startdate || "";
            const end = p.endDate || p.enddate || "";

            let status = "Active";
            if (end) {
              const endDateObj = new Date(end);
              if (!isNaN(endDateObj.getTime()) && endDateObj < today) {
                status = "Expired";
              }
            }

            return {
              identity: p.identity || "",
              startDate: start,
              endDate: end,
              status,
              capabilities: p.capabilities || "",
              comments: p.justification || "",
            };
          });

          setProxyUsers(normalized);
        } catch (error) {
          console.error("Error loading proxy users from selected user:", error);
          setProxyUsers([]);
        } finally {
          setLoading(false);
        }
      };

      loadProxyUsersFromSelectedUser();
    }, [refreshTrigger]);

    // Filter data based on search term
    const filteredData = useMemo(() => {
      if (!searchTerm.trim()) {
        return proxyUsers;
      }
      const searchLower = searchTerm.toLowerCase();
      return proxyUsers.filter((user) => {
        return (
          user.identity?.toLowerCase().includes(searchLower) ||
          user.capabilities?.toLowerCase().includes(searchLower)
        );
      });
    }, [proxyUsers, searchTerm]);

    const handleDisable = (rowData: any) => {
      console.log("Disable proxy user:", rowData);
      // TODO: Implement disable functionality
    };

    const handleExtendEndDate = (rowData: any) => {
      console.log("Extend end date for:", rowData);
      // TODO: Implement extend end date functionality
    };

    const handleEditStartDate = (rowData: any) => {
      console.log("Edit start date for:", rowData);
      // TODO: Implement edit start date functionality
    };

    const columnDefs: ColDef[] = [
      { 
        headerName: "Identity", 
        field: "identity", 
        flex: 2,
        cellRenderer: (params: any) => (
          <span className="text-blue-600 font-medium">{params.value || "-"}</span>
        ),
      },
      {
        headerName: "Start Date",
        field: "startDate",
        flex: 1.5,
        valueFormatter: (p: any) => p.value ? require("@/utils/utils").formatDateMMDDYYSlashes(p.value) : "-",
      },
      {
        headerName: "End Date",
        field: "endDate",
        flex: 1.5,
        valueFormatter: (p: any) => p.value ? require("@/utils/utils").formatDateMMDDYYSlashes(p.value) : "-",
      },
      { 
        headerName: "Capabilities", 
        field: "capabilities", 
        flex: 2,
        cellRenderer: (params: any) => (
          <span className="text-gray-700">{params.value || "-"}</span>
        ),
      },
      {
        headerName: "Actions",
        field: "actions",
        flex: 2,
        cellRenderer: (params: any) => {
          const rowData = params.data;
          return (
            <div className="flex items-center gap-2 h-full">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDisable(rowData);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 transition-colors"
                title="Disable"
              >
                <Ban className="w-3 h-3" />
                Disable
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleExtendEndDate(rowData);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
                title="Extend End Date"
              >
                <Calendar className="w-3 h-3" />
                Extend
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditStartDate(rowData);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded border border-gray-200 transition-colors"
                title="Edit Start Date"
              >
                <Edit className="w-3 h-3" />
                Edit
              </button>
            </div>
          );
        },
      },
    ];

    if (loading) {
      return (
        <div className="flex justify-center items-center" style={{ height: 400 }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading proxy users...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-md p-3">
        {/* Search Box */}
        <div className="mb-4">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="text-gray-400 w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="Search proxy users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          {searchTerm && (
            <p className="text-sm text-gray-600 mt-1">
              Showing {filteredData.length} result(s) for "{searchTerm}"
            </p>
          )}
        </div>

        {/* AG Grid */}
        <div className="screen-only">
          {isMounted && (
            <div className="ag-theme-alpine" style={{ height: 400, width: "100%" }}>
              <AgGridReact
                rowData={filteredData}
                columnDefs={columnDefs}
                defaultColDef={{ sortable: true, filter: true, resizable: true }}
                suppressRowVirtualisation={false}
                theme={themeQuartz}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const CombinedView = ({ printRef }: { printRef: React.RefObject<HTMLDivElement> }) => {
    const [accessTabIndex, setAccessTabIndex] = useState(0);

    const accessSegments = [
      {
        label: "All",
        component: AllAccessTab,
      },
      {
        label: "JIT Access",
        component: UnderReviewTab,
      },
      {
        label: "Proxy Users",
        component: () => <ProxyUsersTab refreshTrigger={proxyUsersRefreshKey} />,
      },
    ];

    return (
      <div className="space-y-6" ref={printRef}>
        {/* Profile Card */}
        <ProfileTab />
        
        {/* Access Tabs */}
        <div>
          <SegmentedControl
            segments={accessSegments}
            activeIndex={accessTabIndex}
            onChange={setAccessTabIndex}
          />
        </div>

      </div>
    );
  };

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `User_Profile_${userData.displayName || userData.email}_${new Date().toISOString().split('T')[0]}`,
    onBeforeGetContent: () => {
      // Expand AG Grid containers to show all rows
      const gridContainers = printRef.current?.querySelectorAll('.ag-theme-alpine');
      gridContainers?.forEach((container: any) => {
        if (container.style) {
          container.style.height = 'auto';
          container.style.maxHeight = 'none';
        }
        const viewport = container.querySelector('.ag-body-viewport');
        if (viewport && viewport.style) {
          viewport.style.height = 'auto';
          viewport.style.maxHeight = 'none';
          viewport.style.overflow = 'visible';
        }
      });
      return Promise.resolve();
    },
    pageStyle: `
      @page {
        size: A4;
        margin: 15mm;
      }
      @media print {
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .no-print {
          display: none !important;
        }
        .screen-only {
          display: none !important;
        }
        .print-table-only {
          display: block !important;
        }
        .print-ag-grid-container {
          page-break-inside: avoid;
        }
        .print-ag-grid,
        .ag-theme-alpine {
          overflow: visible !important;
          height: auto !important;
          max-height: none !important;
          min-height: auto !important;
        }
        .ag-root-wrapper {
          overflow: visible !important;
          height: auto !important;
          display: block !important;
        }
        .ag-body-viewport {
          overflow: visible !important;
          height: auto !important;
          max-height: none !important;
          position: relative !important;
        }
        .ag-center-cols-container {
          height: auto !important;
          min-height: auto !important;
          position: relative !important;
        }
        .ag-center-cols-viewport {
          overflow: visible !important;
          height: auto !important;
          position: relative !important;
        }
        .ag-body-horizontal-scroll,
        .ag-body-vertical-scroll,
        .ag-horizontal-scroll {
          display: none !important;
        }
        .ag-header {
          position: relative !important;
        }
        .ag-row {
          break-inside: avoid;
        }
        div > div.flex.items-center.justify-end.mb-4 {
          display: none !important;
        }
        .space-y-6 > * {
          page-break-inside: avoid;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        table th,
        table td {
          border: 1px solid #d1d5db;
          padding: 8px 12px;
          text-align: left;
        }
        table th {
          background-color: #f3f4f6;
          font-weight: 600;
        }
      }
    `,
  });

  return (
    <>
      <div className="relative mb-4 p-0 m-0">
        <div className="absolute top-0 right-0 z-10 print:hidden p-0 m-0">
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center p-0 m-0 border-0 bg-transparent text-gray-600 shadow-none hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
            title="Print page"
            aria-label="Print page"
          >
            <Printer size={20} />
          </button>
        </div>
        <div className="flex items-center gap-3 no-print">
          <button
            onClick={() => {
              openSidebar(
                <AddProxyUserSidebar onClose={closeSidebar} onProxyUserCreated={refreshSelectedUserData} />,
                { widthPx: 480, title: "Add Proxy User", closeOnOutsideClick: false }
              );
            }}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 text-sm rounded-md font-medium transition-colors"
            title="Add Proxy User"
          >
            <Plus className="w-4 h-4" />
            Add Proxy User
          </button>
        </div>
      </div>
      <CombinedView printRef={printRef} />
      <ActionCompletedToast
        isVisible={showProxyCreatedToast}
        message="Proxy user created"
        onClose={() => setShowProxyCreatedToast(false)}
      />
    </>
  );
}