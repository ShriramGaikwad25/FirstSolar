# Access Request API Contracts

Tenant: `{tenant}` (e.g. `ACMECOM`)

---

## 1. Access Request — Submit

`POST /workflow/api/v1/{tenant}/submitrequest/{requesterId}`

**Request**

```json
{
  "requestParameter": {
    "operation": "GRANT",
    "isJit": false,
    "requestType": "REGULAR",
    "requestedFor": "OTHERS",
    "justification": "Need read access for the Q4 audit.",
    "startDate": "2026-09-21T14:30:00+05:30",
    "endDate": null,
    "isIndefinite": true
  },
  "beneficiary": [
    { "userId": "9c1d4e77-0b3a-4e21-9f4a-2c7d61f0a8b2" }
  ],
  "beneficiaryGroup": [
    { "groupId": "eng-platform", "groupName": "Engineering — Platform" }
  ],
  "requestItem": [
    {
      "catalogId": "b73ac8d7-f4cd-486f-93c7-3589ab5c5296",
      "itemType": "ENTITLEMENT",
      "startDate": "2026-09-21T14:30:00+05:30",
      "endDate": "2026-12-31T23:59:00+05:30",
      "isIndefinite": false,
      "comments": "Audit read-only.",
      "customFields": [
        { "key": "costCenter", "label": "Cost Center", "value": "CC-4471" }
      ],
      "provisioningAttributes": [
        { "target": "sAMAccountName", "value": "jdoe" }
      ],
      "attachments": [
        { "fileName": "approval.pdf", "email": "manager@acme.com" }
      ]
    }
  ]
}
```

**Response — 201**

```json
{
  "data": {
    "requestId": "1042",
    "workflowInstanceId": "1042",
    "status": "PENDING_APPROVAL",
    "submittedAt": "2026-09-21T14:30:12+05:30",
    "items": [
      {
        "requestedItemId": "5581",
        "catalogId": "b73ac8d7-f4cd-486f-93c7-3589ab5c5296",
        "status": "PENDING_APPROVAL"
      }
    ]
  }
}
```

**Response — 422 (business failure)**

```json
{
  "error": {
    "code": "TRAINING_VALIDATION_FAILED",
    "message": "Required training not completed for 2 items.",
    "details": [
      {
        "catalogId": "b73ac8d7-f4cd-486f-93c7-3589ab5c5296",
        "requestedForUserId": "9c1d4e77-0b3a-4e21-9f4a-2c7d61f0a8b2",
        "trainingCode": "SEC-101",
        "message": "Training SEC-101 must be completed before requesting this entitlement."
      }
    ]
  }
}
```

---

## 2. Remove Request — Submit

`POST /workflow/api/v1/{tenant}/submitrequest/{requesterId}`

**Request**

```json
{
  "requestParameter": {
    "operation": "REVOKE",
    "isJit": false,
    "requestType": "REGULAR",
    "requestedFor": "OTHERS",
    "justification": "User moved to Finance; platform access no longer required.",
    "startDate": "2026-09-21T14:30:00+05:30"
  },
  "beneficiary": [
    { "userId": "9c1d4e77-0b3a-4e21-9f4a-2c7d61f0a8b2" }
  ],
  "requestItem": [
    {
      "operation": "REVOKE",
      "catalogId": "b73ac8d7-f4cd-486f-93c7-3589ab5c5296",
      "entitlementId": "e21f9a04-7c55-4f0b-9a1e-3d6b8c2f5471",
      "accountName": "jdoe",
      "applicationName": "Oracle ERP",
      "assignmentId": "asg-88213",
      "comments": "Revoke — role change."
    }
  ]
}
```

