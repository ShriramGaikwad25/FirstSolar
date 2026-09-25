"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import CustomPagination from "@/components/agTable/CustomPagination";
import ActionCompletedToast from "@/components/ActionCompletedToast";
import { useRightSidebar } from "@/contexts/RightSidebarContext";

interface NativeUserRow {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  displayName?: string;
  adminRoles?: string[];
}

const ADMIN_ROLE_OPTIONS = [
  "Domain Administrator",
  "Security Administrator",
  "Application Administrator",
  "User Administrator",
  "Help Desk Administrator",
  "Audit Administrator",
];

const ROLE_PILL_CLASSES = [
  "bg-blue-100 text-blue-800",
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700",
  "bg-teal-100 text-teal-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
];

function rolePillClass(role: string): string {
  const idx = ADMIN_ROLE_OPTIONS.indexOf(role);
  return ROLE_PILL_CLASSES[idx >= 0 ? idx % ROLE_PILL_CLASSES.length : 0];
}

const inputClass =
  "border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelClass = "block text-sm text-gray-700 mb-1";
const secondaryButtonClass =
  "rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass =
  "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

export default function GatewayNativeUsersSettings() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<NativeUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openSidebar, closeSidebar } = useRightSidebar();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(10);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch("https://preview.keyforge.ai/nativeusers/api/v1/ACMECOM/getalluser", { signal: controller.signal });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data: Array<{ id: string; userName: string; firstName: string; lastName: string; email: string; displayName?: string; adminRoles?: string[]; }> = await res.json();
        setRows(data.map(u => ({ id: u.id, userName: u.userName, firstName: u.firstName, lastName: u.lastName, email: u.email, displayName: u.displayName, adminRoles: u.adminRoles })));
      } catch (e: any) {
        if (e.name !== "AbortError") setError(e?.message || "Failed to load");
      } finally {
        setIsLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => (
      r.userName.toLowerCase().includes(q) ||
      r.firstName.toLowerCase().includes(q) ||
      r.lastName.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q)
    ));
  }, [query, rows]);

  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filtered.length / (pageSize as number)));
  const paginatedRows = pageSize === "all" ? filtered : filtered.slice((currentPage - 1) * (pageSize as number), currentPage * (pageSize as number));

  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  const handleAddUser = () => {
    const AddUserForm = () => {
      const [userName, setUserName] = useState("");
      const [firstName, setFirstName] = useState("");
      const [lastName, setLastName] = useState("");
      const [displayName, setDisplayName] = useState("");
      const [email, setEmail] = useState("");
      const [password, setPassword] = useState("");
      const [adminRole, setAdminRole] = useState("");
      const [submitError, setSubmitError] = useState<string | null>(null);
      const [submitting, setSubmitting] = useState(false);

      const canSubmit = [userName, firstName, lastName, displayName, email, password, adminRole]
        .every(v => v.trim().length > 0) && !submitting;

      const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitError(null);
        try {
          setSubmitting(true);
          const payload = {
            userName: userName.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            displayName: displayName.trim(),
            email: email.trim(),
            password,
            adminRoles: [adminRole],
          };

          const res = await fetch("https://preview.keyforge.ai/nativeusers/api/v1/ACMECOM/createuser", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(`Request failed (${res.status})`);

          setRows(prev => ([
            ...prev,
            { id: payload.userName, userName: payload.userName, firstName: payload.firstName, lastName: payload.lastName, email: payload.email, displayName: payload.displayName, adminRoles: payload.adminRoles },
          ]));

          closeSidebar();
          setToast("Native user created.");
        } catch (e: any) {
          setSubmitError(e?.message || "Failed to create user");
        } finally {
          setSubmitting(false);
        }
      };

      return (
        <div>
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            Create a native (non-federated) account with its own credentials and administrator role.
          </p>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>User Name</label>
              <input value={userName} onChange={e => setUserName(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>First Name</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Last Name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Display Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Admin Role</label>
              <select value={adminRole} onChange={e => setAdminRole(e.target.value)} className={`${inputClass} bg-white`}>
                <option value="">Select role</option>
                {ADMIN_ROLE_OPTIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {submitError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-8">
            <button type="button" className={secondaryButtonClass} onClick={closeSidebar} disabled={submitting}>
              Cancel
            </button>
            <button type="button" className={primaryButtonClass} disabled={!canSubmit} onClick={handleSubmit}>
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      );
    };

    openSidebar(<AddUserForm />, { title: "Create Native User", widthPx: 520 });
  };

  const handleOpenUser = (row: NativeUserRow) => {
    const ModifyUser = () => {
      const [displayName, setDisplayName] = useState(row.displayName ?? "");
      const [firstName, setFirstName] = useState(row.firstName);
      const [lastName, setLastName] = useState(row.lastName);
      const [email, setEmail] = useState(row.email);
      const [roles, setRoles] = useState<string[]>(row.adminRoles ?? ["User Administrator"]);
      const [showReset, setShowReset] = useState(false);
      const [newPassword, setNewPassword] = useState("");
      const [confirmPassword, setConfirmPassword] = useState("");
      const [resetError, setResetError] = useState<string | null>(null);
      const [resetSubmitting, setResetSubmitting] = useState(false);
      const [updateError, setUpdateError] = useState<string | null>(null);
      const [updateSubmitting, setUpdateSubmitting] = useState(false);
      const [showAddRole, setShowAddRole] = useState(false);
      const [selectedRoleToAdd, setSelectedRoleToAdd] = useState("");

      const handleUpdate = async () => {
        if (updateSubmitting) return;
        setUpdateError(null);
        try {
          setUpdateSubmitting(true);
          const payload = {
            id: row.id,
            userName: row.userName,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            displayName: displayName.trim(),
            email: email.trim(),
            adminRoles: roles,
          };
          const res = await fetch("https://preview.keyforge.ai/nativeusers/api/v1/ACMECOM/updateuser", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(`Request failed (${res.status})`);
          setRows(prev => prev.map(u => u.id === row.id ? { ...u, firstName: payload.firstName, lastName: payload.lastName, displayName: payload.displayName, email: payload.email, adminRoles: payload.adminRoles } : u));
          closeSidebar();
          setToast("Native user updated.");
        } catch (e: any) {
          setUpdateError(e?.message || "Failed to update user");
        } finally {
          setUpdateSubmitting(false);
        }
      };

      const handleResetPassword = async () => {
        if (resetSubmitting) return;
        setResetError(null);
        try {
          setResetSubmitting(true);
          const res = await fetch("https://preview.keyforge.ai/nativeusers/api/v1/ACMECOM/changepassword", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName: row.userName, password: newPassword }),
          });
          if (!res.ok) throw new Error(`Request failed (${res.status})`);
          setShowReset(false);
          setNewPassword("");
          setConfirmPassword("");
          setToast("Password updated.");
        } catch (e: any) {
          setResetError(e?.message || "Failed to update password");
        } finally {
          setResetSubmitting(false);
        }
      };

      return (
        <div>
          <div className="flex flex-wrap items-center justify-end gap-2 mb-4 pb-4 border-b border-gray-200">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setShowReset((s) => !s)}
            >
              {showReset ? "Cancel Reset" : "Reset Password"}
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setShowAddRole((s) => !s)}
            >
              {showAddRole ? "Cancel" : "Add Role"}
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={updateSubmitting}
              onClick={handleUpdate}
            >
              {updateSubmitting ? "Updating..." : "Update"}
            </button>
          </div>

          {showReset && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-4">
              <div className="text-xs font-semibold text-gray-700 mb-2">Reset Password</div>
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Confirm Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} />
                </div>
              </div>
              {resetError && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                  {resetError}
                </div>
              )}
              <div className="flex justify-end gap-3 mt-3">
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => { setShowReset(false); setNewPassword(""); setConfirmPassword(""); setResetError(null); }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword || resetSubmitting}
                  onClick={handleResetPassword}
                >
                  {resetSubmitting ? "Updating..." : "Update Password"}
                </button>
              </div>
            </div>
          )}

          {showAddRole && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-4">
              <div className="text-xs font-semibold text-gray-700 mb-2">Add Role</div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className={labelClass}>Select Role</label>
                  <select
                    value={selectedRoleToAdd}
                    onChange={(e) => setSelectedRoleToAdd(e.target.value)}
                    className={`${inputClass} bg-white`}
                  >
                    <option value="">Select role</option>
                    {ADMIN_ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r} disabled={roles.includes(r)}>
                        {r}{roles.includes(r) ? " (current)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={!selectedRoleToAdd || roles.includes(selectedRoleToAdd)}
                  onClick={() => {
                    if (!selectedRoleToAdd || roles.includes(selectedRoleToAdd)) return;
                    setRoles((prev) => [...prev, selectedRoleToAdd]);
                    setSelectedRoleToAdd("");
                    setShowAddRole(false);
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Username</label>
                <input value={row.userName} disabled className={`${inputClass} bg-gray-100 text-gray-600`} />
              </div>
              <div>
                <label className={labelClass}>Display Name</label>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>First Name</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Last Name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
            </div>
          </div>

          {updateError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {updateError}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="text-sm font-semibold text-gray-800 mb-3">Admin Roles</div>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2 w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {roles.map((r) => (
                    <tr key={r}>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${rolePillClass(r)}`}>
                          {r}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          title="Remove role"
                          aria-label="Remove role"
                          className="p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-900 border border-red-200 hover:border-red-300 transition-colors"
                          onClick={() => setRoles((prev) => prev.filter((x) => x !== r))}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {roles.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-center text-sm text-gray-500">
                        No roles assigned.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    };

    openSidebar(<ModifyUser />, { title: "Modify Native User", widthPx: 560 });
  };

  return (
    <div className="h-full">
      <div className="w-full px-6 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Native Users</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Create and manage native (non-federated) administrator accounts, their roles, and credentials.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddUser}
            className="shrink-0 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Native Users</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {filtered.length} user{filtered.length === 1 ? "" : "s"} found
              </div>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, username, email..."
                className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {isLoading && <div className="px-5 py-3 text-sm text-gray-500">Loading native users...</div>}
          {error && (
            <div className="mx-5 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {error}
            </div>
          )}

          {!isLoading && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">First Name</th>
                    <th className="px-4 py-3">Last Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Admin Roles</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedRows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                          onClick={() => handleOpenUser(r)}
                        >
                          {r.userName}
                        </button>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700">{r.firstName}</td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700">{r.lastName}</td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700">{r.email}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1">
                          {(r.adminRoles ?? []).map((role) => (
                            <span key={role} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${rolePillClass(role)}`}>
                              {role}
                            </span>
                          ))}
                          {(!r.adminRoles || r.adminRoles.length === 0) && (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <button
                          type="button"
                          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                          onClick={() => handleOpenUser(r)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paginatedRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                        No native users match the current search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-gray-200 px-5 py-3">
            <CustomPagination
              totalItems={filtered.length}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
              pageSizeOptions={[10, 20, 50, 100, "all"]}
            />
          </div>
        </div>
      </div>

      <ActionCompletedToast
        isVisible={!!toast}
        message={toast || ""}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
