"use client";

import { UserPlus, LayoutTemplate, ChevronDown } from "lucide-react";
import CustomPagination from "@/components/agTable/CustomPagination";
import { useEffect, useState } from "react";

interface RoleInfo {
  name: string;
  description: string;
}

const FALLBACK_ROLES: RoleInfo[] = [
  { name: "Domain Administrator", description: "" },
  { name: "Security Administrator", description: "" },
  { name: "Application Administrator", description: "" },
  { name: "User Administrator", description: "" },
  { name: "Help Desk Administrator", description: "" },
  { name: "Audit Administrator", description: "" },
];

type TabKey = "users" | "privileges" | "scope";

export default function GatewayAdminRolesSettings() {
  const [activeRoleIdx, setActiveRoleIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("users");
  const [roles, setRoles] = useState<RoleInfo[]>(FALLBACK_ROLES);
  const role = roles[activeRoleIdx];
  const [rolePrivileges, setRolePrivileges] = useState<Record<string, string[]>>({});
  const [allPrivileges, setAllPrivileges] = useState<string[]>([]);
  const [selectedPrivilege, setSelectedPrivilege] = useState<string>("");
  const [privPage, setPrivPage] = useState(1);
  const privPageSize = 10;

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [rolesRes, privRes] = await Promise.all([
          fetch("https://preview.keyforge.ai/privilegedrole/api/v1/ACMECOM/adminrole", { signal: controller.signal }),
          fetch("https://preview.keyforge.ai/privilegedrole/api/v1/ACMECOM/roleprivilege", { signal: controller.signal }),
        ]);
        if (!rolesRes.ok) throw new Error(`Roles request failed: ${rolesRes.status}`);
        const data: Array<{ adminRole: string; description: string }>= await rolesRes.json();
        const mapped: RoleInfo[] = data.map(d => ({ name: d.adminRole, description: d.description }));
        setRoles(mapped);
        setActiveRoleIdx(0);

        if (privRes.ok) {
          const privJson: { privileges?: Array<{ privilegeName: string }>; adminRolePrivileges?: Array<{ adminRole: string; privilegeSet: Array<{ privilegeName: string }> }> } = await privRes.json();
          const map: Record<string, string[]> = {};
          (privJson.adminRolePrivileges || []).forEach(entry => {
            map[entry.adminRole] = entry.privilegeSet.map(p => p.privilegeName);
          });
          setRolePrivileges(map);
          setAllPrivileges((privJson.privileges || []).map(p => p.privilegeName));
        }
      } catch (e) {
        // keep fallback
        console.error(e);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  const PrivilegeSelect = ({
    options,
    value,
    onChange,
  }: { options: string[]; value: string; onChange: (v: string) => void }) => {
    const [open, setOpen] = useState(false);
    return (
      <div className="relative w-[360px]">
        <button
          type="button"
          className="w-full border rounded px-3 py-2 text-sm bg-white flex items-center justify-between"
          onClick={() => setOpen(o => !o)}
        >
          <span className="truncate mr-2">{value || 'Select privilege'}</span>
          <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto border rounded bg-white shadow pb-1">
            {options.map(opt => (
              <button
                key={opt}
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${value===opt ? 'bg-gray-50' : ''}`}
                onClick={() => { onChange(opt); setOpen(false); }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full p-6">
      <div className="mx-auto min-h-[calc(100vh-120px)]">
        <div className="bg-white rounded-md shadow overflow-visible">
          {/* Header bar */}
          <div className="flex items-center justify-between px-5 py-3 text-white" style={{ backgroundColor: '#27B973' }}>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(39, 185, 115, 0.6)' }}>
                <LayoutTemplate className="w-4 h-4" />
              </div>
              <h2 className="font-semibold">Admin Roles</h2>
            </div>
            <button className="bg-white text-[#27B973] px-3 py-1.5 rounded text-sm font-medium">Submit</button>
          </div>

          <div className="grid grid-cols-[280px_1fr] gap-4 p-4 min-h-100">
            {/* Left role list */}
            <div className="border border-gray-200 rounded">
              {roles.map((r, idx) => (
                <button
                  key={r.name}
                  onClick={() => setActiveRoleIdx(idx)}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 ${idx===activeRoleIdx ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}
                >
                  {r.name}
                </button>
              ))}
            </div>

            {/* Right content */}
            <div>
              {/* Tabs row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-6 border-b border-gray-200 flex-1">
                  {([
                    { key: "users", label: "Users" },
                    { key: "privileges", label: "Privileges" },
                    { key: "scope", label: "Scope" },
                  ] as Array<{key: TabKey; label: string}>).map(t => (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      className={`px-1.5 py-2 -mb-px border-b-2 ${activeTab===t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {activeTab === 'users' && (
                  <button className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded text-sm self-center">
                    <UserPlus className="w-4 h-4" />
                    <span>Add User</span>
                  </button>
                )}
              </div>

              {/* Role details - show only on Users tab */}
              {activeTab === 'users' && (
                <div className="border border-gray-200 rounded mb-4">
                  <div className="grid grid-cols-[160px_1fr] border-b">
                    <div className="px-4 py-3 font-medium bg-gray-50 border-r">Name</div>
                    <div className="px-4 py-3">{role.name}</div>
                  </div>
                  <div className="grid grid-cols-[160px_1fr]">
                    <div className="px-4 py-3 font-medium bg-gray-50 border-r">Description</div>
                    <div className="px-4 py-3 text-gray-700">{role.description}</div>
                  </div>
                </div>
              )}

              {/* Users table area (empty state) */}
              {activeTab === 'users' && (
                <div className="border border-gray-200 rounded">
                  <div className="grid grid-cols-4 bg-gray-100 text-[13px] text-gray-700">
                    <div className="px-4 py-2 font-medium">User Name</div>
                    <div className="px-4 py-2 font-medium">First Name</div>
                    <div className="px-4 py-2 font-medium">Last Name</div>
                    <div className="px-4 py-2 font-medium">Email</div>
                  </div>
                  <div className="py-10 flex items-center justify-center text-gray-500 text-sm">
                    No Data
                  </div>
                </div>
              )}

              {activeTab === 'privileges' && (
                <div className="border border-gray-200 rounded">
                  {/* Toolbar with centered dropdown */}
                  <div className="flex items-center p-3 gap-3">
                    <span className="text-sm text-gray-700 font-medium">Privileges</span>
                    <div className="flex-1 flex justify-center">
                      <PrivilegeSelect
                        options={allPrivileges}
                        value={selectedPrivilege}
                        onChange={setSelectedPrivilege}
                      />
                    </div>
                    <div className="ml-auto">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded text-sm"
                        onClick={() => {
                          if (!selectedPrivilege || !role) return;
                          setRolePrivileges(prev => {
                            const current = prev[role.name] || [];
                            if (current.includes(selectedPrivilege)) return prev;
                            return { ...prev, [role.name]: [...current, selectedPrivilege] };
                          });
                          setSelectedPrivilege("");
                        }}
                      >
                        Add Privilege
                      </button>
                    </div>
                  </div>

                  {/* Table header */}
                  <div className="grid grid-cols-1 bg-gray-100 text-[13px] text-gray-700">
                    <div className="px-4 py-2 font-medium">Privilege Name</div>
                  </div>
                  {(() => {
                    const list = rolePrivileges[role?.name] || [];
                    if (list.length === 0) {
                      return <div className="py-6 text-center text-gray-500 text-sm">No Data</div>;
                    }
                    const start = (privPage - 1) * privPageSize;
                    const end = start + privPageSize;
                    const pageItems = list.slice(start, end);
                    return (
                      <>
                        <div className="text-sm text-gray-800">
                          {pageItems.map((p, i) => (
                            <div key={`${start + i}`} className="px-4 py-2 border-t border-gray-200">{p}</div>
                          ))}
                        </div>
                        <div className="p-2">
                          <CustomPagination
                            totalItems={list.length}
                            currentPage={privPage}
                            totalPages={Math.max(1, Math.ceil(list.length / privPageSize))}
                            pageSize={privPageSize}
                            onPageChange={setPrivPage}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'scope' && (
                <div className="border border-gray-200 rounded p-6 text-gray-600 text-sm">No data</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

