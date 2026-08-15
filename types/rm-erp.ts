export type ErpInstance = {
  erp_instance_id: number;
  instance_code: string;
  instance_name: string;
  system_type: string;
  system_type_name?: string | null;
  /** Hex for {@link Badge} */
  system_color?: string | null;
  environment: string;
  endpoint_url?: string | null;
  status: string;
};

export type ExtractTemplate = {
  extract_id: number;
  artifact_code: string;
  artifact_name?: string | null;
  source_kind: string;
  landing_table?: string | null;
  description?: string | null;
};

export type UpsertErpInstanceInput = {
  instance_code: string;
  instance_name: string;
  system_type: string;
  environment: string;
  endpoint_url: string;
  auth_type: string;
};
