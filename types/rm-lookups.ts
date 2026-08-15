/** One lookup value row (admin / full). */
export type Lookup = {
  lookup_value_id: number;
  value_code: string;
  value_name: string;
  description?: string | null;
  sort_order?: number;
  numeric_meta?: number | null;
  color_hex?: string | null;
  icon?: string | null;
  is_default?: boolean;
  is_system?: boolean;
};

/** One lookup type/category in the type picker. */
export type LookupType = {
  type_code: string;
  type_name: string;
  description?: string | null;
  value_count?: number;
  is_system?: boolean;
  allow_user_add?: boolean;
  allow_user_edit?: boolean;
};

export type UpsertLookupValueInput = {
  type_code: string;
  value_code: string;
  value_name: string;
  description?: string | null;
  sort_order?: number;
  numeric_meta?: number | null;
  color_hex?: string | null;
  icon?: string | null;
  attributes?: Record<string, unknown>;
  is_default?: boolean;
  /** Set when editing an existing row, if the API supports it. */
  lookup_value_id?: number;
};
