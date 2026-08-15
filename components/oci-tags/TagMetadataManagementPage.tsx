"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tags,
  TrendingUp,
  User,
} from "lucide-react";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import { ActionCompletedToast } from "@/components/ActionCompletedToast";

type Risk = "low" | "medium" | "high" | "critical";
type Classification = "public" | "internal" | "confidential" | "restricted";
type Status = "approved" | "review" | "suggested";
type Source = "ai" | "customer";

interface TagMeta {
  ns: string;
  key: string;
  desc: string;
  risk: Risk;
  cls: Classification;
  comp: string[];
  src: Source;
  status: Status;
}

const RISK_LABEL: Record<Risk, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
const RISK_DOT: Record<Risk, string> = { low: "bg-green-500", medium: "bg-amber-500", high: "bg-red-500", critical: "bg-red-800" };
const RISK_BADGE: Record<Risk, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-700",
  critical: "bg-red-200 text-red-900",
};
const RISK_LEVELS: Risk[] = ["critical", "high", "medium", "low"];

const CLS_LABEL: Record<Classification, string> = {
  public: "Public",
  internal: "Internal",
  confidential: "Confidential",
  restricted: "Restricted",
};
const CLS_DOT: Record<Classification, string> = {
  public: "bg-green-500",
  internal: "bg-amber-500",
  confidential: "bg-orange-500",
  restricted: "bg-red-700",
};
const CLS_HINT: Record<Classification, string> = {
  public: "No restriction",
  internal: "Employees only",
  confidential: "Need-to-know",
  restricted: "PII · regulated",
};
const CLASSIFICATIONS: Classification[] = ["public", "internal", "confidential", "restricted"];

const COMPLIANCE_OPTIONS = ["SOX", "PCI-DSS", "HIPAA", "GDPR", "SOC 2", "CIS", "ISO 27001", "FedRAMP"];
const NAMESPACES = ["DataGovernance", "Security", "Finance", "Operations"];

const FILTER_CONTROL =
  "h-[38px] w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";
const TH =
  "whitespace-nowrap px-3 py-3.5 text-left text-[11px] font-semibold text-blue-800 uppercase tracking-wide align-middle bg-blue-50/80 border-b border-blue-100";
const TD = "px-3 py-3 align-top text-sm leading-snug text-gray-800 bg-white";

const INITIAL_TAGS: TagMeta[] = [
  { ns: "DataGovernance", key: "PII", desc: "Marks resources storing personally identifiable information.", risk: "high", cls: "restricted", comp: ["GDPR", "HIPAA"], src: "ai", status: "review" },
  { ns: "Finance", key: "SOXScope", desc: "In-scope for SOX financial-reporting controls.", risk: "high", cls: "confidential", comp: ["SOX", "SOC 2"], src: "customer", status: "approved" },
  { ns: "Security", key: "NetworkZone", desc: "Network trust zone for a resource (DMZ, internal, restricted).", risk: "high", cls: "confidential", comp: ["CIS", "PCI-DSS"], src: "ai", status: "suggested" },
  { ns: "DataGovernance", key: "Classification", desc: "Baseline data sensitivity for the resource.", risk: "medium", cls: "confidential", comp: ["GDPR", "SOC 2"], src: "customer", status: "approved" },
  { ns: "Security", key: "Encryption", desc: "Encryption requirement (CMK, platform, none).", risk: "medium", cls: "confidential", comp: ["PCI-DSS"], src: "ai", status: "review" },
  { ns: "Security", key: "Exposure", desc: "Public reachability of the resource.", risk: "critical", cls: "restricted", comp: ["CIS", "SOC 2"], src: "ai", status: "suggested" },
  { ns: "DataGovernance", key: "Retention", desc: "Data retention window in days.", risk: "medium", cls: "internal", comp: ["GDPR"], src: "customer", status: "approved" },
  { ns: "FinOps", key: "CostCenter", desc: "Chargeback owner for the resource.", risk: "low", cls: "internal", comp: ["SOX"], src: "customer", status: "approved" },
  { ns: "Operations", key: "Environment", desc: "Lifecycle environment (prod, stage, dev).", risk: "low", cls: "internal", comp: [], src: "customer", status: "approved" },
  { ns: "Security", key: "PrivilegedAccess", desc: "Flags resources reachable by privileged principals.", risk: "critical", cls: "restricted", comp: ["CIS", "SOC 2", "ISO 27001"], src: "ai", status: "suggested" },
];

