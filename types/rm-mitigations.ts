export type MitigationListRow = {
  mitigation_id: number;
  mitigation_code: string;
  mitigation_name: string;
  description?: string | null;
  control_type: string;
  control_frequency: string;
  status: string;
};

export type UpsertMitigationInput = {
  mitigation_code: string;
  mitigation_name: string;
  description: string;
  control_type: string;
  control_frequency: string;
};
