"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import WizardForm from "./WizardForm";
import Step1 from "./Step1";
import Step3 from "./Step3";
import Step4 from "./Step4";
import { StepProps } from "@/types/stepTypes";
import { FormData } from "@/types/stepTypes";
import { apiRequestWithAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { defaultExpression } from "@/utils/utils";

const CreateCampaign = () => {
  const searchParams = useSearchParams();
  const editTemplateId = searchParams.get("edit");
  const [initialFormData, setInitialFormData] = useState<FormData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editTemplateId) {
      // Fetch template data for editing
      setIsLoading(true);
      setError(null);
      const fetchTemplate = async () => {
        try {
          // Try to fetch campaign by ID
          let templateData: any = null;
          try {
            templateData = await apiRequestWithAuth<any>(
              `https://preview.keyforge.ai/campaign/api/v1/ACMECOM/getCampaign/${editTemplateId}`,
              { method: "GET" }
            );
          } catch (firstError) {
            // Fallback: Get all campaigns and find the matching one
            try {
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
                  campaign.id === editTemplateId ||
                  campaign.campaignID === editTemplateId ||
                  campaign.campaignId === editTemplateId
              );
            } catch (secondError) {
              console.error("Error fetching template:", secondError);
              throw secondError;
            }
          }

          if (!templateData) {
            throw new Error("Template not found");
          }

          // Map the template data to FormData structure
          // Step1 data
          const step1Data = {
            certificationTemplate: templateData.name || templateData.campaignName || templateData.templateName || "",
            description: templateData.description || "",
            campaignType: templateData.campaignType || "",
            instanceDefaultname: templateData.instanceDefaultname || "",
            ownerType: templateData.ownerType || templateData.campaignOwner?.ownerType || "User",
            ownerUser: templateData.ownerUser || (templateData.campaignOwner?.ownerType === "User" && templateData.campaignOwner?.ownerName ? 
              templateData.campaignOwner.ownerName.map((name: string) => ({ label: name, value: name })) : []) || [],
            ownerGroup: templateData.ownerGroup || (templateData.campaignOwner?.ownerType === "Group" && templateData.campaignOwner?.ownerName ? 
              templateData.campaignOwner.ownerName.map((name: string) => ({ label: name, value: name })) : []) || [],
          };

          // Step2 data
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

          const step2Data = {
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
            accountType: (scopingCriteria as any)?.accountType ?? "regular",
          };

          // Step3 data
          const reviewers = templateData.reviewers || [];
          const step3Data = {
            multiStageReview: reviewers.length > 1,
            stages: reviewers.length > 0 ? reviewers.map((reviewer: any) => ({
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
          };

          // Step4 data
          const notifications = templateData.notifications || {};
          const reminders = templateData.reminders || {};
          const certificationOptions = templateData.certificationOptions || {};
          const escalation = templateData.escalation || {};
          const campaignSchedular = templateData.campaignSchedular || {};

          const step4Data = {
            socReminders: reminders.enabled ? (reminders.frequencyInDays ? [{ label: `Every ${reminders.frequencyInDays} days`, value: reminders.frequencyInDays.toString() }] : []) : [],
            eocReminders: notifications.beforeExpiry?.numOfDaysBeforeExpiry?.map((days: number) => ({ label: `${days} days before expiry`, value: days.toString() })) || [],
            // Map notification toggles
            startOfCampaign: !!(notifications.onStart && (
              notifications.onStart.templateName ||
              (notifications.onStart.toAddress && notifications.onStart.toAddress.length > 0) ||
              (notifications.onStart.ccAddress && notifications.onStart.ccAddress.length > 0) ||
              (notifications.onStart.bccAddress && notifications.onStart.bccAddress.length > 0)
            )),
            startOfCampaignReminders: notifications.onStart ? [] : undefined,
            startOfCampaignTemplateName: notifications.onStart?.templateName || "",
            startOfCampaignTemplateData: notifications.onStart ? {
              selectedTemplateId: null,
              to: Array.isArray(notifications.onStart.toAddress) ? notifications.onStart.toAddress.join(', ') : (notifications.onStart.toAddress || ""),
              cc: Array.isArray(notifications.onStart.ccAddress) ? notifications.onStart.ccAddress.join(', ') : (notifications.onStart.ccAddress || ""),
              bcc: Array.isArray(notifications.onStart.bccAddress) ? notifications.onStart.bccAddress.join(', ') : (notifications.onStart.bccAddress || ""),
              templateName: notifications.onStart.templateName || "",
            } : undefined,
            remindersDuringCampaign: reminders.enabled || false,
            remindersDuringCampaignReminders: reminders.enabled && reminders.frequencyInDays ? 
              [{ label: `Every ${reminders.frequencyInDays} days`, value: reminders.frequencyInDays.toString() }] : [],
            remindersDuringCampaignTemplateName: reminders.templateName || "",
            remindersDuringCampaignTemplateData: reminders.enabled ? {
              selectedTemplateId: null,
              to: Array.isArray(reminders.toAddress) ? reminders.toAddress.join(', ') : (reminders.toAddress || ""),
              cc: Array.isArray(reminders.ccAddress) ? reminders.ccAddress.join(', ') : (reminders.ccAddress || ""),
              bcc: Array.isArray(reminders.bccAddress) ? reminders.bccAddress.join(', ') : (reminders.bccAddress || ""),
              templateName: reminders.templateName || "",
            } : undefined,
            atEscalation: !!(notifications.onEscalation && (
              notifications.onEscalation.templateName ||
              (notifications.onEscalation.toAddress && notifications.onEscalation.toAddress.length > 0) ||
              (notifications.onEscalation.ccAddress && notifications.onEscalation.ccAddress.length > 0) ||
              (notifications.onEscalation.bccAddress && notifications.onEscalation.bccAddress.length > 0)
            )),
            atEscalationReminders: notifications.onEscalation ? [] : undefined,
            atEscalationTemplateName: notifications.onEscalation?.templateName || "",
            atEscalationTemplateData: notifications.onEscalation ? {
              selectedTemplateId: null,
              to: Array.isArray(notifications.onEscalation.toAddress) ? notifications.onEscalation.toAddress.join(', ') : (notifications.onEscalation.toAddress || ""),
              cc: Array.isArray(notifications.onEscalation.ccAddress) ? notifications.onEscalation.ccAddress.join(', ') : (notifications.onEscalation.ccAddress || ""),
              bcc: Array.isArray(notifications.onEscalation.bccAddress) ? notifications.onEscalation.bccAddress.join(', ') : (notifications.onEscalation.bccAddress || ""),
              templateName: notifications.onEscalation.templateName || "",
            } : undefined,
            campaignClosure: !!(notifications.onCompletion && (
              notifications.onCompletion.templateName ||
              (notifications.onCompletion.toAddress && notifications.onCompletion.toAddress.length > 0) ||
              (notifications.onCompletion.ccAddress && notifications.onCompletion.ccAddress.length > 0) ||
              (notifications.onCompletion.bccAddress && notifications.onCompletion.bccAddress.length > 0)
            )),
            campaignClosureTemplateName: notifications.onCompletion?.templateName || "",
            campaignClosureTemplateData: notifications.onCompletion ? {
              selectedTemplateId: null,
              to: Array.isArray(notifications.onCompletion.toAddress) ? notifications.onCompletion.toAddress.join(', ') : (notifications.onCompletion.toAddress || ""),
              cc: Array.isArray(notifications.onCompletion.ccAddress) ? notifications.onCompletion.ccAddress.join(', ') : (notifications.onCompletion.ccAddress || ""),
              bcc: Array.isArray(notifications.onCompletion.bccAddress) ? notifications.onCompletion.bccAddress.join(', ') : (notifications.onCompletion.bccAddress || ""),
              templateName: notifications.onCompletion.templateName || "",
            } : undefined,
            msTeamsNotification: templateData.msTeamsNotification || false,
            msTeamsChannelName: templateData.msTeamsChannelName || "",
            msTeamsDescription: templateData.msTeamsDescription || "",
            msTeamsTeamId: templateData.msTeamsTeamId || "",
            allowDownloadUploadCropNetwork: templateData.allowDownloadUploadCropNetwork || false,
            markUndecidedRevoke: templateData.markUndecidedRevoke || false,
            disableBulkAction: certificationOptions.allowBulkActions !== undefined ? !certificationOptions.allowBulkActions : false,
            enforceComments: 
              (certificationOptions.requireCommentOnRevoke && certificationOptions.requireCommentOnCertify) ? "Custom Fields" :
              certificationOptions.requireCommentOnRevoke ? "Revoke" :
              certificationOptions.requireCommentOnCertify ? "Certify" : "",
            genericExpression: templateData.genericExpression?.map((exp: any) => ({
              id: uuidv4(),
              attribute: exp.attribute ? { label: exp.attribute, value: exp.attribute } : null,
              operator: exp.operator ? { label: exp.operator, value: exp.operator } : null,
              value: exp.value || "",
              logicalOp: "AND",
            })) || [],
            allowEscalation: escalation.enabled ? escalation.daysBeforeExpiry?.toString() || "" : "",
            certifierUnavailableUsers: certificationOptions.defaultCertifier?.reviewerId ? 
              [{ label: certificationOptions.defaultCertifier.reviewerId, value: certificationOptions.defaultCertifier.reviewerId }] : [],
            ticketConditionalApproval: templateData.ticketConditionalApproval || false,
            authenticationSignOff: certificationOptions.usePasswordOnSignOff || false,
            generatePin: templateData.generatePin || "",
            verifyUserAttribute: templateData.verifyUserAttribute || "",
            applicationScope: scopingCriteria.commonFilterForAccounts?.criteria === "allUserAccounts" || false,
            preDelegate: certificationOptions.allowPreDelegateToSignOff || false,
          };

          const mappedTemplate: FormData = {
            step1: step1Data,
            step2: step2Data,
            step3: step3Data,
            step4: step4Data,
          };
          
          setInitialFormData(mappedTemplate);
        } catch (error: any) {
          console.error("Error fetching template:", error);
          setError(error.message || "Failed to load template. Please try again.");
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchTemplate();
    }
  }, [editTemplateId]);

  const steps = [
    {
      name: "Basic Information",
      component: (props: React.JSX.IntrinsicAttributes & StepProps) => (
        <Step1 {...props} isEditMode={!!editTemplateId} />
      ),
    },
    {
      name: "Approval Workflow",
      component: (props: React.JSX.IntrinsicAttributes & StepProps) => (
        <Step3 {...props} />
      ),
    },
    {
      name: "General Settings",
      component: (props: React.JSX.IntrinsicAttributes & StepProps) => (
        <Step4 {...props} />
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div>Loading template...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={() => window.location.href = "/campaigns"}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Back to Campaigns
        </button>
      </div>
    );
  }

  return <WizardForm steps={steps} initialFormData={initialFormData} isEditMode={!!editTemplateId} editTemplateId={editTemplateId || undefined} />;
};

export default CreateCampaign;
