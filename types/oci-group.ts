export interface OciGroup {
  id: string;
  name: string;
  description?: string;
}

export interface OciGroupsResult {
  groups: OciGroup[];
}

export interface OciGroupAccessSummary {
  id: string;
  name: string;
  description?: string;
  status?: string;
  createdOn?: string | null;
  createdBy?: string;
  memberCount: number;
  statementCount: number;
  resourceCount: number;
}

export interface OciGroupMember {
  id: string;
  name: string;
  email?: string;
  type?: string;
  mfa?: string;
  status?: string;
}

export interface OciGroupStatement {
  id: string;
  policyName?: string;
  statement?: string;
  verb?: string;
  resource?: string;
  compartment?: string;
  condition?: string;
}

export interface OciGroupResource {
  id: string;
  name: string;
  resourceType?: string;
  compartment?: string;
  lifecycleState?: string;
}

export interface OciGroupAccessDetail extends OciGroupAccessSummary {
  members: OciGroupMember[];
  statements: OciGroupStatement[];
  resources: OciGroupResource[];
}

export interface OciGroupAccessListResult {
  groups: OciGroupAccessSummary[];
}
