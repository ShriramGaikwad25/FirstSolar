"use client";
import { themeQuartz } from "ag-grid-community";
import {
  Search,
  Calendar,
  MapPin,
  Trash2,
  Printer,
  Eye,
  EyeOff,
  User,
  Mail,
  Building2,
  Settings,
  Tags as TagsIcon,
  IdCard,
  Tag,
  Lock,
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
  location?: string;
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
        location: u.location || u.customattributes?.location || "",
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
        location: s.location || "",
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
    location: "",
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


export default function UserDetailPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [userData, setUserData] = useState<ProfileUser>(() => buildUserFromStorage());
  const { openSidebar, closeSidebar } = useRightSidebar();

  // Ensure chart and grid render only on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Re-read after mount to ensure access to localStorage
    setUserData(buildUserFromStorage());
  }, []);

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

  const ProfileTab = () => {
    const initials = `${(userData.firstName || "")[0] || "U"}${(userData.lastName || "")[0] || ""}`.toUpperCase();
    const colors = ["#7f3ff0", "#0099cc", "#777", "#d7263d", "#ffae00"];
    // Ensure same color on server and initial client render to avoid hydration mismatch
    const bgColor = isMounted
      ? colors[(userData.email || "").length % colors.length]
      : colors[0];
    const displayedInitials = isMounted ? initials : "";

    const inputClass =
      "mt-1 text-sm font-medium border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none";
    const inputClassNarrow = `${inputClass} w-full max-w-[200px]`;
    const inputClassSplit = `${inputClass} flex-1 min-w-0`;

    const headerFirstName = isEditingProfile ? profileDraft.firstName : userData.firstName;
    const headerLastName = isEditingProfile ? profileDraft.lastName : userData.lastName;
    const headerStatus = isEditingProfile ? profileDraft.status || "Active" : userData.status || "Active";

    const IconBox = ({
      icon: Icon,
      bg,
      color,
    }: {
      icon: typeof User;
      bg: string;
      color: string;
    }) => (
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${bg} ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
    );

    const Field = ({
      icon,
      bg,
      color,
      label,
      children,
    }: {
      icon: typeof User;
      bg: string;
      color: string;
      label: string;
      children: React.ReactNode;
    }) => (
      <div className="flex items-start gap-2.5 min-w-0">
        <IconBox icon={icon} bg={bg} color={color} />
        <div className="min-w-0 flex-1">
          <label className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
          {children}
        </div>
      </div>
    );

    return (
      <div className="relative bg-white rounded-2xl border border-[#EEF0F2] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_14px_rgba(16,24,40,0.035)] overflow-hidden">
        <div className="flex items-stretch">
          {/* Identity panel */}
          <div className="relative w-72 flex-shrink-0 bg-[#F9FAFC] border-r border-[#EEF0F2] px-7 py-10 flex flex-col items-center text-center gap-3 overflow-hidden">
            <div
              className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 rounded-full bg-gradient-to-br from-blue-100/70 to-transparent blur-2xl"
              aria-hidden="true"
            />

            <div
              className="relative w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold shadow-[0_0_0_4px_#ffffff,0_10px_22px_rgba(79,70,229,0.28)] flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${bgColor}, #4338CA)` }}
            >
              {displayedInitials}
            </div>

            <div className="relative flex flex-col items-center gap-1.5">
              <h2 className="text-lg font-bold text-gray-900">
                {headerFirstName} {headerLastName}
              </h2>
              {!!userData.title && <p className="text-xs text-gray-500">{userData.title}</p>}
              {isEditingProfile ? (
                <select
                  className="mt-1 text-xs font-semibold bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  value={profileDraft.status || "Active"}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, status: e.target.value }))}
                  aria-label="Status"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Disable">Disable</option>
                </select>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                    headerStatus === "Active"
                      ? "border border-green-500 text-green-700 bg-green-50"
                      : "border border-gray-300 text-gray-800 bg-gray-50"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      headerStatus === "Active" ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  {headerStatus}
                </span>
              )}
            </div>
          </div>

          {/* User Details */}
          <div className="flex-1 min-w-0 p-8">
            <div className="grid grid-cols-4 gap-x-8 gap-y-6 pb-6 mb-6 border-b border-gray-100">
              <Field icon={User} bg="bg-blue-50" color="text-blue-500" label="First Name">
                {isEditingProfile ? (
                  <input
                    className={inputClassNarrow}
                    value={profileDraft.firstName}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, firstName: e.target.value }))}
                    aria-label="First name"
                  />
                ) : (
                  <p className="text-sm font-semibold text-gray-900 mt-1">{userData.firstName}</p>
                )}
              </Field>

              <Field icon={User} bg="bg-indigo-50" color="text-indigo-500" label="Last Name">
                {isEditingProfile ? (
                  <input
                    className={inputClassNarrow}
                    value={profileDraft.lastName}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, lastName: e.target.value }))}
                    aria-label="Last name"
                  />
                ) : (
                  <p className="text-sm font-semibold text-gray-900 mt-1">{userData.lastName}</p>
                )}
              </Field>

              <Field icon={IdCard} bg="bg-green-50" color="text-green-600" label="Display Name">
                {isEditingProfile ? (
                  <input
                    className={inputClassNarrow}
                    value={profileDraft.displayName}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, displayName: e.target.value }))}
                    aria-label="Display name"
                  />
                ) : (
                  <div className="text-sm font-semibold text-gray-900 mt-1">
                    <UserDisplayName
                      displayName={userData.displayName}
                      userType={userData.userType}
                      tags={userData.tags}
                    />
                  </div>
                )}
              </Field>

              <Field icon={Mail} bg="bg-blue-50" color="text-blue-500" label="Email">
                <p className="text-sm font-semibold text-blue-600 mt-1">{userData.email}</p>
              </Field>
            </div>

            <div className="grid grid-cols-4 gap-x-8 gap-y-6 pb-6 mb-6 border-b border-gray-100">
              <Field icon={User} bg="bg-purple-50" color="text-purple-500" label="Username">
                <p className="text-sm font-semibold text-gray-900 mt-1">{userData.alias}</p>
              </Field>

              <Field icon={Tag} bg="bg-teal-50" color="text-teal-600" label="Title">
                {isEditingProfile ? (
                  <input
                    className={inputClassNarrow}
                    value={profileDraft.title ?? ""}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, title: e.target.value }))}
                    aria-label="Title"
                  />
                ) : (
                  <p className="text-sm font-semibold text-gray-900 mt-1">{userData.title}</p>
                )}
              </Field>

              <Field icon={Building2} bg="bg-green-50" color="text-green-600" label="Department">
                {isEditingProfile ? (
                  <input
                    className={inputClassNarrow}
                    value={profileDraft.department ?? ""}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, department: e.target.value }))}
                    aria-label="Department"
                  />
                ) : (
                  <p className="text-sm font-semibold text-gray-900 mt-1">{userData.department}</p>
                )}
              </Field>

              <Field icon={User} bg="bg-purple-50" color="text-purple-500" label="Manager Name">
                {isEditingProfile ? (
                  <input
                    className={inputClassNarrow}
                    value={profileDraft.managerEmail ?? ""}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, managerEmail: e.target.value }))}
                    aria-label="Manager name"
                  />
                ) : (
                  <p className="text-sm font-semibold text-gray-900 mt-1">{userData.managerEmail}</p>
                )}
              </Field>
            </div>

            <div className="grid grid-cols-4 gap-x-8 gap-y-6">
              <Field icon={Settings} bg="bg-amber-50" color="text-amber-500" label="User Type">
                <p className="text-sm font-semibold text-gray-900 mt-1">{userData.userType}</p>
              </Field>

              <Field icon={Calendar} bg="bg-blue-50" color="text-blue-500" label="Start Date">
                {isEditingProfile ? (
                  <input
                    type="date"
                    className={inputClassNarrow}
                    value={profileDraft.startDate || ""}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, startDate: e.target.value }))}
                    aria-label="Start date"
                  />
                ) : (
                  <p className="text-sm font-semibold text-gray-900 mt-1">{userData.startDate || "N/A"}</p>
                )}
              </Field>

              {(!!userData.tags?.length || isEditingProfile) && (
                <Field icon={TagsIcon} bg="bg-teal-50" color="text-teal-600" label="Tags">
                  {isEditingProfile ? (
                    <input
                      className={inputClassNarrow}
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
                          className="inline-block bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Field>
              )}

              <Field icon={MapPin} bg="bg-rose-50" color="text-rose-500" label="Location">
                <p className="text-sm font-semibold text-gray-900 mt-1">{userData.location || "N/A"}</p>
              </Field>
            </div>

            {isEditingProfile && (
              <div className="mt-2 pt-6 border-t border-gray-100 no-print">
                {!showPasswordResetFields ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordResetFields(true);
                      setPasswordFeedback(null);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Reset password
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className="flex items-center gap-2 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wider">
                        <Lock className="h-3.5 w-3.5" />
                        Reset Password
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
                        className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-x-8 gap-y-4 items-end">
                      <div>
                        <label className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wider">
                          Old Password
                        </label>
                        <div className="relative mt-1">
                          <input
                            type={showOldPasswordPlain ? "text" : "password"}
                            autoComplete="current-password"
                            className={`${inputClassNarrow} pr-9`}
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            aria-label="Old password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOldPasswordPlain((v) => !v)}
                            className="absolute inset-y-0 right-0 flex items-center justify-center px-2.5 text-gray-400 hover:text-gray-700"
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

                      <div>
                        <label className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wider">
                          New Password
                        </label>
                        <div className="relative mt-1">
                          <input
                            type={showNewPasswordPlain ? "text" : "password"}
                            autoComplete="new-password"
                            className={`${inputClassNarrow} pr-9`}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            aria-label="New password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPasswordPlain((v) => !v)}
                            className="absolute inset-y-0 right-0 flex items-center justify-center px-2.5 text-gray-400 hover:text-gray-700"
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

                      <div>
                        <label className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wider">
                          Confirm Password
                        </label>
                        <div className="relative mt-1">
                          <input
                            type={showConfirmPasswordPlain ? "text" : "password"}
                            autoComplete="new-password"
                            className={`${inputClassNarrow} pr-9`}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            aria-label="Confirm password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPasswordPlain((v) => !v)}
                            className="absolute inset-y-0 right-0 flex items-center justify-center px-2.5 text-gray-400 hover:text-gray-700"
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
                        className="h-[34px] inline-flex items-center justify-center rounded-lg text-xs font-semibold text-white bg-gray-900 hover:bg-black"
                      >
                        Apply
                      </button>
                    </div>
                  </>
                )}
                {passwordFeedback && (
                  <p
                    className={`text-xs mt-2.5 ${
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
        <div className="bg-white rounded-2xl border border-[#EEF0F2] shadow-sm p-6">
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
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            {searchTerm && (
              <p className="text-sm text-gray-600 mt-1">
                Showing {filteredData.length} result(s) for "{searchTerm}"
              </p>
            )}
          </div>

          {/* Simple AG Grid table */}
          <div className="ag-theme-alpine" style={{ width: "100%" }}>
            {isMounted && (
              <AgGridReact
                ref={gridRef}
                rowData={filteredData}
                columnDefs={dynamicCols}
                defaultColDef={{ sortable: true, filter: true, resizable: true }}
                suppressRowVirtualisation={false}
                domLayout="autoHeight"
                theme={themeQuartz}
                pagination={true}
                paginationPageSize={10}
                paginationPageSizeSelector={[10, 20, 50]}
              />
            )}
          </div>
        </div>
      );
  };

  const CombinedView = ({ printRef }: { printRef: React.RefObject<HTMLDivElement> }) => {
    return (
      <div className="space-y-6" ref={printRef}>
        {/* Profile Card */}
        <ProfileTab />

        {/* Access */}
        <AllAccessTab />
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
      <CombinedView printRef={printRef} />
    </>
  );
}