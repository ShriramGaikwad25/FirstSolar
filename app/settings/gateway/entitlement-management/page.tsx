"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ShieldCheck } from "lucide-react";
import ClientOnlyAgGrid from "@/components/ClientOnlyAgGrid";
import CustomPagination from "@/components/agTable/CustomPagination";

const ENTITLEMENT_FIELDS = [
  'ID',
  'Type',
  'Application Name',
  'Entitlement Name',
  'Description',
  'Total Assignments',
  'Dynamic Tag',
  'Business Objective',
  'Business Unit',
  'Entitlement Owner',
  'Compliance Type',
  'Data Classification',
  'Cost Center',
  'Created On',
  'Last Sync',
  'Application Instance',
  'Application Owner',
  'Hierarchy',
  'MFA Status',
  'Assignment',
  'License Type',
  'Risk',
  'Certifiable',
  'Revoke on Disable',
  'Shared Pwd',
  'SOD Check',
  'Access Scope',
  'Review Schedule',
  'Last Reviewed On',
  'Privileged',
  'Non Persistent Access',
  'Audit Comments',
  'Account Type Restriction',
  'Requestable',
  'Pre-Requisite',
  'Pre-Requisite Details',
  'Auto Assign Access Policy',
  'Provisioner Group',
  'Provisioning Steps',
  'Provisioning Mechanism',
  'Action on Native Change'
];

/** Entitlement metadata fields that do not show GenAI / Edit on Review checkboxes (Selection always has checkboxes) */
const FIELDS_WITHOUT_CHECKBOXES = new Set<string>([
  'ID',
  'Type',
  'Application Name',
  'Total Assignments',
  'Created On',
  'Last Sync',
  'Application Instance',
  'Last Reviewed On',
]);

function isCheckboxHiddenForField(fieldName: string): boolean {
  return FIELDS_WITHOUT_CHECKBOXES.has(fieldName);
}

interface EntitlementData {
  id: string;
  // Main fields
  entName?: string;
  entDescription?: string;
  entId?: string;
  // General
  entType?: string;
  totalAssignments?: string;
  appName?: string;
  dynamicTag?: string;
  // Business
  businessObjective?: string;
  businessUnit?: string;
  entOwner?: string;
  complianceType?: string;
  dataClassification?: string;
  costCenter?: string;
  // Technical
  createdOn?: string;
  lastSync?: string;
  appInstance?: string;
  appOwner?: string;
  hierarchy?: string;
  mfaStatus?: string;
  assignment?: string;
  licenseType?: string;
  // Security
  risk?: string;
  certifiable?: string;
  revokeOnDisable?: string;
  sharedPwd?: string;
  sodCheck?: string;
  accessScope?: string;
  reviewSchedule?: string;
  lastReviewedOn?: string;
  privileged?: string;
  nonPersistentAccess?: string;
  auditComments?: string;
  accountTypeRestriction?: string;
  // Lifecycle
  requestable?: string;
  preRequisite?: string;
  preRequisiteDetails?: string;
  autoAssignAccessPolicy?: string;
  provisionerGroup?: string;
  provisioningSteps?: string;
  provisioningMechanism?: string;
  actionOnNativeChange?: string;
  // Table controls - per field selection
  fieldSelection?: Record<string, boolean>;
  fieldGenAI?: Record<string, boolean>;
  fieldEditOnReview?: Record<string, boolean>;
}

interface FieldRow {
  id: string; // entitlementId-fieldName combination
  entitlementId: string;
  fieldName: string;
  selection: boolean;
  genAI: boolean;
  editOnReview: boolean;
}

