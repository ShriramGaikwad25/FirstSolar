import { FormData } from "@/types/stepTypes";
import { buildNestedExpression } from "@/utils/expressionBuilder";

/**
 * Transforms form data from the wizard form into the API payload structure
 */
export function transformFormDataToPayload(formData: FormData): any {
  const step1 = formData.step1 || {};
  const step2 = formData.step2 || {};
  const step3 = formData.step3 || {};
  const step4 = formData.step4 || {};

  /** Build nested expression { operator, conditions } for API; fallback empty shape when none */
  const buildFilterCriteria = (expressions: any[]) => {
    const nested = buildNestedExpression(expressions || []);
    if (nested) return nested;
    return {
      operator: "AND",
      conditions: [],
    };
  };

  // Build reviewers array from stages
  const reviewers: any[] = [];
  if (step3.stages && step3.stages.length > 0) {
    step3.stages.forEach((stage, index) => {
      const reviewerType = stage.reviewer;
      
      // Map form reviewer types to API reviewer types
      let mappedReviewerType = reviewerType;
      if (reviewerType === "Manager") mappedReviewerType = "Manager";
      else if (reviewerType === "User") mappedReviewerType = "User";
      else if (reviewerType === "Entitlement Owner") mappedReviewerType = "EntitlementOwner";
      else if (reviewerType === "Application Owner") mappedReviewerType = "ApplicationOwner";
      else if (reviewerType === "Role Owner") mappedReviewerType = "RoleOwner";
      else if (reviewerType === "custom-reviewer") {
        mappedReviewerType = "CustomCertifiers";
      }

      const reviewer: any = {
        stage: index + 1,
        reviewerType: mappedReviewerType,
        reviewDuration: Number(stage.duration) || 30,
        description: stage.description || `${mappedReviewerType} Review`,
        reviewerID: "",
        customCertifiers: [],
      };

      // Handle custom certifiers
      if (reviewerType === "custom-reviewer" && stage.genericExpression && stage.genericExpression.length > 0) {
        reviewer.customCertifiers = stage.genericExpression.map((exp: any) => ({
          attribute: exp.attribute?.value || exp.attribute || null,
          operator: exp.operator?.value || exp.operator || null,
          value: exp.value || null,
        }));
      }

      reviewers.push(reviewer);
    });
  } else {
    // Default reviewer if no stages
    reviewers.push({
      stage: 1,
      reviewerType: "Manager",
      reviewDuration: 30,
      description: "Manager Review",
      reviewerID: "",
      customCertifiers: [],
    });
  }

  // Build userCriteria
  const userCriteria: any = {
    criteria: "allUsers",
    selectedUsers: [],
    customUserGroups: [],
    excludeUsersFromCampaign: [],
    filtercriteria: {
      attribute: null,
      children: null,
      condition: null,
      operator: null,
      value: null,
    },
  };

  if (step2.userType === "All users") {
    userCriteria.criteria = "allUsers";
  } else if (step2.userType === "Specific users") {
    userCriteria.criteria = "selectedUsers";
    userCriteria.selectedUsers = (step2.specificUserExpression || []).map((exp: any) => ({
      attribute: exp.attribute?.value || exp.attribute,
      operator: exp.operator?.value || exp.operator,
      value: exp.value,
    }));
    userCriteria.filtercriteria = buildFilterCriteria(step2.specificUserExpression || []);
  } else if (step2.userType === "Custom User Group") {
    userCriteria.criteria = "customUserGroups";
    if (step2.groupListIsChecked && step2.importNewUserGroup) {
      userCriteria.customUserGroups = [`Imported ${step2.importNewUserGroup.name || "Group"}`];
    } else if (step2.userGroupList) {
      userCriteria.customUserGroups = step2.userGroupList.split(",").map((g: string) => g.trim());
    }
  }

  if (step2.excludeUsersIsChecked && step2.excludeUsers) {
    if (typeof step2.excludeUsers === "string") {
      userCriteria.excludeUsersFromCampaign = step2.excludeUsers.split(",").map((u: string) => u.trim());
    } else if (Array.isArray(step2.excludeUsers)) {
      userCriteria.excludeUsersFromCampaign = step2.excludeUsers.map((u: any) => 
        typeof u === "string" ? u : u.value || u.label || u
      );
    }
  }

  // Build scopingCriteria
  const scopingCriteria: any = {
    criteria: "allApplications",
    selectedApplications: [],
    appSpecificFilter: [],
    specificEntitlementsFilter: [],
    commonFilterForAccounts: {
      criteria: "allAccounts",
      filtercriteria: {
        attribute: null,
        children: null,
        condition: null,
        operator: null,
        value: null,
      },
      assignedAfter: null,
      createdAfter: "",
    },
    commonFilterForEntitlements: {
      criteria: "allEntitlementsOfAccount",
      filtercriteria: {
        attribute: null,
        children: null,
        condition: null,
        operator: null,
        value: null,
      },
      assignedAfter: "",
      createdAfter: null,
    },
  };

  if (step2.selectData === "All Applications") {
    scopingCriteria.criteria = "allApplications";
  } else if (step2.selectData === "Specific Applications") {
    scopingCriteria.criteria = "selectedApplications";
    scopingCriteria.selectedApplications = (step2.specificApps || []).map((app: any) => 
      typeof app === "string" ? app : app.value || app.id || app.label || app
    );
  } else if (step2.selectData === "Select Entitlement") {
    scopingCriteria.criteria = "specificEntitlements";
  }

  // Build commonFilterForAccounts
  if (step2.expressionApps && step2.expressionApps.length > 0) {
    scopingCriteria.commonFilterForAccounts.filtercriteria = buildFilterCriteria(step2.expressionApps);
    if (step4.applicationScope) {
      scopingCriteria.commonFilterForAccounts.criteria = "allUserAccounts";
    }
  }

  // Build commonFilterForEntitlements
  if (step2.expressionEntitlement && step2.expressionEntitlement.length > 0) {
    scopingCriteria.commonFilterForEntitlements.filtercriteria = buildFilterCriteria(step2.expressionEntitlement);
    if (step2.selectData === "Select Entitlement") {
      scopingCriteria.commonFilterForEntitlements.criteria = "specificEntitlements";
      scopingCriteria.commonFilterForEntitlements.assignedAfter = step2.expressionEntitlement[0]?.value || "";
    }
  }

  // Helper function to convert address data to array
  const convertToAddressArray = (addressData: any): string[] => {
    if (!addressData) return [];
    if (Array.isArray(addressData)) {
      return addressData.filter(addr => addr && addr.trim());
    }
    if (typeof addressData === 'string') {
      return addressData.split(',').map(addr => addr.trim()).filter(addr => addr.length > 0);
    }
    return [];
  };

  // Build reminders
  const remindersTemplateData = (step4 as any).remindersDuringCampaignTemplateData || {};
  const remindersReminders = step4.remindersDuringCampaignReminders || [];
  
  // Extract frequency from reminders - handle both object format {label, value} and direct value
  let frequencyValue = 7; // default
  if (remindersReminders.length > 0) {
    const firstReminder = remindersReminders[0];
    if (firstReminder) {
      const value = firstReminder.value !== undefined ? firstReminder.value : firstReminder;
      // Try to extract number from string like "Every 7 days" or just "7"
      if (typeof value === 'string') {
        // Extract number from string (e.g., "Every 7 days" -> 7, or "7" -> 7)
        const match = value.match(/\d+/);
        frequencyValue = match ? Number(match[0]) : 7;
      } else if (typeof value === 'number') {
        frequencyValue = value;
      } else {
        frequencyValue = Number(value) || 7;
      }
    }
  }
  
  const reminders = {
    enabled: step4.remindersDuringCampaign || false,
    frequencyInDays: frequencyValue,
    templateName: (step4 as any).remindersDuringCampaignTemplateName || "",
    toAddress: convertToAddressArray(remindersTemplateData.to),
    ccAddress: convertToAddressArray(remindersTemplateData.cc),
    bccAddress: convertToAddressArray(remindersTemplateData.bcc),
  };

  // Build notifications
  const startTemplateData = (step4 as any).startOfCampaignTemplateData || {};
  const completionTemplateData = (step4 as any).campaignClosureTemplateData || {};
  const escalationTemplateData = (step4 as any).atEscalationTemplateData || {};
  
  const notifications: any = {
    onStart: {
      templateName: (step4 as any).startOfCampaignTemplateName || "",
      toAddress: convertToAddressArray(startTemplateData.to),
      ccAddress: convertToAddressArray(startTemplateData.cc),
      bccAddress: convertToAddressArray(startTemplateData.bcc),
    },
    onCompletion: {
      templateName: (step4 as any).campaignClosureTemplateName || "",
      toAddress: convertToAddressArray(completionTemplateData.to),
      ccAddress: convertToAddressArray(completionTemplateData.cc),
      bccAddress: convertToAddressArray(completionTemplateData.bcc),
    },
    beforeExpiry: {
      numOfDaysBeforeExpiry: (step4.eocReminders && step4.eocReminders.length > 0)
        ? step4.eocReminders.map((reminder: any) => 
            Number(reminder.value) || Number(reminder) || 7
          )
        : [],
      templateName: "",
      toAddress: [],
      ccAddress: [],
      bccAddress: [],
    },
    onEscalation: {
      templateName: (step4 as any).atEscalationTemplateName || "",
      toAddress: convertToAddressArray(escalationTemplateData.to),
      ccAddress: convertToAddressArray(escalationTemplateData.cc),
      bccAddress: convertToAddressArray(escalationTemplateData.bcc),
    },
  };

  // Build escalation
  const escalation = {
    enabled: !!step4.allowEscalation && step4.allowEscalation !== "",
    daysBeforeExpiry: step4.allowEscalation ? Number(step4.allowEscalation) || 1 : 1,
  };

  // Build certificationOptions
  const certificationOptions: any = {
    allowDelegation: false,
    allowPreDelegateToSignOff: step4.preDelegate || false,
    allowBulkActions: step4.disableBulkAction === undefined ? true : !step4.disableBulkAction,
    usePasswordOnSignOff: step4.authenticationSignOff || false,
    actionOnUndecidedAccess: step4.markUndecidedRevoke ? "Revoke" : "Certify",
    requireCommentOnRevoke: step4.enforceComments === "Revoke" || step4.enforceComments === "Custom Fields",
    requireCommentOnCertify: step4.enforceComments === "Certify" || step4.enforceComments === "Custom Fields",
    closedLoopRemediation: step4.ticketConditionalApproval || false,
    defaultCertifier: {
      type: step4.certifierUnavailableUsers && step4.certifierUnavailableUsers.length > 0 ? "User" : "",
      reviewerId: step4.certifierUnavailableUsers && step4.certifierUnavailableUsers.length > 0
        ? (step4.certifierUnavailableUsers[0]?.value || step4.certifierUnavailableUsers[0]?.label || step4.certifierUnavailableUsers[0] || "")
        : "",
    },
  };

  // Build campaignSchedular
  const campaignSchedular: any = {
    endOfCampaign: "Never,Date on which the Campaign Ends(yyyy/MM/dd)",
    frequency: Number(step3.duration) || 7,
    startDate: "Start Date on which Campaign Trigger",
  };

  // Get campaign type from step1, or determine based on reviewers if not provided
  let campaignType = step1.campaignType || "";
  
  // If campaign type is not explicitly set in step1, determine it from reviewers
  if (!step1.campaignType) {
    if (reviewers.some((r: any) => r.reviewerType === "ApplicationOwner")) {
      campaignType = "AppOwnerReview";
    } else if (reviewers.some((r: any) => r.reviewerType === "EntitlementOwner")) {
      campaignType = "EntitlementOwnerReview";
    } else if (reviewers.some((r: any) => r.reviewerType === "RoleOwner")) {
      campaignType = "RoleOwnerReview";
    }
  }

  // Build campaign owner
  const campaignOwner = {
    ownerType: step1.ownerType || "",
    ownerName: step1.ownerType === "User"
      ? (step1.ownerUser || []).map((u: any) => 
          typeof u === "string" ? u : u.value || u.label || u
        )
      : step1.ownerType === "Group"
      ? (step1.ownerGroup || []).map((g: any) => 
          typeof g === "string" ? g : g.value || g.label || g
        )
      : [],
  };

  // Build instanceDefaultname - use from step1 if provided, otherwise generate from template name
  const instanceDefaultname = step1.instanceDefaultname || (step1.certificationTemplate 
    ? `${step1.certificationTemplate} - {{QTR}}`
    : "");

  // Build copyFromTemplate - from step1 template field if exists
  const copyFromTemplate = step1.template || "";

  // Build the final payload
  const payload: any = {
    name: step1.certificationTemplate || "",
    instanceDefaultname: instanceDefaultname,
    description: step1.description || "",
    campaignType: campaignType,
    copyFromTemplate: copyFromTemplate,
    campaignID: null,
    campaignDefinitionType: "MASTER",
    campaignDefinitionParentID: null,
    campaignDefinitionMasterID: null,
    campaignOwner: campaignOwner,
    certificationDuration: Number(step3.duration) || 30,
    reviewers: reviewers,
    userCriteria: userCriteria,
    scopingCriteria: scopingCriteria,
    reminders: reminders,
    notifications: notifications,
    escalation: escalation,
    certificationOptions: certificationOptions,
    campaignSchedular: campaignSchedular,
  };

  return payload;
}
