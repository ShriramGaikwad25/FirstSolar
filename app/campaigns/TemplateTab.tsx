"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import TemplateTable from "./TemplateTable";
import { apiRequestWithAuth } from "@/lib/auth";
import { transformFormDataToPayload } from "@/app/campaigns/new/transformFormData";
import { defaultExpression } from "@/utils/utils";

interface TemplateTabProps {
  campaignId?: string;
}

const TemplateTab: React.FC<TemplateTabProps> = ({ campaignId }) => {
  const router = useRouter();
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneTemplate, setCloneTemplate] = useState<any>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isCloning, setIsCloning] = useState(false);

  const handleEdit = (template: any) => {
    // Navigate to edit page with template ID
    router.push(`/campaigns/new?edit=${template.id}`);
  };

  const handleRunNow = (template: any) => {
    // Navigate to schedule page with template ID and name
    const templateName = encodeURIComponent(template.name || "Template");
    const queryParams = new URLSearchParams({ name: templateName, fromTab: "template" });
    if (campaignId) {
      queryParams.append("campaignId", campaignId);
    }
    router.push(`/campaigns/schedule/${template.id}?${queryParams.toString()}`);
  };

  const handleDelete = (template: any) => {
    if (window.confirm(`Are you sure you want to delete "${template.name}"?`)) {
      // TODO: Implement delete API call
      console.log("Delete template:", template);
      alert("Delete functionality will be implemented here");
    }
  };

  const handleClone = (template: any) => {
    setCloneTemplate(template);
    setNewTemplateName(`${template.name} (Copy)`);
    setShowCloneModal(true);
  };

  const handleCloneSubmit = async () => {
    if (!newTemplateName.trim()) {
      alert("Please enter a template name");
      return;
    }

    setIsCloning(true);
    try {
      // Fetch the full template data
      let templateData: any = null;
      try {
        templateData = await apiRequestWithAuth<any>(
          `https://preview.keyforge.ai/campaign/api/v1/ACMECOM/getCampaign/${cloneTemplate.id}`,
          { method: "GET" }
        );
      } catch (error) {
        console.error("Error fetching template data:", error);
        // Try to get from all campaigns
        const allCampaigns = await apiRequestWithAuth<any>(
          "https://preview.keyforge.ai/campaign/api/v1/ACMECOM/getAllCampaigns",
          { method: "GET" }
        );
        
        let campaignsArray: any[] = [];
        if (Array.isArray(allCampaigns)) {
          campaignsArray = allCampaigns;
        } else if (allCampaigns && typeof allCampaigns === "object") {
          campaignsArray = allCampaigns.items || allCampaigns.data || allCampaigns.campaigns || allCampaigns.results || [];
        }
        
        templateData = campaignsArray.find(
          (campaign: any) =>
            campaign.id === cloneTemplate.id ||
            campaign.campaignID === cloneTemplate.id ||
            campaign.campaignId === cloneTemplate.id
        );
      }

      if (!templateData) {
        throw new Error("Template data not found");
      }

      // Map template data to form data structure (similar to page.tsx)
      const userCriteria = templateData.userCriteria || {};
      const scopingCriteria = templateData.scopingCriteria || {};
      
      let userType = "All users";
      if (userCriteria.criteria === "selectedUsers") {
        userType = "Specific users";
      } else if (userCriteria.criteria === "customUserGroups") {
        userType = "Custom User Group";
      }

      let selectData = "All Applications";
      if (scopingCriteria.criteria === "selectedApplications") {
        selectData = "Specific Applications";
      } else if (scopingCriteria.criteria === "specificEntitlements") {
        selectData = "Select Entitlement";
      }

      const formData = {
        step1: {
          certificationTemplate: newTemplateName.trim(),
          description: templateData.description || "",
          campaignType: templateData.campaignType || "",
          instanceDefaultname: templateData.instanceDefaultname || "",
          ownerType: templateData.ownerType || templateData.campaignOwner?.ownerType || "User",
          ownerUser: templateData.ownerUser || (templateData.campaignOwner?.ownerType === "User" && templateData.campaignOwner?.ownerName ? 
            templateData.campaignOwner.ownerName.map((name: string) => ({ label: name, value: name })) : []) || [],
          ownerGroup: templateData.ownerGroup || (templateData.campaignOwner?.ownerType === "Group" && templateData.campaignOwner?.ownerName ? 
            templateData.campaignOwner.ownerName.map((name: string) => ({ label: name, value: name })) : []) || [],
        },
        step2: {
          userType: userType,
          specificUserExpression: userCriteria.selectedUsers?.map((user: any) => ({
            id: uuidv4(),
            attribute: user.attribute ? { label: user.attribute, value: user.attribute } : null,
            operator: user.operator ? { label: user.operator, value: user.operator } : null,
            value: user.value || "",
            logicalOp: "AND",
          })) || [],
          specificApps: scopingCriteria.selectedApplications?.map((app: string) => ({ label: app, value: app })) || [],
          expressionApps: scopingCriteria.commonFilterForAccounts?.filtercriteria ? [{
            id: uuidv4(),
            attribute: scopingCriteria.commonFilterForAccounts.filtercriteria.attribute ? 
              { label: scopingCriteria.commonFilterForAccounts.filtercriteria.attribute, value: scopingCriteria.commonFilterForAccounts.filtercriteria.attribute } : null,
            operator: scopingCriteria.commonFilterForAccounts.filtercriteria.operator ? 
              { label: scopingCriteria.commonFilterForAccounts.filtercriteria.operator, value: scopingCriteria.commonFilterForAccounts.filtercriteria.operator } : null,
            value: scopingCriteria.commonFilterForAccounts.filtercriteria.value || "",
            logicalOp: "AND",
          }] : [],
          expressionEntitlement: scopingCriteria.commonFilterForEntitlements?.filtercriteria ? [{
            id: uuidv4(),
            attribute: scopingCriteria.commonFilterForEntitlements.filtercriteria.attribute ? 
              { label: scopingCriteria.commonFilterForEntitlements.filtercriteria.attribute, value: scopingCriteria.commonFilterForEntitlements.filtercriteria.attribute } : null,
            operator: scopingCriteria.commonFilterForEntitlements.filtercriteria.operator ? 
              { label: scopingCriteria.commonFilterForEntitlements.filtercriteria.operator, value: scopingCriteria.commonFilterForEntitlements.filtercriteria.operator } : null,
            value: scopingCriteria.commonFilterForEntitlements.filtercriteria.value || "",
            logicalOp: "AND",
          }] : [defaultExpression],
          groupListIsChecked: userCriteria.customUserGroups?.some((group: string) => group.includes("Imported") || group.includes("import")) || false,
          userGroupList: userCriteria.customUserGroups?.filter((group: string) => !group.includes("Imported") && !group.includes("import")).join(",") || "",
          importNewUserGroup: null,
          excludeUsersIsChecked: userCriteria.excludeUsersFromCampaign && userCriteria.excludeUsersFromCampaign.length > 0,
          excludeUsers: userCriteria.excludeUsersFromCampaign?.map((user: string) => ({ label: user, value: user })) || "",
          selectData: selectData,
        },
        step3: {
          multiStageReview: (templateData.reviewers || []).length > 1,
          stages: (templateData.reviewers || []).length > 0 ? templateData.reviewers.map((reviewer: any) => ({
            reviewer: reviewer.reviewerType || reviewer.reviewer || "",
            duration: reviewer.reviewDuration?.toString() || reviewer.duration || "",
            nextReviewerAction: reviewer.nextReviewerAction || false,
            reviewerlistIsChecked: reviewer.reviewerType === "custom-reviewer" || false,
            genericExpression: reviewer.customCertifiers?.map((cert: any) => ({
              id: uuidv4(),
              attribute: cert.attribute ? { label: cert.attribute, value: cert.attribute } : null,
              operator: cert.operator ? { label: cert.operator, value: cert.operator } : null,
              value: cert.value || "",
              logicalOp: "AND",
            })) || [],
            customReviewerlist: null,
          })) : [{
            reviewer: "",
            duration: "",
            nextReviewerAction: false,
            reviewerlistIsChecked: false,
            genericExpression: [],
            customReviewerlist: null,
          }],
          duration: "",
          reviewRecurrence: "",
          startDate: null,
          end: "",
        },
        step4: {
          // Simplified step4 - you may need to add more fields based on your needs
          socReminders: [],
          eocReminders: [],
          startOfCampaign: false,
          remindersDuringCampaign: false,
          atEscalation: false,
          endOfCampaign: false,
          allowEscalation: "",
          allowDelegation: false,
          disableBulkAction: false,
          enforceComments: "",
          authenticationSignOff: false,
          markUndecidedRevoke: false,
          applicationScope: false,
          preDelegate: false,
          ticketConditionalApproval: false,
          certifierUnavailableUsers: [],
        },
      };

      // Transform to API payload
      const payload = transformFormDataToPayload(formData);

      // Call create API
      const response = await apiRequestWithAuth<any>(
        "https://preview.keyforge.ai/campaign/api/v1/ACMECOM/createCampaign",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify(payload),
        }
      );

      console.log("Template cloned successfully:", response);
      alert("Template cloned successfully!");
      
      // Close modal and refresh
      setShowCloneModal(false);
      setCloneTemplate(null);
      setNewTemplateName("");
      
      // Refresh the page to show the new template
      window.location.reload();
    } catch (error: any) {
      console.error("Error cloning template:", error);
      alert(`Failed to clone template: ${error.message || "Unknown error"}`);
    } finally {
      setIsCloning(false);
    }
  };

  const handleCloseCloneModal = () => {
    if (!isCloning) {
      setShowCloneModal(false);
      setCloneTemplate(null);
      setNewTemplateName("");
    }
  };

  return (
    <>
      <TemplateTable 
        onEdit={handleEdit} 
        onRunNow={handleRunNow}
        onDelete={handleDelete}
        onClone={handleClone}
      />
      
      {showCloneModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3">
          <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Clone Template</h2>
              <button
                onClick={handleCloseCloneModal}
                disabled={isCloning}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Template Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                disabled={isCloning}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Enter template name"
                autoFocus
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseCloneModal}
                disabled={isCloning}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleCloneSubmit}
                disabled={isCloning || !newTemplateName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCloning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Cloning...
                  </>
                ) : (
                  "Clone"
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default TemplateTab;

