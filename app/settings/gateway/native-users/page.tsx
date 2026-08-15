"use client";

import { useEffect, useMemo, useState } from "react";
import { UserCircle2, Plus, Search } from "lucide-react";
import ClientOnlyAgGrid from "@/components/ClientOnlyAgGrid";
import CustomPagination from "@/components/agTable/CustomPagination";
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

export default function GatewayNativeUsersSettings() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<NativeUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openSidebar, closeSidebar } = useRightSidebar();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

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
        if (e.name !== 'AbortError') setError(e?.message || 'Failed to load');
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

  const handleAddUser = () => {
    const AddUserForm = () => {
      const [userName, setUserName] = useState("");
      const [firstName, setFirstName] = useState("");
      const [lastName, setLastName] = useState("");
      const [displayName, setDisplayName] = useState("");
      const [email, setEmail] = useState("");
      const [password, setPassword] = useState("");
      const [adminRole, setAdminRole] = useState("");

      const [submitting, setSubmitting] = useState(false);
      const canSubmit = [userName, firstName, lastName, displayName, email, password, adminRole]
        .every(v => v.trim().length > 0) && !submitting;

      const handleSubmit = async () => {
        if (!canSubmit) return;
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
          if (!res.ok) throw new Error(`POST failed: ${res.status}`);

          // Optimistically update list
          setRows(prev => ([
            ...prev,
            { id: payload.userName, userName: payload.userName, firstName: payload.firstName, lastName: payload.lastName, email: payload.email }
          ]));

          closeSidebar();
        } catch (e) {
          console.error(e);
        } finally {
          setSubmitting(false);
        }
      };

      return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Create Native User</h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-[120px_1fr] items-center gap-3">
              <label className="text-sm text-gray-700">User Name</label>
              <input value={userName} onChange={e=>setUserName(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
            </div>
            <div className="grid grid-cols-[120px_1fr] items-center gap-3">
              <label className="text-sm text-gray-700">First Name</label>
              <input value={firstName} onChange={e=>setFirstName(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
            </div>
            <div className="grid grid-cols-[120px_1fr] items-center gap-3">
              <label className="text-sm text-gray-700">Last Name</label>
              <input value={lastName} onChange={e=>setLastName(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
            </div>
            <div className="grid grid-cols-[120px_1fr] items-center gap-3">
              <label className="text-sm text-gray-700">Display Name</label>
              <input value={displayName} onChange={e=>setDisplayName(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
            </div>
            <div className="grid grid-cols-[120px_1fr] items-center gap-3">
              <label className="text-sm text-gray-700">Email</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
            </div>
            <div className="grid grid-cols-[120px_1fr] items-center gap-3">
              <label className="text-sm text-gray-700">Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
            </div>
            <div className="grid grid-cols-[120px_1fr] items-center gap-3">
              <label className="text-sm text-gray-700">Admin Roles</label>
              <select value={adminRole} onChange={e=>setAdminRole(e.target.value)} className="border rounded px-3 py-2 text-sm w-full">
                <option value="">Select role</option>
                <option>Domain Administrator</option>
                <option>Security Administrator</option>
                <option>Application Administrator</option>
                <option>User Administrator</option>
                <option>Help Desk Administrator</option>
                <option>Audit Administrator</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-8">
            <button type="button" className="px-4 py-2 rounded text-sm text-white" style={{ backgroundColor: '#9CA3AF' }} onClick={closeSidebar}>Cancel</button>
            <button type="button" className={`px-4 py-2 rounded text-sm text-white ${canSubmit ? '' : 'opacity-60 cursor-not-allowed'}`} style={{ backgroundColor: '#27B973' }} disabled={!canSubmit} onClick={handleSubmit}>{submitting ? 'Submitting...' : 'Submit'}</button>
          </div>
        </div>
      );
    };

    openSidebar(<AddUserForm />, { widthPx: 520 });
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
      const [resetSubmitting, setResetSubmitting] = useState(false);
      const [updateSubmitting, setUpdateSubmitting] = useState(false);
      const [showAddRole, setShowAddRole] = useState(false);
      const [selectedRoleToAdd, setSelectedRoleToAdd] = useState("");

      const allRoles = [
        "Domain Administrator",
        "Security Administrator",
        "Application Administrator",
        "User Administrator",
        "Help Desk Administrator",
        "Audit Administrator",
      ];

      return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Modify User</h3>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 rounded text-sm text-white" style={{ backgroundColor: '#0EA5E9' }} onClick={() => setShowReset(!showReset)}>Reset Password</button>
              <button
                className="px-3 py-1.5 rounded text-sm text-white"
                style={{ backgroundColor: '#0EA5E9' }}
                onClick={() => setShowAddRole((s) => !s)}
              >
                {showAddRole ? 'Cancel' : 'Add Role'}
              </button>
              <button
                className={`px-3 py-1.5 rounded text-sm text-white ${updateSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={{ backgroundColor: '#27B973' }}
                disabled={updateSubmitting}
                onClick={async () => {
                  if (updateSubmitting) return;
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
                    const res = await fetch('https://preview.keyforge.ai/nativeusers/api/v1/ACMECOM/updateuser', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    if (!res.ok) throw new Error(`POST failed: ${res.status}`);
                    setRows(prev => prev.map(u => u.id === row.id ? { ...u, firstName: payload.firstName, lastName: payload.lastName, displayName: payload.displayName, email: payload.email, adminRoles: payload.adminRoles } : u));
                    closeSidebar();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setUpdateSubmitting(false);
                  }
                }}
              >
                {updateSubmitting ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>

          {showReset && (
            <div className="mb-5 border border-gray-200 rounded p-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <label className="text-sm text-gray-700">New Password</label>
                  <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
                </div>
                <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <label className="text-sm text-gray-700">Confirm Password</label>
                  <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" className="px-4 py-2 rounded text-sm text-white" style={{ backgroundColor: '#9CA3AF' }} onClick={() => { setShowReset(false); setNewPassword(""); setConfirmPassword(""); }}>Cancel</button>
                <button
                  type="button"
                  className={`px-4 py-2 rounded text-sm text-white ${newPassword && confirmPassword && newPassword===confirmPassword && !resetSubmitting ? '' : 'opacity-60 cursor-not-allowed'}`}
                  style={{ backgroundColor: '#27B973' }}
                  disabled={!newPassword || !confirmPassword || newPassword!==confirmPassword || resetSubmitting}
                  onClick={async () => {
                    if (resetSubmitting) return;
                    try {
                      setResetSubmitting(true);
                      const payload = { userName: row.userName, password: newPassword };
                      const res = await fetch('https://preview.keyforge.ai/nativeusers/api/v1/ACMECOM/changepassword', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                      });
                      if (!res.ok) throw new Error(`POST failed: ${res.status}`);
                      setShowReset(false);
                      setNewPassword("");
                      setConfirmPassword("");
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setResetSubmitting(false);
                    }
                  }}
                >
                  {resetSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </div>
          )}

          {showAddRole && (
            <div className="mb-5 border border-gray-200 rounded p-4">
              <div className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
                <label className="text-sm text-gray-700">Select Role</label>
                <select
                  value={selectedRoleToAdd}
                  onChange={(e) => setSelectedRoleToAdd(e.target.value)}
                  className="border rounded px-3 py-2 text-sm w-full"
                >
                  <option value="">Select role</option>
                  {allRoles.map((r) => (
                    <option key={r} value={r} disabled={roles.includes(r)}>
                      {r} {roles.includes(r) ? '(current)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`px-3 py-2 rounded text-sm text-white ${selectedRoleToAdd && !roles.includes(selectedRoleToAdd) ? '' : 'opacity-60 cursor-not-allowed'}`}
                  style={{ backgroundColor: '#0EA5E9' }}
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

          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                <label className="text-sm text-gray-700">UserName</label>
                <input value={row.userName} disabled className="border rounded px-3 py-2 text-sm w-full bg-gray-100 text-gray-600" />
              </div>
              <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                <label className="text-sm text-gray-700">Display Name</label>
                <input value={displayName} onChange={e=>setDisplayName(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                <label className="text-sm text-gray-700">First Name</label>
                <input value={firstName} onChange={e=>setFirstName(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
              </div>
              <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                <label className="text-sm text-gray-700">Last Name</label>
                <input value={lastName} onChange={e=>setLastName(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
              </div>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-center gap-3">
              <label className="text-sm text-gray-700">E-mail</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-semibold mb-2">Roles</h4>
            <table className="w-full text-sm border-t border-gray-200">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="px-4 py-2 font-medium">Roles</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r, idx) => (
                  <tr key={idx} className="border-t border-gray-200">
                    <td className="px-4 py-2">{r}</td>
                    <td className="px-4 py-2">
                      <button
                        title="Delete"
                        className="text-red-600"
                        onClick={() => setRoles((prev) => prev.filter((x) => x !== r))}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    openSidebar(<ModifyUser />, { widthPx: 560 });
  };

  return (
    <div className="h-full p-6">
      <div className="mx-auto">
        <div className="bg-white rounded-md shadow overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 text-white" style={{ backgroundColor: '#27B973' }}>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(39, 185, 115, 0.6)' }}>
                <UserCircle2 className="w-4 h-4" />
              </div>
              <h2 className="font-semibold">Native Users</h2>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded text-sm font-medium"
                style={{ color: '#27B973' }}
                onClick={handleAddUser}
              >
                <Plus className="w-4 h-4" />
                <span>Add User</span>
              </button>
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Name"
                  className="pl-9 pr-3 py-1.5 rounded text-sm text-gray-900 placeholder-gray-400 bg-white"
                />
                <Search className="w-4 h-4 text-gray-500 absolute left-2 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto mt-3">
            {isLoading && <div className="px-5 py-2 text-sm text-gray-600">Loading...</div>}
            {error && <div className="px-5 py-2 text-sm text-red-600">{error}</div>}
            <div className="ag-theme-alpine w-full">
              <ClientOnlyAgGrid
                rowData={(pageSize==='all'? filtered : filtered.slice((currentPage-1)*(pageSize as number), (currentPage)*(pageSize as number)))}
                columnDefs={[
                  { headerName: 'UserName', field: 'userName', flex: 1, cellRenderer: (p: any) => (
                    <button className="text-sky-700 hover:underline" onClick={() => handleOpenUser(p.data)}>{p.value}</button>
                  )},
                  { headerName: 'First Name', field: 'firstName', flex: 1 },
                  { headerName: 'Lst Name', field: 'lastName', flex: 1 },
                  { headerName: 'E-mail', field: 'email', flex: 1.5 },
                ]}
                domLayout="autoHeight"
              />
            </div>
            <div className="mt-1">
              <CustomPagination
                totalItems={filtered.length}
                currentPage={currentPage}
                totalPages={pageSize==='all' ? 1 : Math.max(1, Math.ceil(filtered.length / (pageSize as number)))}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(sz)=>{ setPageSize(sz); setCurrentPage(1); }}
              />
            </div>
          </div>

          
        </div>
      </div>
    </div>
  );
}