function SummaryStatBox({
  label,
  value,
  delta,
  deltaClass = "text-gray-500",
}: {
  label: string;
  value: string;
  delta: React.ReactNode;
  deltaClass?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="mb-1 text-xs leading-snug text-gray-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
      <p className={`mt-1 flex items-center gap-1 text-xs ${deltaClass}`}>{delta}</p>
    </div>
  );
}

function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${RISK_BADGE[risk]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${RISK_DOT[risk]}`} />
      {RISK_LABEL[risk]}
    </span>
  );
}

function ClassificationCell({ cls }: { cls: Classification }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-800">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${CLS_DOT[cls]}`} />
      {CLS_LABEL[cls]}
    </span>
  );
}

function ComplianceCell({ comp }: { comp: string[] }) {
  if (!comp.length) {
    return <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">Unmapped</span>;
  }
  return (
    <div className="flex max-w-[200px] flex-wrap gap-1.5">
      {comp.map((c) => (
        <span key={c} className="rounded-md bg-blue-50 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
          {c}
        </span>
      ))}
    </div>
  );
}

function SourceCell({ src }: { src: Source }) {
  if (src === "ai") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600">
        <Bot className="h-3.5 w-3.5" aria-hidden />
        KeyForge
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <User className="h-3.5 w-3.5" aria-hidden />
      Customer
    </span>
  );
}

const STATUS_STYLE: Record<Status, { cls: string; label: string }> = {
  approved: { cls: "bg-green-100 text-green-800", label: "Approved" },
  review: { cls: "bg-amber-100 text-amber-800", label: "In review" },
  suggested: { cls: "bg-blue-100 text-blue-800", label: "Suggested" },
};

