"use client";
import { GridApi } from "ag-grid-enterprise";
import { Edit2Icon, UserRoundCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import ProxyActionModal from "../ProxyActionModal";
import EntitlementDetailsSidebar from "./EntitlementDetailsSidebar";
// Removed getEntitlementDetails import - now using existing data

interface EditReassignButtonsProps<T> {
  api: GridApi;
  selectedRows: T[];
  nodeData: T;
  reviewerId: string;
  certId: string;
  context: "user" | "account" | "entitlement";
  onActionSuccess?: () => void;
}

interface User {
  username: string;
  email: string;
  role: string;
}

interface Group {
  name: string;
  email: string;
  role: string;
}

const EditReassignButtons = <T extends { status?: string }>({
  api,
  selectedRows,
  nodeData,
  reviewerId,
  certId,
  context,
  onActionSuccess,
}: EditReassignButtonsProps<T>) => {
  const { openSidebar, closeSidebar, isOpen: isGlobalSidebarOpen } = useRightSidebar();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<User | Group | null>(
    null
  );
  const [editableFields, setEditableFields] = useState<Partial<T>>({});
  const [entitlementDetailsError] = useState<string | null>(null);
  const [localNodeData, setLocalNodeData] = useState<any>(nodeData);

  useEffect(() => {
    setLocalNodeData(nodeData);
  }, [nodeData]);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!api || selectedRows.length === 0) return;

    // Update grid rows to "Editing" status
    api.applyTransaction({
      update: selectedRows.map((row) => ({ ...row, status: "Editing" })),
    });

    // Open global side panel in edit mode
    setIsEditMode(true);
    openSidebar(
      <EntitlementDetailsSidebar
        data={localNodeData}
        errorMessage={entitlementDetailsError}
        editModeInitial={true}
        onSave={(edited) => {
          if (!api || !selectedRows.length) return;
          setEditableFields(edited);
          api.applyTransaction({
            update: selectedRows.map((row) => ({ ...row, ...edited, status: "Edited" })),
          });
          closeSidebar();
          setIsEditMode(false);
          alert("Changes saved successfully");
        }}
        onClose={() => {
          closeSidebar();
          setIsEditMode(false);
        }}
      />,
      {
        widthPx: 500,
        title:
          (localNodeData as any)?.["Ent Name"] ||
          (localNodeData as any)?.entitlementName ||
          "Entitlement",
      }
    );

    // Initialize editable fields with most recent node data
    setEditableFields({ ...(nodeData as any) });
  };

  const handleReassign = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
  };

  // Ensure fields are prefilled on first render of edit sidebar
  useEffect(() => {
    if (isGlobalSidebarOpen && isEditMode) {
      if (!editableFields || Object.keys(editableFields).length === 0) {
        setEditableFields({ ...(localNodeData as any) });
      }
    }
  }, [isGlobalSidebarOpen, isEditMode, localNodeData]);

  return (
    <div className="flex space-x-4 h-full items-center">
      <button type="button" onClick={handleEdit} title="Edit" aria-label="Edit selected rows">
        <Edit2Icon
          className="cursor-pointer hover:opacity-80"
          color="#2f8b57ff"
          strokeWidth="1"
          size="24"
        />
      </button>

      <button
        type="button"
        onClick={handleReassign}
        title="Reassign"
        aria-label="Reassign"
        className="p-1 rounded hover:bg-purple-50"
      >
        <UserRoundCheck className="w-5 h-5" color="#b146cc" strokeWidth={1} />
      </button>

      <ProxyActionModal
        isModalOpen={isModalOpen}
        closeModal={() => setIsModalOpen(false)}
        heading="Reassign Task"
        users={[
          { username: "john", email: "john@example.com", role: "admin" },
          { username: "jane", email: "jane@example.com", role: "user" },
        ]}
        groups={[
          { name: "admins", email: "admins@corp.com", role: "admin" },
          { name: "devs", email: "devs@corp.com", role: "developer" },
        ]}
        userAttributes={[
          { value: "username", label: "Username" },
          { value: "email", label: "Email" },
        ]}
        groupAttributes={[
          { value: "name", label: "Group Name" },
          { value: "role", label: "Role" },
        ]}
        onSelectOwner={(assignee) => {
          setSelectedAssignee(assignee);
          setIsModalOpen(false);
          if (assignee && selectedRows.length > 0) {
            api.applyTransaction({
              update: selectedRows.map((row) => ({
                ...row,
                assignee: assignee.username || assignee.name,
                status: "Reassigned",
              })),
            });
            alert(`Task reassigned to ${assignee.username || assignee.name}`);
          }
        }}
      />

      {selectedAssignee && (
        <div className="text-sm text-gray-700 mt-2">
          <strong>Assigned To:</strong>{" "}
          {Object.values(selectedAssignee).join(" | ")}
        </div>
      )}
    </div>
  );
};

export default EditReassignButtons;
