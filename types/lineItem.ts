export interface EntitlementInfo {
    entitlementName: string;
    entitlementDescription: string;
  }
  export interface AIAssistInfo {
    Recommendation?: string;
    accessedWithinAMonth?: string;
    percAccessInSameDept?: string;
    percAccessWithSameJobtitle?: string;
    percAccessWithSameManager?: string;
    actionInLastReview?: string;
  }

  export interface LineItemDetail {
    AIAssist?: AIAssistInfo[];
    ID: string;
    entitlementInfo?: EntitlementInfo[];
    recommendation?: string;
    accessedWithinAMonth?: string;
    entityRisk?: string;
    itemRisk?:string;
    percAccessInSameDept?: string;
    percAccessWithSameJobtitle?: string;
    percAccessWithSameManager?: string;
    actionInLastReview?: string;
  }