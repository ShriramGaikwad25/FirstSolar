/** Legacy Non-Human Identity-1 shell: full in-page nav and valid URL segments. */
export const NHI_LEGACY_NAV_ITEMS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/non-human-identity-1" },
  { label: "Agents", href: "/non-human-identity-1/agents" },
  { label: "NHIs", href: "/non-human-identity-1/nhis" },
  { label: "Service Accounts", href: "/non-human-identity-1/service-accounts" },
  { label: "RFC Calls", href: "/non-human-identity-1/rfc-calls" },
  { label: "Findings", href: "/non-human-identity-1/findings" },
  { label: "SoD", href: "/non-human-identity-1/sod" },
  { label: "Changes", href: "/non-human-identity-1/changes" },
  { label: "Reviews", href: "/non-human-identity-1/reviews" },
  { label: "Controls", href: "/non-human-identity-1/controls" },
  { label: "Emergency", href: "/non-human-identity/request-access" },
  { label: "Lineage", href: "/non-human-identity-1/lineage" },
];

const LEGACY_PREFIX = "/non-human-identity-1/";

export const NHI_LEGACY_SECTION_SLUGS = new Set(
  NHI_LEGACY_NAV_ITEMS.filter((i) => i.href.startsWith(LEGACY_PREFIX)).map((i) =>
    i.href.slice(LEGACY_PREFIX.length)
  )
);

/** Primary Non-Human Identity shell (streamlined nav). */
export const NHI_NAV_ITEMS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/non-human-identity" },
  { label: "AI Agent Inventory", href: "/non-human-identity/ai-agent-inventory" },
  { label: "NHI Inventory", href: "/non-human-identity/nhi-inventory" },
  { label: "Rotation Policy", href: "/non-human-identity/rotation-policy" },
  { label: "Risk & Remediation", href: "/non-human-identity/risk-remediation" },
  { label: "Controls", href: "/non-human-identity-1/controls" },
  { label: "Request Access/Breakglass", href: "/non-human-identity/request-access" },
];

/** Non-Human Identity-2 shell (sidebar + in-page horizontal nav). */
export const NHI_2_NAV_ITEMS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/non-human-identity-2" },
  { label: "My NHIs", href: "/non-human-identity-2/my-nhis" },
  { label: "Agents", href: "/non-human-identity-2/agents" },
  { label: "NHIs", href: "/non-human-identity-2/nhis" },
  { label: "Activity", href: "/non-human-identity-2/activity" },
  { label: "Governance", href: "/non-human-identity-2/governance" },
  { label: "Admin", href: "/non-human-identity-2/admin" },
];

const NHI_2_PREFIX = "/non-human-identity-2/";

export const NHI_2_SECTION_SLUGS = new Set(
  NHI_2_NAV_ITEMS.filter((i) => i.href.startsWith(NHI_2_PREFIX)).map((i) =>
    i.href.slice(NHI_2_PREFIX.length)
  )
);

/**
 * Previously used to detect a dedicated NHI layout (second sidebar). NHI now uses main nav sublinks only; kept so older imports of this helper still resolve.
 */
export function isNhiShellPath(_pathname: string | null): boolean {
  return false;
}

/** Full-width shell for Non Human Identity-2 pages (no max-w centering). */
export const NHI2_PAGE_SHELL_CLASS = "w-full min-w-0";
