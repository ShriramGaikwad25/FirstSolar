import {
  ModuleRegistry,
  AllEnterpriseModule,
  LicenseManager,
} from "ag-grid-enterprise";
import { provideGlobalGridOptions, type ITooltipParams } from "ag-grid-community";
ModuleRegistry.registerModules([AllEnterpriseModule]);

/** Every cell shows its (formatted) value on hover; a column's own tooltipField still wins */
function cellValueTooltip(p: ITooltipParams): string | undefined {
  const field = p.colDef && "tooltipField" in p.colDef ? p.colDef.tooltipField : undefined;
  const raw = field ? (p.data as any)?.[field] : p.valueFormatted ?? p.value;
  if (raw == null || raw === "") return undefined;
  if (Array.isArray(raw)) {
    const parts = raw.filter((v) => v != null && typeof v !== "object");
    return parts.length ? parts.join(", ") : undefined;
  }
  if (typeof raw === "object") return undefined;
  return String(raw);
}

// AG Grid 36 made the pagination page number an editable input; keep the read-only
// "Page 1 of N" the app had before. Grids can still override paginationPanels.
// "deep" so a grid's own defaultColDef is merged with these defaults instead of replacing them
// (arrays such as paginationPanels are still replaced, not merged).
provideGlobalGridOptions(
  {
    paginationPanels: ["pageSize", "rowSummary", { type: "pageSummary", suppressPageInput: true }],
    tooltipShowDelay: 300,
    defaultColDef: { tooltipValueGetter: cellValueTooltip },
  },
  "deep"
);
LicenseManager.setLicenseKey("Using_this_{AG_Grid}_Enterprise_key_{AG-104383}_in_excess_of_the_licence_granted_is_not_permitted___Please_report_misuse_to_legal@ag-grid.com___For_help_with_changing_this_key_please_contact_info@ag-grid.com___{KeyForge_llc}_is_granted_a_{Single_Application}_Developer_License_for_the_application_{KeyForge_ISPM}_only_for_{1}_Front-End_JavaScript_developer___All_Front-End_JavaScript_developers_working_on_{KeyForge_ISPM}_need_to_be_licensed___{KeyForge_ISPM}_has_not_been_granted_a_Deployment_License_Add-on___This_key_works_with_{AG_Grid}_Enterprise_versions_released_before_{1_October_2026}____[v3]_[01]_MTc5MDgwOTIwMDAwMA==0b69f6263fac7794744c4ab7c7fde284");
