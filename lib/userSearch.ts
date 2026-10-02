import { executeQuery } from "@/lib/api";

// User search helpers over the `usr` table (via executeQuery), shared by the
// User Group wizard and the user picker modal.

export interface User {
  userId?: string;
  name: string;
  email: string;
  username?: string;
  employeeId?: string;
  title?: string;
  department?: string;
}

export const userSearchOptions = [
  { label: "Name", value: "name" },
  { label: "Email", value: "email" },
  { label: "Username", value: "username" },
  { label: "Employee ID", value: "employee_id" },
  { label: "Department", value: "department" },
  { label: "Job Title", value: "job_title" },
];

// SQL condition per search criterion; each "?" is bound to the same %term%
const searchConditions: Record<string, string> = {
  name: "(displayname ILIKE ? OR firstname ILIKE ? OR lastname ILIKE ? OR concat_ws(' ', firstname, lastname) ILIKE ?)",
  email: "email::text ILIKE ?",
  username: "username ILIKE ?",
  employee_id: "employeeid::text ILIKE ?",
  department: "department ILIKE ?",
  job_title: "title ILIKE ?",
};

export type UserFilter = { where: string; params: string[] };

export function buildUserSearchFilter(criteria: string, value: string): UserFilter {
  const condition = searchConditions[criteria] ?? searchConditions.name;
  const term = `%${value.trim()}%`;
  const params = Array((condition.match(/\?/g) || []).length).fill(term);
  return { where: ` WHERE ${condition}`, params };
}

export function mapUser(user: any): User {
  let email = "";
  if (typeof user.email === "string") {
    email = user.email;
  } else if (user.email?.work) {
    email = user.email.work;
  } else if (Array.isArray(user.email) && user.email.length > 0) {
    email = (user.email.find((e: any) => e.primary) || user.email[0])?.value || "";
  }
  email = email || user.customattributes?.emails?.[0]?.value || user.username || "";

  return {
    name:
      user.displayname ||
      user.displayName ||
      [user.firstname, user.lastname].filter(Boolean).join(" ").trim() ||
      user.username ||
      "Unknown",
    email,
    userId: user.userid != null ? String(user.userid) : user.userId != null ? String(user.userId) : "",
    username: user.username || "",
    employeeId: user.employeeid != null ? String(user.employeeid) : "",
    title: user.title || user.customattributes?.title || "",
    department: user.department || user.customattributes?.enterpriseUser?.department || "",
  };
}

function rowsOf(response: any): any[] {
  return Array.isArray(response?.resultSet) ? response.resultSet : Array.isArray(response) ? response : [];
}

/** One page of users matching `filter`, plus the total match count. */
export async function fetchUserPage(
  filter: UserFilter,
  page: number,
  pageSize: number
): Promise<{ users: User[]; total: number }> {
  const [dataResponse, countResponse]: any[] = await Promise.all([
    executeQuery(`SELECT * FROM usr${filter.where} ORDER BY username LIMIT ? OFFSET ?`, [
      ...filter.params,
      pageSize,
      (page - 1) * pageSize,
    ]),
    executeQuery(`SELECT COUNT(*) as count FROM usr${filter.where}`, filter.params),
  ]);
  const users = rowsOf(dataResponse).map(mapUser).filter((u) => u.email);
  const countRow = rowsOf(countResponse)[0];
  const total = Number(countRow?.count ?? countRow?.COUNT ?? users.length) || 0;
  return { users, total };
}

export async function fetchUsersByIds(ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const response: any = await executeQuery(`SELECT * FROM usr WHERE userid::text IN (${placeholders})`, ids);
  return rowsOf(response).map(mapUser).filter((u) => u.email);
}
