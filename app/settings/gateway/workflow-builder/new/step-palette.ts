/** Shared with Advanced Policy Builder palette and Guided “Add step” menus. */

export type StepPaletteEntry = {
  id: string;
  label: string;
  kind: "SYSTEM" | "HUMAN" | "AI";
  type: "LOGIC" | "APPROVAL" | "FULFILLMENT" | "AI AGENT" | "CUSTOM";
};

export const STEP_PALETTE: {
  LOGIC: StepPaletteEntry[];
  APPROVALS: StepPaletteEntry[];
  FULFILLMENT: StepPaletteEntry[];
  AI_AGENTS: StepPaletteEntry[];
} = {
  LOGIC: [
    { id: "user-enabled-check", label: "User Enabled Check", kind: "SYSTEM", type: "LOGIC" },
    { id: "sod-analysis", label: "SoD Analysis", kind: "SYSTEM", type: "LOGIC" },
    { id: "training-check", label: "Training Check", kind: "SYSTEM", type: "LOGIC" },
  ],
  APPROVALS: [
    { id: "manager-approval", label: "Manager Approval", kind: "HUMAN", type: "APPROVAL" },
    { id: "dept-head-approval", label: "Dept Head Approval", kind: "HUMAN", type: "APPROVAL" },
    { id: "app-owner-approval", label: "App Owner Approval", kind: "HUMAN", type: "APPROVAL" },
    { id: "role-owner-approval", label: "Role Owner Approval", kind: "HUMAN", type: "APPROVAL" },
  ],
  FULFILLMENT: [
    { id: "scim-fulfillment", label: "SCIM Fulfillment", kind: "SYSTEM", type: "FULFILLMENT" },
    { id: "itsm-ticket", label: "ITSM Ticket", kind: "SYSTEM", type: "FULFILLMENT" },
  ],
  AI_AGENTS: [
    { id: "ai-auto-approve", label: "AI Auto-Approve Analysis", kind: "AI", type: "AI AGENT" },
    { id: "ai-recommender", label: "AI Recommender", kind: "AI", type: "AI AGENT" },
  ],
};
