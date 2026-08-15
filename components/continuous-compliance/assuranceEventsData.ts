export type AssuranceEventStatus =
  | "Detected"
  | "Reasoned"
  | "Pending Review"
  | "Approved"
  | "Fulfilled"
  | "Failed"
  | "Closed";

export type AssuranceEventRisk = "Critical" | "High" | "Medium" | "Low";

export type AssuranceEvent = {
  id: string;
  type: string;
  agent: string;
  object: string;
  app: string;
  source: string;
  current: string;
  recommended: string;
  owner: string;
  risk: AssuranceEventRisk;
  confidence: number;
  status: AssuranceEventStatus;
  detected: string;
  reviewer: string;
  impact: string;
  evidence: string;
};

export const assuranceEvents: AssuranceEvent[] = [
  {
    id: "AE-2026-00101",
    type: "Entitlement description missing",
    agent: "Entitlement Description Generator",
    object: "EBS_AP_INVOICE_APPROVER",
    app: "EBS · Payables",
    source: "EBS",
    current: "Blank",
    recommended:
      "Allows authorized Accounts Payable users to review and approve supplier invoice transactions before payment processing.",
    owner: "Maya Patel",
    risk: "High",
    confidence: 88,
    status: "Pending Review",
    detected: "2026-07-27 08:15",
    reviewer: "Application Owner",
    impact: "241 active members · high request volume · SOX-relevant finance access",
    evidence:
      "Original blank value, entitlement name, EBS application context, member profile, related AP approval roles, generated candidate, confidence score, owner decision pending.",
  },
  {
    id: "AE-2026-00102",
    type: "Entitlement description incomplete",
    agent: "Entitlement Description Generator",
    object: "SAP_MM_VENDOR_MAINTAIN",
    app: "SAP · Materials Management",
    source: "SAP",
    current: "Vendor access",
    recommended:
      "Grants ability to create and maintain vendor master records used in procurement and supplier payment workflows.",
    owner: "Carlos Mendes",
    risk: "Critical",
    confidence: 91,
    status: "Approved",
    detected: "2026-07-27 07:42",
    reviewer: "Application Owner",
    impact: "Vendor master access · SoD-sensitive · 76 active members",
    evidence:
      "Original description, generated description, SAP module context, peer entitlement comparison, owner approval, write-back queued.",
  },
  {
    id: "AE-2026-00103",
    type: "Entitlement description generic",
    agent: "Entitlement Description Generator",
    object: "SN_CHANGE_APPROVER_GLOBAL",
    app: "ServiceNow · Change Management",
    source: "ServiceNow",
    current: "Approver",
    recommended:
      "Allows designated users to approve enterprise change requests in ServiceNow according to the configured change workflow.",
    owner: "Noah Williams",
    risk: "Medium",
    confidence: 83,
    status: "Reasoned",
    detected: "2026-07-27 09:05",
    reviewer: "Application Owner",
    impact: "Change approval authority · 112 active members",
    evidence:
      "Generic value detected, related ServiceNow roles reviewed, candidate generated, awaiting routing decision.",
  },
  {
    id: "AE-2026-00104",
    type: "Service account owner inactive",
    agent: "Service Account Owner Resolver",
    object: "svc-ebs-payables-int",
    app: "EBS · Integration Account",
    source: "AD",
    current: "Owner: Ravi Shah · HR Status: Terminated",
    recommended: "Reassign owner to Priya Nair, current EBS Payables integration lead.",
    owner: "IAM Governance",
    risk: "Critical",
    confidence: 85,
    status: "Pending Review",
    detected: "2026-07-27 06:58",
    reviewer: "AppOwner",
    impact:
      "Privileged service account · used by nightly payables integration · password rotation due in 9 days",
    evidence:
      "AD account owner, Oracle Fusion HR termination status, application support mapping, manager chain, new owner confirmation, write-back success.",
  },
  {
    id: "AE-2026-00105",
    type: "Service account missing owner",
    agent: "Service Account Owner Resolver",
    object: "svc-sap-batch-vendor",
    app: "SAP · Batch Processing",
    source: "AD",
    current: "Owner: Null",
    recommended: "Assign to SAP Basis Operations workgroup; route to group manager for confirmation.",
    owner: "SAP Basis Operations",
    risk: "High",
    confidence: 78,
    status: "Pending Review",
    detected: "2026-07-27 08:49",
    reviewer: "Workgroup Manager",
    impact: "Batch job account · vendor master update path · no accountable owner",
    evidence:
      "Missing owner, AD service account attributes, SAP batch usage pattern, related job owner, recommended workgroup, approval pending.",
  },
  {
    id: "AE-2026-00106",
    type: "Service account owner mismatch",
    agent: "Service Account Owner Resolver",
    object: "svc-hr-elms-sync",
    app: "Oracle Fusion HR ↔ ELMS",
    source: "Oracle Fusion HR",
    current: "Owner: HR Analytics",
    recommended:
      "Owner should be ELMS Platform Operations based on integration ownership and support queue.",
    owner: "ELMS Platform Operations",
    risk: "Medium",
    confidence: 72,
    status: "Detected",
    detected: "2026-07-27 09:21",
    reviewer: "IAM Governance",
    impact: "HR-to-learning data synchronization account · owner does not match operating team",
    evidence:
      "Oracle Fusion HR integration metadata, ELMS job schedule, ServiceNow support group, initial detection only.",
  },
  {
    id: "AE-2026-00107",
    type: "Data classification missing",
    agent: "Data Classification Recommender",
    object: "HR_EMPLOYEE_COMP_VIEW",
    app: "Oracle Fusion HR · Compensation",
    source: "Oracle Fusion HR",
    current: "Data Classification: Null",
    recommended: "Classify as Confidential + HR Sensitive + Bulk PII.",
    owner: "Sophia Chen",
    risk: "Critical",
    confidence: 93,
    status: "Pending Review",
    detected: "2026-07-27 06:34",
    reviewer: "IS Risk",
    impact: "Compensation fields · 39 users · contains salary and employee identifiers",
    evidence:
      "Field labels, HR application context, attribute sample metadata, peer classification, Bulk PII signal, IS Risk review pending.",
  },
  {
    id: "AE-2026-00108",
    type: "Data classification inconsistent",
    agent: "Data Classification Recommender",
    object: "SAP_VENDOR_BANK_DETAIL",
    app: "SAP · Vendor Master",
    source: "SAP",
    current: "Internal",
    recommended: "Classify as Restricted + Financial Sensitive.",
    owner: "Carlos Mendes",
    risk: "High",
    confidence: 89,
    status: "Reasoned",
    detected: "2026-07-27 08:03",
    reviewer: "Application Owner",
    impact: "Vendor bank metadata · finance data · 24 active members",
    evidence:
      "Current classification, field naming pattern, SAP vendor master context, peer entitlements, model explanation generated.",
  },
  {
    id: "AE-2026-00109",
    type: "Data classification over-classified",
    agent: "Data Classification Recommender",
    object: "SN_KB_ARTICLE_PUBLISHER",
    app: "ServiceNow · Knowledge",
    source: "ServiceNow",
    current: "Restricted",
    recommended: "Reclassify as Internal; no PII or financial data signal detected.",
    owner: "Noah Williams",
    risk: "Low",
    confidence: 81,
    status: "Closed",
    detected: "2026-07-26 16:21",
    reviewer: "Application Owner",
    impact: "Knowledge publishing role · no sensitive-data evidence",
    evidence:
      "Classification anomaly, ServiceNow role context, lack of PII/financial signals, owner accepted recommendation, case closed.",
  },
  {
    id: "AE-2026-00110",
    type: "Training code changed",
    agent: "Training Requirement Impact Analysis",
    object: "EBS_AP_PAYMENT_RELEASE",
    app: "EBS · Payables",
    source: "ELMS",
    current: "TRN-FIN-AP-101 → TRN-FIN-PAY-201",
    recommended: "Accept change, require revalidation for 37 users missing the new course.",
    owner: "Maya Patel",
    risk: "Critical",
    confidence: 84,
    status: "Pending Review",
    detected: "2026-07-27 07:18",
    reviewer: "Training Compliance",
    impact: "126 current members · 37 missing updated training · payment release authority",
    evidence:
      "Old code, new ELMS code, course active status, impacted users, training completion gap, owner and Training Compliance approval pending.",
  },
  {
    id: "AE-2026-00111",
    type: "Training code removed",
    agent: "Training Requirement Impact Analysis",
    object: "SAP_MM_PO_RELEASE",
    app: "SAP · Procurement",
    source: "ELMS",
    current: "TRN-PROC-PO-200 → Null",
    recommended: "Reject removal; entitlement remains procurement approval access requiring training.",
    owner: "Carlos Mendes",
    risk: "High",
    confidence: 92,
    status: "Reasoned",
    detected: "2026-07-27 08:26",
    reviewer: "IAM Governance",
    impact: "PO release authority · SoD-sensitive · 58 active members",
    evidence:
      "Training code removal, procurement approval context, risk classification, peer entitlement training mapping, rejection recommendation.",
  },
  {
    id: "AE-2026-00112",
    type: "Training code invalid",
    agent: "Training Requirement Impact Analysis",
    object: "HR_MANAGER_SELF_SERVICE",
    app: "Oracle Fusion HR · Manager Self Service",
    source: "ELMS",
    current: "TRN-HR-MGR-OLD",
    recommended: "Replace with active code TRN-HR-MGR-2026 and notify 14 non-compliant managers.",
    owner: "Sophia Chen",
    risk: "Medium",
    confidence: 86,
    status: "Approved",
    detected: "2026-07-27 09:12",
    reviewer: "Training Compliance",
    impact: "Manager access · inactive ELMS course code · 14 users missing replacement training",
    evidence:
      "Inactive course lookup, replacement course mapping, affected users, Training Compliance approval, fulfillment queued.",
  },
  {
    id: "AE-2026-00113",
    type: "SoD flag missing",
    agent: "SoD Classification Validation Check",
    object: "EBS_AP_VENDOR_CREATE",
    app: "EBS · Payables",
    source: "EBS",
    current: "SoD Flag: No",
    recommended: "Set SoD Flag to Yes; map to Procure-to-Pay conflict domain.",
    owner: "Maya Patel",
    risk: "Critical",
    confidence: 94,
    status: "Pending Review",
    detected: "2026-07-27 06:47",
    reviewer: "IAM Governance",
    impact: "Vendor creation capability · conflicts with payment release and invoice approval",
    evidence:
      "Entitlement name, EBS function mapping, peer SoD flags, conflict domain, recommendation, governance review pending.",
  },
  {
    id: "AE-2026-00114",
    type: "SoD flag changed",
    agent: "SoD Classification Validation Check",
    object: "SAP_FI_GL_POST",
    app: "SAP · Finance",
    source: "SAP",
    current: "SoD Flag: Yes → No",
    recommended: "Reject change; GL posting remains SoD-relevant for financial close.",
    owner: "Liam O'Connor",
    risk: "High",
    confidence: 90,
    status: "Failed",
    detected: "2026-07-27 08:52",
    reviewer: "IAM Governance",
    impact: "GL posting authority · financial close control · write-back failed after approval",
    evidence:
      "Old flag, new flag, SAP finance context, conflict policy mapping, governance approval, write-back failure, retry required.",
  },
  {
    id: "AE-2026-00115",
    type: "SoD flag over-classified",
    agent: "SoD Classification Validation Check",
    object: "SN_INCIDENT_VIEW_ONLY",
    app: "ServiceNow · Incident",
    source: "ServiceNow",
    current: "SoD Flag: Yes",
    recommended:
      "Set SoD Flag to No; read-only incident access does not map to active conflict domain.",
    owner: "Noah Williams",
    risk: "Low",
    confidence: 87,
    status: "Closed",
    detected: "2026-07-26 15:38",
    reviewer: "Application Owner",
    impact: "Read-only access · no toxic-combination signal · no privileged action",
    evidence:
      "SoD over-classification, read-only permission analysis, peer role comparison, owner approval, source update complete.",
  },
];
