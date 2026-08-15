export type EventDomain = "User" | "Application" | "Account";
export type EventAction = "Assurance Event" | "Access Review";
export type EventStatus = "Active" | "Draft" | "Disabled";
export type EventFrequency = "Daily" | "Weekly" | "Event-based";

export type EventDefinition = {
  id: string;
  name: string;
  domain: EventDomain;
  subtype: string;
  condition: string;
  scope: string;
  slaDays: number;
  frequency: EventFrequency;
  owner: string;
  status: EventStatus;
  action: EventAction;
};

export const INITIAL_EVENT_DEFINITIONS: EventDefinition[] = [
  {
    id: "CCE-1001",
    name: "Missing Entitlement Description",
    domain: "Application",
    subtype: "Entitlement Description",
    condition: "Missing",
    scope: "All Applications",
    slaDays: 5,
    frequency: "Daily",
    owner: "Priya Nair",
    status: "Active",
    action: "Assurance Event",
  },
  {
    id: "CCE-1002",
    name: "Account Inactive for more than 90 days",
    domain: "Account",
    subtype: "Inactive Account",
    condition: "more than 90 days",
    scope: "All Accounts",
    slaDays: 10,
    frequency: "Daily",
    owner: "Jessica Camacho",
    status: "Active",
    action: "Access Review",
  },
  {
    id: "CCE-1003",
    name: "User Role Change",
    domain: "User",
    subtype: "Role",
    condition: "Change",
    scope: "All Users",
    slaDays: 3,
    frequency: "Event-based",
    owner: "Daniel Kim",
    status: "Active",
    action: "Access Review",
  },
  {
    id: "CCE-1004",
    name: "Manager Change",
    domain: "User",
    subtype: "Manager",
    condition: "Change",
    scope: "All Users",
    slaDays: 10,
    frequency: "Event-based",
    owner: "Maria Gonzalez",
    status: "Active",
    action: "Access Review",
  },
  {
    id: "CCE-1005",
    name: "Inactive Entitlement Owner",
    domain: "Application",
    subtype: "Entitlement Owner",
    condition: "Missing",
    scope: "All Applications",
    slaDays: 10,
    frequency: "Daily",
    owner: "Tushar Rao",
    status: "Active",
    action: "Access Review",
  },
  {
    id: "CCE-1006",
    name: "Newly Discovered Entitlement event",
    domain: "Application",
    subtype: "Entitlement",
    condition: "Discovered",
    scope: "All Applications",
    slaDays: 7,
    frequency: "Daily",
    owner: "Evan Brooks",
    status: "Active",
    action: "Access Review",
  },
  {
    id: "CCE-1007",
    name: "Orphan Account Detected",
    domain: "Account",
    subtype: "Orphan A/c",
    condition: "Detected",
    scope: "All Accounts",
    slaDays: 1,
    frequency: "Daily",
    owner: "Marcus Webb",
    status: "Active",
    action: "Assurance Event",
  },
  {
    id: "CCE-1008",
    name: "Owner missing Service A/c",
    domain: "Account",
    subtype: "Service A/c",
    condition: "Owner missing",
    scope: "All Accounts",
    slaDays: 7,
    frequency: "Daily",
    owner: "Priya Nair",
    status: "Active",
    action: "Assurance Event",
  },
  {
    id: "CCE-1009",
    name: "Training Code Missing",
    domain: "Application",
    subtype: "Training Code",
    condition: "Missing",
    scope: "SOX applications",
    slaDays: 6,
    frequency: "Weekly",
    owner: "Liam O'Connor",
    status: "Active",
    action: "Assurance Event",
  },
];
