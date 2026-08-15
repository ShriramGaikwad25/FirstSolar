import { useState } from "react";

// Define types for form data (you could move this to a separate file)
interface Step1 {
  certificationTemplate: string;
  description: string;
  template: string;
  duration: string;
  ownerType: string;
  ownerUser: string[];
  ownerGroup: string[];
  reviewer: string;
}

interface Step2 {
  userType: string;
  specificUserExpression: string[];
  groupListIsChecked: boolean;
  userGroupList: string;
  importNewUserGroup: string | null;
  excludeUsersIsChecked: boolean;
  excludeUsers: string;
  selectData: string;
  specificApps: string[];
  expressionApps: string[];
  expressionEntitlement: string[];
  reviewer: string;
  reviewerlistIsChecked: boolean;
  customReviewerlist: string | null;
  genericExpression: string[];
}

interface Step3 {
  multiStageReview: boolean;
  stages: string[];
  duration: string;
  reviewRecurrence: string;
  startDate: string | null;
  end: string;
}

interface Step4 {
  socReminders: string[];
  eocReminders: string[];
  msTeamsNotification: boolean;
  allowDownloadUploadCropNetwork: boolean;
  markUndecidedRevoke: boolean;
  disableBulkAction: boolean;
  enforceComments: string;
  genericExpression: string[];
  allowEscalation: string;
  certifierUnavailableUsers: string[];
  ticketConditionalApproval: boolean;
  authenticationSignOff: boolean;
  generatePin: string;
  verifyUserAttribute: string;
  applicationScope: boolean;
  preDelegate: boolean;
}

type FormData = {
  step1: Step1;
  step2: Step2;
  step3: Step3;
  step4: Step4;
};

export function useFormData() {
  const [formData, setFormData] = useState<FormData>({
    step1: {
      certificationTemplate: "",
      description: "",
      template: "",
      duration: "",
      ownerType: "",
      ownerUser: [],
      ownerGroup: [],
      reviewer: "",
    },
    step2: {
      userType: "",
      specificUserExpression: [],
      groupListIsChecked: false,
      userGroupList: "",
      importNewUserGroup: null,
      excludeUsersIsChecked: false,
      excludeUsers: "",
      selectData: "",
      specificApps: [],
      expressionApps: [],
      expressionEntitlement: [],
      reviewer: "",
      reviewerlistIsChecked: false,
      customReviewerlist: null,
      genericExpression: [],
    },
    step3: {
      multiStageReview: false,
      stages: [],
      duration: "",
      reviewRecurrence: "",
      startDate: null,
      end: "",
    },
    step4: {
      socReminders: [],
      eocReminders: [],
      msTeamsNotification: false,
      allowDownloadUploadCropNetwork: false,
      markUndecidedRevoke: false,
      disableBulkAction: false,
      enforceComments: "",
      genericExpression: [],
      allowEscalation: "",
      certifierUnavailableUsers: [],
      ticketConditionalApproval: false,
      authenticationSignOff: false,
      generatePin: "",
      verifyUserAttribute: "",
      applicationScope: false,
      preDelegate: false,
    },
  });

  return [formData, setFormData] as const;
}