**Response — 201** — same shape as [§1](#1-access-request--submit), `status` reflects the revoke workflow.
**Response — 422** — same shape as [§1](#1-access-request--submit).

---

## 3. Track Request — List

`GET /workflow/api/v1/{tenant}/requests?requestedBy={userId}&status=PENDING_APPROVAL,INFO_REQUESTED&raisedFrom=2026-09-01&raisedTo=2026-09-30&application=Oracle%20ERP&q=payables&page=0&size=20&sort=createdAt,desc`

**Response — 200**

```json
{
  "data": [
    {
      "requestId": "1042",
      "workflowInstanceId": "1042",
      "status": "PENDING_APPROVAL",
      "operation": "GRANT",
      "requestType": "REGULAR",
      "isJit": false,
      "createdAt": "2026-09-14T10:02:11+05:30",
      "dueAt": "2026-09-28T10:02:11+05:30",
      "daysOpen": 7,
      "justification": "Need read access for the Q4 audit.",
      "requestedBy": {
        "userId": "f558e3b2-348b-4ff3-be4c-a3c5dc8b5a91",
        "displayName": "John Doe",
        "username": "jdoe",
        "email": "jdoe@acme.com",
        "department": "IT",
        "jobTitle": "Engineer",
        "employeeId": "E-1188",
        "managerName": "Jane Roe"
      },
      "requestedFor": {
        "userId": "9c1d4e77-0b3a-4e21-9f4a-2c7d61f0a8b2",
        "displayName": "Alice Smith",
        "username": "asmith",
        "email": "asmith@acme.com",
        "department": "Finance",
        "jobTitle": "Analyst",
        "employeeId": "E-2091",
        "managerName": "Jane Roe"
      },
      "actions": { "canWithdraw": true, "canProvideAdditionalDetails": false },
      "items": [
        {
          "requestedItemId": "5581",
          "catalogId": "b73ac8d7-f4cd-486f-93c7-3589ab5c5296",
          "entitlementId": "e21f9a04-7c55-4f0b-9a1e-3d6b8c2f5471",
          "name": "ERP Payables Read",
          "applicationName": "Oracle ERP",
          "accountName": "jdoe",
          "itemType": "ENTITLEMENT",
          "status": "PENDING_APPROVAL",
          "startDate": "2026-09-21T00:00:00+05:30",
          "endDate": "2026-12-31T23:59:00+05:30",
          "comments": "Audit read-only.",
          "risk": "HIGH",
          "privileged": false,
          "requiresTraining": true,
          "sod": {
            "hasConflict": true,
            "severity": "HIGH",
            "policyId": "SOD-014",
            "policyName": "Payables vs Payments",
            "businessProcess": "Procure to Pay",
            "owner": "Jane Roe",
            "description": "Cannot hold both entry and release rights.",
            "conflictsWith": [
              { "catalogId": "c41d9f22-8a7b-4c33-91e5-6f2a0b4d7e19", "name": "ERP Payments Release" }
            ]
          }
        }
      ]
    }
  ],
  "page": { "number": 0, "size": 20, "totalElements": 137, "totalPages": 7 }
}
```

---

## 4. Track Request — Details

`GET /workflow/api/v1/{tenant}/requests/{requestId}`

**Response — 200**

```json
{
  "data": {
    "requestId": "1042",
    "workflowInstanceId": "1042",
    "status": "PENDING_APPROVAL",
    "operation": "GRANT",
    "requestType": "REGULAR",
    "isJit": false,
    "createdAt": "2026-09-14T10:02:11+05:30",
    "dueAt": "2026-09-28T10:02:11+05:30",
    "justification": "Need read access for the Q4 audit.",
    "requestedBy":  { "userId": "f558e3b2-348b-4ff3-be4c-a3c5dc8b5a91", "displayName": "John Doe", "username": "jdoe", "email": "jdoe@acme.com", "department": "IT", "jobTitle": "Engineer", "employeeId": "E-1188", "managerName": "Jane Roe" },
    "requestedFor": { "userId": "9c1d4e77-0b3a-4e21-9f4a-2c7d61f0a8b2", "displayName": "Alice Smith", "username": "asmith", "email": "asmith@acme.com", "department": "Finance", "jobTitle": "Analyst", "employeeId": "E-2091", "managerName": "Jane Roe" },
    "actions": { "canWithdraw": true, "canProvideAdditionalDetails": false },
    "validation": {
      "training": {
        "status": "COMPLETED",
        "required": true,
        "warnings": [{ "code": "SEC-101", "message": "Expires in 14 days." }]
      },
      "sod": {
        "status": "COMPLETED",
        "violations": [{ "policyId": "SOD-014", "severity": "HIGH", "message": "Conflicts with ERP Payments Release." }]
      }
    },
    "items": [
      {
        "requestedItemId": "5581",
        "catalogId": "b73ac8d7-f4cd-486f-93c7-3589ab5c5296",
        "entitlementId": "e21f9a04-7c55-4f0b-9a1e-3d6b8c2f5471",
        "name": "ERP Payables Read",
        "applicationName": "Oracle ERP",
        "accountName": "jdoe",
        "itemType": "ENTITLEMENT",
        "status": "PENDING_APPROVAL",
        "startDate": "2026-09-21T00:00:00+05:30",
        "endDate": "2026-12-31T23:59:00+05:30",
        "comments": "Audit read-only.",
        "risk": "HIGH",
        "privileged": false,
        "requiresTraining": true,
        "sod": { "hasConflict": true, "severity": "HIGH", "policyId": "SOD-014", "policyName": "Payables vs Payments", "businessProcess": "Procure to Pay", "owner": "Jane Roe", "description": "Cannot hold both entry and release rights.", "conflictsWith": [] },
        "aiRecommendation": {
          "beneficiaryAnalysis": "User's peers in IT hold this entitlement.",
          "contextualRisk": "Elevated — financial data access.",
          "riskSensitivityAnalysis": "High sensitivity; SOX in scope.",
          "peerAnalysis": "8 of 12 peers hold this."
        },
        "steps": [
          {
            "stepId": "9001",
            "templateStepId": 1,
            "stepCode": "MANAGER_APPROVAL",
            "label": "Assigned to User Manager",
            "status": "COMPLETED",
            "actor": { "userId": "f558e3b2-348b-4ff3-be4c-a3c5dc8b5a91", "displayName": "Jane Roe" },
            "actedAt": "2026-09-15T08:11:00+05:30",
            "comment": "Approved — valid business need."
          }
        ]
      }
    ]
  }
}
```

---

## 5. My Approvals — List

`GET /workflow/api/v1/{tenant}/approvals?assigneeId={userId}&status=PENDING,INFO_REQUESTED&from=2026-09-01&to=2026-09-30&q=payables&page=0&size=20&sort=createdAt,desc`

**Response — 200**

```json
{
  "data": [
    {
      "taskId": "7781",
      "requestId": "1042",
      "status": "PENDING",
      "createdAt": "2026-09-14T10:02:11+05:30",
      "lastActedAt": "2026-09-15T08:11:00+05:30",
      "dueAt": "2026-09-28T10:02:11+05:30",
      "stepCode": "APP_OWNER_APPROVAL",
      "justification": "Need read access for the Q4 audit.",
      "requestedBy":  { "userId": "f558e3b2-348b-4ff3-be4c-a3c5dc8b5a91", "displayName": "John Doe", "username": "jdoe", "email": "jdoe@acme.com", "department": "IT", "jobTitle": "Engineer", "employeeId": "E-1188", "managerName": "Jane Roe" },
      "requestedFor": { "userId": "9c1d4e77-0b3a-4e21-9f4a-2c7d61f0a8b2", "displayName": "Alice Smith", "username": "asmith", "email": "asmith@acme.com", "department": "Finance", "jobTitle": "Analyst", "employeeId": "E-2091", "managerName": "Jane Roe" },
      "items": [
        {
          "requestedItemId": "5581",
          "catalogId": "b73ac8d7-f4cd-486f-93c7-3589ab5c5296",
          "entitlementId": "e21f9a04-7c55-4f0b-9a1e-3d6b8c2f5471",
          "name": "ERP Payables Read",
          "applicationName": "Oracle ERP",
          "accountName": "asmith",
          "itemType": "ENTITLEMENT",
          "risk": "HIGH",
          "privileged": false,
          "requiresTraining": true,
          "startDate": "2026-09-21T00:00:00+05:30",
          "endDate": "2026-12-31T23:59:00+05:30",
          "decision": null,
          "sod": { "hasConflict": true, "severity": "HIGH", "policyId": "SOD-014", "policyName": "Payables vs Payments", "businessProcess": "Procure to Pay", "owner": "Jane Roe", "description": "Cannot hold both entry and release rights.", "conflictsWith": [] }
        }
      ]
    }
  ],
  "page": { "number": 0, "size": 20, "totalElements": 12, "totalPages": 1 }
}
```

---

## 6. My Approval — Details

### 6a. Get

`GET /workflow/api/v1/{tenant}/approvals/{taskId}`

**Response — 200**

```json
{
  "data": {
    "taskId": "7781",
    "requestId": "1042",
    "status": "PENDING",
    "stepCode": "APP_OWNER_APPROVAL",
    "assignee": { "userId": "f558e3b2-348b-4ff3-be4c-a3c5dc8b5a91", "displayName": "Jane Roe" },
    "createdAt": "2026-09-14T10:02:11+05:30",
    "dueAt": "2026-09-28T10:02:11+05:30",
    "durationDays": 7,
    "justification": "Need read access for the Q4 audit.",
    "requestedBy":  { "userId": "f558e3b2-348b-4ff3-be4c-a3c5dc8b5a91", "displayName": "John Doe", "username": "jdoe", "email": "jdoe@acme.com", "department": "IT", "jobTitle": "Engineer", "employeeId": "E-1188", "managerName": "Jane Roe" },
    "requestedFor": { "userId": "9c1d4e77-0b3a-4e21-9f4a-2c7d61f0a8b2", "displayName": "Alice Smith", "username": "asmith", "email": "asmith@acme.com", "department": "Finance", "jobTitle": "Analyst", "employeeId": "E-2091", "managerName": "Jane Roe" },
    "validation": {
      "training": { "status": "COMPLETED", "required": true, "warnings": [{ "code": "SEC-101", "message": "Expires in 14 days." }] },
      "sod":      { "status": "COMPLETED", "violations": [{ "policyId": "SOD-014", "severity": "HIGH", "message": "Conflicts with ERP Payments Release." }] }
    },
    "items": [
      {
        "requestedItemId": "5581",
        "catalogId": "b73ac8d7-f4cd-486f-93c7-3589ab5c5296",
        "entitlementId": "e21f9a04-7c55-4f0b-9a1e-3d6b8c2f5471",
        "name": "ERP Payables Read",
        "applicationName": "Oracle ERP",
        "accountName": "asmith",
        "itemType": "ENTITLEMENT",
        "risk": "HIGH",
        "privileged": false,
        "requiresTraining": true,
        "startDate": "2026-09-21T00:00:00+05:30",
        "endDate": "2026-12-31T23:59:00+05:30",
        "decision": {
          "action": "APPROVE",
          "comments": "Access aligns with user's role.",
          "actedBy": { "userId": "f558e3b2-348b-4ff3-be4c-a3c5dc8b5a91", "displayName": "Jane Roe" },
          "actedAt": "2026-09-15T08:11:00+05:30"
        },
        "sod": { "hasConflict": true, "severity": "HIGH", "policyId": "SOD-014", "policyName": "Payables vs Payments", "businessProcess": "Procure to Pay", "owner": "Jane Roe", "description": "Cannot hold both entry and release rights.", "conflictsWith": [] },
        "aiRecommendation": {
          "beneficiaryAnalysis": "User's peers in IT hold this entitlement.",
          "contextualRisk": "Elevated — financial data access.",
          "riskSensitivityAnalysis": "High sensitivity; SOX in scope.",
          "peerAnalysis": "8 of 12 peers hold this."
        }
      }
    ],
    "steps": [
      {
        "stepId": "9001",
        "templateStepId": 1,
        "stepCode": "MANAGER_APPROVAL",
        "label": "Assigned to User Manager",
        "status": "COMPLETED",
        "actor": { "userId": "f558e3b2-348b-4ff3-be4c-a3c5dc8b5a91", "displayName": "Jane Roe" },
        "actedAt": "2026-09-15T08:11:00+05:30",
        "comment": "Approved — valid business need."
      }
    ]
  }
}
```

### 6b. Submit action (approve / reject / request info)

`POST /workflow/api/v1/{tenant}/approvals/{taskId}/actions`

**Request**

```json
{
  "overallAction": "APPROVE",
  "comments": "",
  "items": [
    {
      "requestedItemId": "5581",
      "catalogId": "b73ac8d7-f4cd-486f-93c7-3589ab5c5296",
      "action": "APPROVE",
      "comments": "Access aligns with user's role and department functions."
    },
    {
      "requestedItemId": "5582",
      "catalogId": "c41d9f22-8a7b-4c33-91e5-6f2a0b4d7e19",
      "action": "REQUEST_INFO",
      "comments": "Please confirm which cost center this is billed to."
    }
  ]
}
```

`action` values: `APPROVE` | `REJECT` | `REQUEST_INFO`. Omit `overallAction` when only some items are actioned.

**Response — 200**

```json
{
  "data": {
    "taskId": "7781",
    "taskStatus": "COMPLETED",
    "requestStatus": "APPROVED",
    "items": [
      { "requestedItemId": "5581", "action": "APPROVE", "status": "APPROVED" },
      { "requestedItemId": "5582", "action": "REQUEST_INFO", "status": "INFO_REQUESTED" }
    ],
    "nextStep": { "stepCode": "PROVISION_SCIM", "assignee": null }
  }
}
```
