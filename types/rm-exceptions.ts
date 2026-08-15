export type ExceptionListRow = {
  exception_id: number;
  violation_id: number;
  requested_by?: string | null;
  requested_by_name?: string | null;
  exception_status: string;
  effective_from?: string | null;
  effective_to?: string | null;
};