function StatusPill({ status }: { status: Status }) {
  const s = STATUS_STYLE[status];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

interface Suggestion {
  risk: Risk;
  cls: Classification;
  comp: string[];
}

interface MetadataFormState {
  eyebrow: string;
  title: string;
  reasonText: React.ReactNode;
  suggestion: Suggestion | null;
  risk: Risk | null;
  cls: Classification | null;
  comp: string[];
  note: string;
}

function MetadataDrawerContent({
  form,
  onChange,
  onApplySuggestion,
  onSubmit,
  onCancel,
}: {
  form: MetadataFormState;
  onChange: (next: Partial<MetadataFormState>) => void;
  onApplySuggestion: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const toggleComp = (c: string) => {
    onChange({ comp: form.comp.includes(c) ? form.comp.filter((x) => x !== c) : [...form.comp, c] });
  };

  return (
    <div className="flex flex-col gap-5 text-gray-900">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{form.eyebrow}</p>
        <p className="mt-1 font-mono text-base font-semibold text-gray-900">{form.title}</p>
      </div>

      {/* KeyForge reasoning callout */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-600">
            <Sparkles className="h-3.5 w-3.5 text-white" aria-hidden />
          </span>
          <b className="text-sm text-blue-900">KeyForge suggestion</b>
          <span className="ml-auto rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700">
            92% confidence
          </span>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-blue-900">{form.reasonText}</p>
        <button
          type="button"
          onClick={onApplySuggestion}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          Apply suggestion
        </button>
      </div>

      {/* Risk level */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-900">
          Risk level <span className="font-normal text-gray-500">— how much exposure this tag implies</span>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {RISK_LEVELS.slice().reverse().map((r) => {
            const on = form.risk === r;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ risk: r })}
                className={`flex flex-col items-center gap-1.5 rounded-md border px-1 py-2.5 text-xs font-semibold transition-colors ${
                  on ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${RISK_DOT[r]}`} />
                {RISK_LABEL[r]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Classification */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-900">Data classification</label>
        <div className="flex flex-col gap-2">
          {CLASSIFICATIONS.map((c) => {
            const on = form.cls === c;
            return (
              <label
                key={c}
                className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 transition-colors ${
                  on ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input type="radio" name="cls" checked={on} onChange={() => onChange({ cls: c })} className="accent-blue-600" />
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${CLS_DOT[c]}`} />
                <span className="text-sm font-medium text-gray-800">{CLS_LABEL[c]}</span>
                <span className="ml-auto text-xs text-gray-500">{CLS_HINT[c]}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Compliance */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-900">
          Compliance scope <span className="font-normal text-gray-500">— frameworks this tag falls under</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {COMPLIANCE_OPTIONS.map((c) => {
            const on = form.comp.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => toggleComp(c)}
                className={`rounded-md border px-2.5 py-1.5 font-mono text-xs font-semibold transition-colors ${
                  on ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Justification */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-900">
          Justification <span className="font-normal text-gray-500">— attached to the suggestion for review</span>
        </label>
        <textarea
          value={form.note}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Why these values? Reference the resources or controls this reflects…"
          className="min-h-[78px] w-full rounded-md border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-gray-200 bg-white px-4 pb-1 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Submit for review
        </button>
      </div>
    </div>
  );
}

export default function TagMetadataManagementPage() {
  const [tags] = useState<TagMeta[]>(INITIAL_TAGS);
  const [query, setQuery] = useState("");
  const [ns, setNs] = useState("");
  const [activeRisks, setActiveRisks] = useState<Set<Risk>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { openSidebar, closeSidebar } = useRightSidebar();
  const [form, setForm] = useState<MetadataFormState | null>(null);

  const filteredTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tags.filter((t) => {
      const hay = `${t.ns}.${t.key} ${t.desc} ${t.comp.join(" ")}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (ns && t.ns !== ns) return false;
      if (activeRisks.size && !activeRisks.has(t.risk)) return false;
      return true;
    });
  }, [tags, query, ns, activeRisks]);

  const toggleRisk = (risk: Risk) => {
    setActiveRisks((prev) => {
      const next = new Set(prev);
      if (next.has(risk)) next.delete(risk);
      else next.add(risk);
      return next;
    });
  };

  const buildForm = (index: number | "new"): MetadataFormState => {
    if (index === "new") {
      return {
        eyebrow: "Suggest metadata",
        title: "New tag metadata",
        reasonText:
          "Pick a tag to evaluate, or enter values directly. KeyForge will score the suggestion against attached resources and policy references before review.",
        suggestion: { risk: "medium", cls: "internal", comp: ["SOC 2"] },
        risk: null,
        cls: null,
        comp: [],
        note: "",
      };
    }

    const t = tags[index];
    const suggestion: Suggestion = {
      risk: t.risk === "low" ? "medium" : t.risk,
      cls: t.cls,
      comp: t.comp.length ? t.comp : ["SOC 2"],
    };
    return {
      eyebrow: "Edit metadata",
      title: `${t.ns}.${t.key}`,
      reasonText: (
        <>
          Attached to resources matching{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-blue-700">
            {t.ns}.{t.key}
          </code>{" "}
          and referenced by policy controls. KeyForge suggests <b>{RISK_LABEL[suggestion.risk]} risk</b>,{" "}
          <b>{CLS_LABEL[suggestion.cls]}</b> classification, and <b>{suggestion.comp.join(" + ")}</b> scope.
        </>
      ),
      suggestion,
      risk: t.risk,
      cls: t.cls,
      comp: t.comp,
      note: "",
    };
  };

  const openMetadataDrawer = (index: number | "new") => {
    setForm(buildForm(index));
  };

  useEffect(() => {
    if (!form) return;

    const handleChange = (next: Partial<MetadataFormState>) => setForm((prev) => (prev ? { ...prev, ...next } : prev));
    const handleApply = () =>
      setForm((prev) => {
        if (!prev?.suggestion) return prev;
        setToastMessage("KeyForge values applied — review and submit");
        return { ...prev, risk: prev.suggestion.risk, cls: prev.suggestion.cls, comp: prev.suggestion.comp };
      });
    const handleSubmit = () => {
      closeSidebar();
      setForm(null);
      setToastMessage("Suggestion submitted for review");
    };
    const handleCancel = () => {
      closeSidebar();
      setForm(null);
    };

    openSidebar(
      <MetadataDrawerContent
        form={form}
        onChange={handleChange}
        onApplySuggestion={handleApply}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />,
      { widthPx: 460, title: form.eyebrow }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="shrink-0 rounded-lg bg-blue-50 p-2.5 text-blue-600">
            <Tags className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">Tag Metadata Management</h1>
            <p className="mt-1 max-w-[62ch] text-sm text-gray-500">
              Assign risk, data classification, and compliance scope to your tags. KeyForge suggests values from
              attached resources and policy references; you confirm, adjust, or propose your own.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openMetadataDrawer("new")}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Suggest metadata
        </button>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStatBox
          label="Tag keys governed"
          value="42"
          deltaClass="text-green-600"
          delta={
            <>
              <TrendingUp className="h-3 w-3" aria-hidden />6 added this week
            </>
          }
        />
        <SummaryStatBox
          label="High & critical risk"
          value="11"
          deltaClass="text-red-600"
          delta={
            <>
              <AlertTriangle className="h-3 w-3" aria-hidden />4 unreviewed
            </>
          }
        />
        <SummaryStatBox label="Pending suggestions" value="5" delta="From KeyForge & team" />
        <SummaryStatBox
          label="Compliance-mapped"
          value="78%"
          deltaClass="text-green-600"
          delta={
            <>
              <TrendingUp className="h-3 w-3" aria-hidden />
              +9% this month
            </>
          }
        />
      </div>

      {/* Table panel */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 p-3">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tags…"
              className={`${FILTER_CONTROL} pl-9 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              aria-label="Search tags"
            />
          </div>
          <select
            value={ns}
            onChange={(e) => setNs(e.target.value)}
            className="h-[38px] w-44 shrink-0 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
          >
            <option value="">All namespaces</option>
            {NAMESPACES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Filter by risk">
            {RISK_LEVELS.map((r) => {
              const on = activeRisks.has(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleRisk(r)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    on ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${RISK_DOT[r]}`} />
                  {RISK_LABEL[r]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                <th scope="col" className={TH}>Tag</th>
                <th scope="col" className={TH}>Risk</th>
                <th scope="col" className={TH}>Classification</th>
                <th scope="col" className={`${TH} hidden md:table-cell`}>Compliance</th>
                <th scope="col" className={`${TH} hidden md:table-cell`}>Source</th>
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={TH} aria-label="Edit" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTags.map((t) => {
                const originalIndex = tags.indexOf(t);
                return (
                  <tr key={`${t.ns}.${t.key}`} className="hover:bg-gray-50">
                    <td className={TD}>
                      <div>
                        <span className="font-mono text-[11.5px] text-gray-500">{t.ns}.</span>
                        <span className="font-mono text-sm font-semibold text-gray-900">{t.key}</span>
                      </div>
                      <div className="mt-0.5 max-w-[34ch] text-xs text-gray-500">{t.desc}</div>
                    </td>
                    <td className={TD}>
                      <RiskBadge risk={t.risk} />
                    </td>
                    <td className={TD}>
                      <ClassificationCell cls={t.cls} />
                    </td>
                    <td className={`${TD} hidden md:table-cell`}>
                      <ComplianceCell comp={t.comp} />
                    </td>
                    <td className={`${TD} hidden md:table-cell`}>
                      <SourceCell src={t.src} />
                    </td>
                    <td className={TD}>
                      <StatusPill status={t.status} />
                    </td>
                    <td className={TD}>
                      <button
                        type="button"
                        aria-label={`Edit ${t.ns}.${t.key}`}
                        onClick={() => openMetadataDrawer(originalIndex)}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 hover:border-blue-400 hover:text-blue-600"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredTags.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                    No tags match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Showing <b className="text-gray-800">{filteredTags.length}</b> of {tags.length} tag keys ·{" "}
        <span className="text-blue-600">KeyForge re-evaluates suggestions nightly as resource attachments change.</span>
      </p>

      <ActionCompletedToast
        isVisible={toastMessage !== null}
        message={toastMessage ?? undefined}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
}