export default function EntitlementManagementSettings() {
  const [entitlements, setEntitlements] = useState<EntitlementData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(25);
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState(false);
  const gridApiRef = useRef<any>(null);
  const [renderKey, setRenderKey] = useState(0);

  // Transform entitlements into field-level rows
  const fieldRows = useMemo(() => {
    const rows: FieldRow[] = [];
    entitlements.forEach(ent => {
      ENTITLEMENT_FIELDS.forEach(field => {
        rows.push({
          id: `${ent.id}-${field}`,
          entitlementId: ent.id,
          fieldName: field,
          selection: ent.fieldSelection?.[field] ?? true,
          genAI:
            ent.fieldGenAI?.[field] ??
            !isCheckboxHiddenForField(field),
          editOnReview: ent.fieldEditOnReview?.[field] || false
        });
      });
    });
    return rows;
  }, [entitlements]);

  useEffect(() => {
    if (dataLoaded) return; // Prevent duplicate loading
    
    const controller = new AbortController();
    let isMounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // TODO: Replace with actual API endpoint when available
        // const res = await fetch("API_ENDPOINT_HERE", { signal: controller.signal });
        // if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        // const data = await res.json();
        // if (isMounted) setRows(data);
        
        // Placeholder data for now - includes all fields from Entitlement Details sidebar
        const placeholderData: EntitlementData[] = [
          {
            id: '1',
            entName: 'Administrator Access',
            entDescription: 'Full administrative access to the system',
            entId: 'ENT-001',
            entType: 'Role',
            totalAssignments: '25',
            appName: 'Active Directory',
            dynamicTag: 'IT, Admin',
            businessObjective: 'System Administration',
            businessUnit: 'IT Operations',
            entOwner: 'John Doe',
            complianceType: 'SOX',
            dataClassification: 'Confidential',
            costCenter: 'CC-IT-001',
            createdOn: '2024-01-15',
            lastSync: '2024-12-10',
            appInstance: 'AD-PROD-01',
            appOwner: 'Jane Smith',
            hierarchy: 'Domain Admin > Admin',
            mfaStatus: 'Enabled',
            assignment: 'Direct',
            licenseType: 'Enterprise',
            risk: 'High',
            certifiable: 'Yes',
            revokeOnDisable: 'Yes',
            sharedPwd: 'No',
            sodCheck: 'None',
            accessScope: 'Global',
            reviewSchedule: 'Quarterly',
            lastReviewedOn: '2024-09-15',
            privileged: 'Yes',
            nonPersistentAccess: 'No',
            auditComments: 'Regular review required',
            accountTypeRestriction: 'Service Account',
            requestable: 'Yes',
            preRequisite: 'Security Training',
            preRequisiteDetails: 'Complete security awareness training',
            autoAssignAccessPolicy: 'Policy-001',
            provisionerGroup: 'IT-Provisioning',
            provisioningSteps: 'Step 1: Create account, Step 2: Assign role',
            provisioningMechanism: 'Automated',
            actionOnNativeChange: 'Sync',
            fieldSelection: {},
            fieldGenAI: {},
            fieldEditOnReview: {}
          }
        ];
        if (isMounted) {
          setEntitlements(placeholderData);
          setDataLoaded(true);
        }
      } catch (e: any) {
        if (e.name !== "AbortError" && isMounted) {
          setError(e?.message || "Failed to load data");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [dataLoaded]);

  const handleSelectionChange = useCallback((entitlementId: string, fieldName: string, checked: boolean) => {
    setEntitlements(prev => {
      return prev.map(ent => {
        if (ent.id === entitlementId) {
          const fieldSelection = ent.fieldSelection || {};
          return { ...ent, fieldSelection: { ...fieldSelection, [fieldName]: checked } };
        }
        return ent;
      });
    });
  }, []);

  const handleGenAIChange = useCallback((entitlementId: string, fieldName: string, checked: boolean) => {
    setEntitlements(prev => {
      return prev.map(ent => {
        if (ent.id === entitlementId) {
          const fieldGenAI = ent.fieldGenAI || {};
          return { ...ent, fieldGenAI: { ...fieldGenAI, [fieldName]: checked } };
        }
        return ent;
      });
    });
  }, []);

  const handleEditOnReviewChange = useCallback((entitlementId: string, fieldName: string, checked: boolean) => {
    setEntitlements(prev => {
      return prev.map(ent => {
        if (ent.id === entitlementId) {
          const fieldEditOnReview = ent.fieldEditOnReview || {};
          return { ...ent, fieldEditOnReview: { ...fieldEditOnReview, [fieldName]: checked } };
        }
        return ent;
      });
    });
  }, []);

  const entitlementColumnDefs = useMemo(
    () => [
      {
        headerName: "Entitlement Meta Data",
        field: "fieldName",
        flex: 2,
        minWidth: 320,
        sortable: true,
        filter: true,
        cellStyle: { overflow: "visible" },
        cellRenderer: (params: any) => {
          return (
            <div className="flex min-h-[2.5rem] items-center py-2 text-sm">
              <strong>{params.value}</strong>
            </div>
          );
        },
      },
      {
        headerName: "Selection",
        field: "selection",
        flex: 1,
        minWidth: 120,
        sortable: false,
        filter: false,
        cellStyle: {
          overflow: "visible",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        cellRenderer: (params: any) => {
          return (
            <div className="flex min-h-[2.5rem] w-full flex-shrink-0 items-center justify-center py-2">
              <input
                type="checkbox"
                checked={!!params.value}
                onChange={(e) => {
                  if (!isEditing) return;
                  handleSelectionChange(params.data.entitlementId, params.data.fieldName, e.target.checked);
                }}
                className={`h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${!isEditing ? "cursor-not-allowed" : ""}`}
              />
            </div>
          );
        },
      },
      {
        headerName: "GenAI",
        field: "genAI",
        flex: 1,
        minWidth: 120,
        sortable: false,
        filter: false,
        cellStyle: {
          overflow: "visible",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        cellRenderer: (params: any) => {
          if (isCheckboxHiddenForField(params.data.fieldName)) {
            return (
              <div className="flex min-h-[2.5rem] w-full items-center justify-center py-2">
                <span className="text-sm text-gray-300" aria-hidden="true">
                  —
                </span>
              </div>
            );
          }
          return (
            <div className="flex min-h-[2.5rem] w-full flex-shrink-0 items-center justify-center py-2">
              <input
                type="checkbox"
                checked={!!params.value}
                onChange={(e) => {
                  if (!isEditing) return;
                  handleGenAIChange(params.data.entitlementId, params.data.fieldName, e.target.checked);
                }}
                className={`h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${!isEditing ? "cursor-not-allowed" : ""}`}
              />
            </div>
          );
        },
      },
      {
        headerName: "Edit on Review",
        field: "editOnReview",
        flex: 1,
        minWidth: 140,
        sortable: false,
        filter: false,
        cellStyle: {
          overflow: "visible",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        cellRenderer: (params: any) => {
          if (isCheckboxHiddenForField(params.data.fieldName)) {
            return (
              <div className="flex min-h-[2.5rem] w-full items-center justify-center py-2">
                <span className="text-sm text-gray-300" aria-hidden="true">
                  —
                </span>
              </div>
            );
          }
          return (
            <div className="flex min-h-[2.5rem] w-full flex-shrink-0 items-center justify-center py-2">
              <input
                type="checkbox"
                checked={!!params.value}
                onChange={(e) => {
                  if (!isEditing) return;
                  handleEditOnReviewChange(params.data.entitlementId, params.data.fieldName, e.target.checked);
                }}
                className={`h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${!isEditing ? "cursor-not-allowed" : ""}`}
              />
            </div>
          );
        },
      },
    ],
    [isEditing, handleSelectionChange, handleGenAIChange, handleEditOnReviewChange]
  );

  const paginatedRows = useMemo(() => {
    if (pageSize === 'all') return fieldRows;
    const start = (currentPage - 1) * (pageSize as number);
    const end = start + (pageSize as number);
    return fieldRows.slice(start, end);
  }, [fieldRows, currentPage, pageSize]);

  const handleSave = () => {
    // TODO: Persist changes once save endpoint is available.
    setIsEditing(false);
  };

  return (
    <div className="h-full p-6">
      <div className="mx-auto min-h-[calc(100vh-120px)]">
        <div className="bg-white rounded-md shadow overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-100">
                <ShieldCheck className="w-4 h-4 text-gray-700" />
              </div>
              <h2 className="font-semibold text-gray-900">Entitlement Management</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 text-sm font-medium rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isEditing}
              >
                Save
              </button>
            </div>
          </div>

          <div className="mt-3 px-5 pb-4">
            {isLoading && <div className="px-5 py-3 text-sm text-gray-600">Loading...</div>}
            {error && <div className="px-5 py-3 text-sm text-red-600">{error}</div>}
            <div className="ag-theme-alpine w-full overflow-x-auto">
              <div className="min-w-[720px] w-full">
              <ClientOnlyAgGrid
                key={renderKey}
                rowData={paginatedRows}
                onGridReady={(params: any) => {
                  gridApiRef.current = params.api;
                }}
                getRowId={(params: any) => params.data.id}
                columnDefs={entitlementColumnDefs}
                domLayout="autoHeight"
              />
              </div>
            </div>
            <div className="mt-1">
              <CustomPagination
                totalItems={fieldRows.length}
                currentPage={currentPage}
                totalPages={pageSize === 'all' ? 1 : Math.max(1, Math.ceil(fieldRows.length / (pageSize as number)))}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

