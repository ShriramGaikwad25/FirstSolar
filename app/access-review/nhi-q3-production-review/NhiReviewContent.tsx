"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Eye, Search } from "lucide-react";
import AgGridReact from "@/components/ClientOnlyAgGrid";
import "@/lib/ag-grid-setup";
import { defaultColDef } from "@/components/dashboard/columnDefs";
import { ColDef, ICellRendererParams } from "ag-grid-enterprise";
import { themeQuartz } from "ag-grid-community";
import "../AccessReview.css";
import "./nhi-review.css";
import service_account from "./data/service_account.json";
import api_token from "./data/api_token.json";
import certificate from "./data/certificate.json";
import ai_agent from "./data/ai_agent.json";

const sampleData = {
  service_account,
  api_token,
  certificate,
  ai_agent,
};

export type NhiTypeKey = keyof typeof sampleData;

const NHI_ROW_ORDER: NhiTypeKey[] = [
  "service_account",
  "api_token",
  "certificate",
  "ai_agent",
];

const NHI_CAMPAIGN_NAME =
  "Access Review Campaign: Q3 NHI Production Access Review";

const NHI_DETAIL_QUERY = "v";

function isNhiTypeKey(value: string | null): value is NhiTypeKey {
  return (
    value === "service_account" ||
    value === "api_token" ||
    value === "certificate" ||
    value === "ai_agent"
  );
}

type RowData = (typeof sampleData)[NhiTypeKey];

function getListRow(key: NhiTypeKey) {
  const d = sampleData[key];
  return {
    key,
    identityName: d.identityHeader.Name,
    typeLabel: d.typeLabel,
    identityId: d.identityHeader["Identity ID"],
    environment: d.identityHeader.Environment,
    riskScore: d.risk.score,
    severity: d.risk.severity,
    lastReviewed: d.identityHeader["Last Reviewed"],
    primaryOwner: d.ownership["Primary Owner"],
    lastUsed: d.usage.lastUsed,
    frequency: d.usage.frequency,
  };
}

export type NhiListRow = ReturnType<typeof getListRow>;

function SeverityCell(params: ICellRendererParams<NhiListRow>) {
  const s = params.value != null ? String(params.value) : "";
  const u = s.toLowerCase();
  let cls =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ";
  if (u === "critical") cls += "bg-red-900 text-red-100";
  else if (u === "high") cls += "bg-orange-100 text-orange-900 border border-orange-200";
  else cls += "bg-slate-100 text-slate-800 border border-slate-200";
  return <span className={cls}>{s}</span>;
}

function KVGrid({ data }: { data: Record<string, string> }) {
  return (
    <div className="nhi-kv">
      {Object.entries(data).map(([k, v]) => (
        <React.Fragment key={k}>
          <div className="nhi-k">{k}</div>
          <div className="nhi-v">{v != null && v !== "" ? String(v) : "-"}</div>
        </React.Fragment>
      ))}
    </div>
  );
}

function BadgesRow({ items }: { items: [string, string][] }) {
  return (
    <div className="nhi-badges">
      {items.map(([text, cls], i) => (
        <span key={`${text}-${i}`} className={`nhi-badge ${cls || ""}`}>
          {text}
        </span>
      ))}
    </div>
  );
}

function TypeCardsGrid({ cards }: { cards: RowData["typeCards"] }) {
  return (
    <div className="nhi-mini-grid">
      {cards.map((card) => (
        <div key={card.title} className="nhi-card nhi-type-card-nested">
          <div className="nhi-card-header">
            <h3 className="nhi-card-title">{card.title}</h3>
          </div>
          <div className="nhi-card-body">
            <KVGrid data={card.fields} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationsBlock({
  items,
}: {
  items: RowData["recommendations"];
}) {
  return (
    <div className="nhi-recommendations-row">
      {items.map((item) => (
        <div key={item.title} className="nhi-recommendation">
          <h4>{item.title}</h4>
          <p>{item.rationale}</p>
          <div className="nhi-rec-meta">
            {item.meta.map((m) => (
              <span key={m} className="nhi-pill">
                {m}
              </span>
            ))}
          </div>
          <button type="button" className="nhi-btn primary small">
            Accept
          </button>
        </div>
      ))}
    </div>
  );
}

type NhiReviewDetailProps = {
  typeKey: NhiTypeKey;
};

const NHI_DETAIL_SLIDES = [
  { label: "Identity & context", short: "Profile" },
  { label: "Access & evidence", short: "Access" },
  { label: "Risk & decision", short: "Risk" },
] as const;

function NhiReviewDetail({ typeKey }: NhiReviewDetailProps) {
  const d = useMemo(() => sampleData[typeKey], [typeKey]);
  const [slide, setSlide] = useState(0);
  const lastSlide = NHI_DETAIL_SLIDES.length - 1;

  useEffect(() => {
    setSlide(0);
  }, [typeKey]);

  return (
    <>
      <div className="nhi-section-slider">
        <div className="nhi-slider-controls">
          <button
            type="button"
            className="nhi-slider-nav-btn"
            aria-label="Previous section"
            disabled={slide === 0}
            onClick={() => setSlide((s) => Math.max(0, s - 1))}
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
          <div className="nhi-slider-tabs" role="tablist">
            {NHI_DETAIL_SLIDES.map((t, i) => (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={i === slide}
                className={
                  i === slide ? "nhi-slider-tab active" : "nhi-slider-tab"
                }
                onClick={() => setSlide(i)}
              >
                <span className="nhi-slider-tab-short">{t.short}</span>
                <span className="nhi-slider-tab-full">{t.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="nhi-slider-nav-btn"
            aria-label="Next section"
            disabled={slide === lastSlide}
            onClick={() => setSlide((s) => Math.min(lastSlide, s + 1))}
          >
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>
        <div className="nhi-slider-dots">
          {NHI_DETAIL_SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              className={
                i === slide ? "nhi-slider-dot active" : "nhi-slider-dot"
              }
              aria-label={`Open section ${i + 1}`}
              aria-current={i === slide}
              onClick={() => setSlide(i)}
            />
          ))}
        </div>
        <div className="nhi-slider-viewport">
          <div
            className="nhi-slider-track"
            style={{ transform: `translateX(-${slide * 100}%)` }}
          >
            <div className="nhi-slider-slide">
              <div className="nhi-slider-slide-card">
                <div className="nhi-column nhi-column--grid-2">
          <div className="nhi-card">
            <div className="nhi-card-header">
              <h3 className="nhi-card-title">Identity Header</h3>
              <button type="button" className="nhi-btn ghost small">
                Open Full Profile
              </button>
            </div>
            <div className="nhi-card-body">
              <KVGrid data={d.identityHeader} />
              <BadgesRow items={d.badges as [string, string][]} />
            </div>
          </div>

          <div className="nhi-card">
            <div className="nhi-card-header">
              <h3 className="nhi-card-title">Business / Technical Context</h3>
            </div>
            <div className="nhi-card-body">
              <KVGrid data={d.businessContext} />
            </div>
          </div>

          <div className="nhi-card">
            <div className="nhi-card-header">
              <h3 className="nhi-card-title">Ownership & Accountability</h3>
              <button type="button" className="nhi-btn ghost small">
                Reassign Owner
              </button>
            </div>
            <div className="nhi-card-body">
              <KVGrid data={d.ownership} />
            </div>
          </div>

          <div className="nhi-card">
            <div className="nhi-card-header">
              <h3 className="nhi-card-title">Auth / Credential / Trust Model</h3>
              <button type="button" className="nhi-btn ghost small">
                Launch Modernization
              </button>
            </div>
            <div className="nhi-card-body">
              <KVGrid data={d.auth} />
            </div>
          </div>
                </div>
              </div>
            </div>
            <div className="nhi-slider-slide">
              <div className="nhi-slider-slide-card">
                <div className="nhi-column nhi-column--grid-2">
          <div className="nhi-card">
            <div className="nhi-card-header">
              <h3 className="nhi-card-title">Effective Access / Capability Summary</h3>
            </div>
            <div className="nhi-card-body">
              <div className="nhi-plain-summary">{d.plainSummary}</div>
              <div style={{ height: 12 }} />
              <KVGrid data={d.accessSummary} />
            </div>
          </div>

          <div className="nhi-card">
            <div className="nhi-card-header">
              <h3 className="nhi-card-title">Usage & Activity Evidence</h3>
            </div>
            <div className="nhi-card-body">
              <div className="nhi-mini-grid">
                <div className="nhi-metric">
                  <div className="nhi-metric-label">Last Used</div>
                  <div className="nhi-metric-value">{d.usage.lastUsed}</div>
                </div>
                <div className="nhi-metric">
                  <div className="nhi-metric-label">Frequency</div>
                  <div className="nhi-metric-value">{d.usage.frequency}</div>
                </div>
              </div>
              <div style={{ marginTop: 12 }} className="nhi-section-note">
                30 / 60 / 90 day activity trend
              </div>
              <div className="nhi-chart" />
              <div style={{ height: 12 }} />
              <KVGrid data={d.usage.details} />
            </div>
          </div>

          <div className="nhi-card nhi-card--grid-span-full">
            <div className="nhi-card-header">
              <h3 className="nhi-card-title">Type-Specific Evidence</h3>
            </div>
            <div className="nhi-card-body">
              <TypeCardsGrid cards={d.typeCards} />
            </div>
          </div>

          <div className="nhi-card nhi-card--grid-span-full">
            <div className="nhi-card-header">
              <h3 className="nhi-card-title">Reviewer Prompts & System Guidance</h3>
            </div>
            <div className="nhi-card-body">
              <div className="nhi-mini-grid">
                <div>
                  <div className="nhi-section-note" style={{ marginBottom: 8 }}>
                    Reviewer prompts
                  </div>
                  <ul className="nhi-list">
                    {d.prompts.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="nhi-section-note" style={{ marginBottom: 8 }}>
                    System guidance
                  </div>
                  <ul className="nhi-list">
                    {d.guidance.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
                </div>
              </div>
            </div>
            <div className="nhi-slider-slide">
              <div className="nhi-slider-slide-card">
                <div className="nhi-column nhi-column--grid-2 nhi-column--risk-tab">
          <div className="nhi-card">
            <div className="nhi-card-header">
              <h3 className="nhi-card-title">Risk Summary</h3>
            </div>
            <div className="nhi-card-body">
              <div className="nhi-mini-grid">
                <div className="nhi-metric">
                  <div className="nhi-metric-label">Risk Score</div>
                  <div className="nhi-metric-value">{d.risk.score}</div>
                </div>
                <div className="nhi-metric">
                  <div className="nhi-metric-label">Severity</div>
                  <div className="nhi-metric-value">{d.risk.severity}</div>
                </div>
              </div>
              <div style={{ height: 12 }} />
              <div className="nhi-section-note">Top risk factors</div>
              <ul className="nhi-list">
                {d.risk.factors.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div style={{ height: 8 }} />
              <div className="nhi-section-note">{d.risk.confidence}</div>
            </div>
          </div>

          <div className="nhi-card">
            <div className="nhi-card-header">
              <h3 className="nhi-card-title">Recommendations</h3>
            </div>
            <div className="nhi-card-body">
              <RecommendationsBlock items={d.recommendations} />
            </div>
          </div>

          <div className="nhi-card">
            <div className="nhi-card-header">
              <h3 className="nhi-card-title">Follow-on Actions</h3>
            </div>
            <div className="nhi-card-body">
              <div className="nhi-checkbox-list">
                {[
                  "Create remediation task",
                  "Notify owner",
                  "Notify security",
                  "Trigger re-review in 30/60/90 days",
                  "Open ITSM / change ticket",
                  "Launch modernization workflow",
                  "Export evidence to audit",
                  "Escalate to specialist board/team",
                ].map((label) => (
                  <label key={label} className="nhi-checkbox-item">
                    <input type="checkbox" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="nhi-card">
            <div className="nhi-card-header">
              <h3 className="nhi-card-title">Decision</h3>
            </div>
            <div className="nhi-card-body">
              <div className="nhi-form-group">
                <label htmlFor="nhi-decision" className="nhi-label">
                  Decision
                </label>
                <select id="nhi-decision" className="nhi-select">
                  <option>Keep as-is</option>
                  <option>Keep but modify access</option>
                  <option>Keep but strengthen authentication or controls</option>
                  <option>Suspend pending validation</option>
                  <option>Retire</option>
                </select>
              </div>
              <div className="nhi-form-group">
                <label htmlFor="nhi-specific-action" className="nhi-label">
                  Specific Action
                </label>
                <select
                  id="nhi-specific-action"
                  key={typeKey}
                  className="nhi-select"
                  defaultValue={d.actions[0]}
                >
                  {d.actions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="nhi-form-group">
                <label htmlFor="nhi-reason" className="nhi-label">
                  Reason Code
                </label>
                <select id="nhi-reason" className="nhi-select">
                  <option>Still required</option>
                  <option>Access reduced</option>
                  <option>Controls strengthened</option>
                  <option>Ownership corrected</option>
                  <option>Dormant</option>
                  <option>Retired as no longer needed</option>
                </select>
              </div>
              <div className="nhi-form-group">
                <label htmlFor="nhi-comments" className="nhi-label">
                  Comments
                </label>
                <textarea
                  id="nhi-comments"
                  className="nhi-textarea"
                  placeholder="Reviewer comments"
                />
              </div>
              <div className="nhi-form-group">
                <label htmlFor="nhi-effective" className="nhi-label">
                  Effective Date
                </label>
                <input id="nhi-effective" type="date" className="nhi-input" />
              </div>
              <div className="nhi-form-group">
                <label htmlFor="nhi-escalation" className="nhi-label">
                  Escalation Target
                </label>
                <select id="nhi-escalation" className="nhi-select">
                  <option>Application Owner</option>
                  <option>Security Team</option>
                  <option>PKI Team</option>
                  <option>AI Governance Board</option>
                  <option>Platform Engineering</option>
                </select>
              </div>
            </div>
          </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="nhi-sticky-footer">
        <div className="nhi-section-note">
          Reusable NHI review template with type-specific evidence
        </div>
        <div className="nhi-footer-actions">
          <button type="button" className="nhi-btn primary">
            Approve
          </button>
          <button type="button" className="nhi-btn secondary">
            Approve with Changes
          </button>
          <button type="button" className="nhi-btn warning">
            Suspend
          </button>
          <button type="button" className="nhi-btn danger">
            Retire
          </button>
          <button type="button" className="nhi-btn secondary">
            Escalate
          </button>
          <button type="button" className="nhi-btn ghost">
            Save for Later
          </button>
        </div>
      </div>
    </>
  );
}

export default function NhiReviewContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");

  const detailKey = useMemo(() => {
    const v = searchParams.get(NHI_DETAIL_QUERY);
    return isNhiTypeKey(v) ? v : null;
  }, [searchParams]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("selectedCampaignSummary");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.campaignName === NHI_CAMPAIGN_NAME) {
        return;
      }
      const campaignSummary = {
        reviewerId: "",
        certificationId: "dummy-q3-nhi-production-access-review",
        campaignName: NHI_CAMPAIGN_NAME,
        status: "Active",
        snapshotAt: "2026-03-15",
        dueDate: "2026-09-30",
        progress: 14,
        totalItems: 84,
        approvedCount: 12,
        pendingCount: 72,
      };
      localStorage.setItem(
        "selectedCampaignSummary",
        JSON.stringify(campaignSummary)
      );
      window.dispatchEvent(
        new CustomEvent("progressDataChange", {
          detail: { total: 84, approved: 12, pending: 72, percentage: 14 },
        })
      );
      window.dispatchEvent(new Event("localStorageChange"));
    } catch {
      /* ignore */
    }
  }, []);

  const gridRows = useMemo<NhiListRow[]>(
    () => NHI_ROW_ORDER.map((k) => getListRow(k)),
    []
  );

  const filteredGridRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return gridRows;
    return gridRows.filter((row) => {
      const haystack = [
        row.identityName,
        row.typeLabel,
        String(row.riskScore),
        row.severity,
        row.lastReviewed,
        row.primaryOwner,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [gridRows, searchTerm]);

  const openDetail = useCallback(
    (key: NhiTypeKey) => {
      router.push(`${pathname}?${NHI_DETAIL_QUERY}=${encodeURIComponent(key)}`);
    },
    [router, pathname]
  );

  const listColumnDefs = useMemo<ColDef<NhiListRow>[]>(
    () => [
      {
        headerName: "Identity",
        field: "identityName",
        flex: 1.4,
        minWidth: 160,
        cellStyle: { fontWeight: 600 },
      },
      {
        headerName: "Type",
        field: "typeLabel",
        flex: 1.2,
        minWidth: 140,
      },
      {
        headerName: "Risk score",
        field: "riskScore",
        flex: 0.6,
        minWidth: 100,
      },
      {
        headerName: "Severity",
        field: "severity",
        flex: 0.7,
        minWidth: 110,
        cellRenderer: SeverityCell,
      },
      {
        headerName: "Last reviewed",
        field: "lastReviewed",
        flex: 0.9,
        minWidth: 120,
      },
      {
        headerName: "Primary owner",
        field: "primaryOwner",
        flex: 1,
        minWidth: 120,
      },
      {
        headerName: "View",
        field: "key",
        width: 88,
        minWidth: 88,
        maxWidth: 100,
        sortable: false,
        filter: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: ICellRendererParams<NhiListRow>) => {
          const rowKey = params.data?.key;
          if (!rowKey) return null;
          return (
            <div className="flex h-full items-center justify-start">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                title="Open NHI review"
                aria-label={`View review for ${params.data?.identityName ?? "identity"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  openDetail(rowKey);
                }}
              >
                <Eye size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>
          );
        },
      },
    ],
    [openDetail]
  );

  return (
    <div
      className={
        detailKey
          ? "nhi-review-root nhi-review-root--detail"
          : "nhi-review-root"
      }
    >
      <div className="nhi-review-page">
        {!detailKey ? (
          <>
            <div className="nhi-list-wrap">
              <div className="bg-white rounded-lg px-4 py-3 mb-2 flex items-center border border-gray-200">
                <div
                  className="relative bg-white rounded-md border border-gray-300 w-full max-w-md"
                  style={{
                    display: "flex",
                    padding: "6px 10px",
                    alignItems: "center",
                    gap: "8px",
                    alignSelf: "stretch",
                  }}
                >
                  <Search className="text-gray-400 w-4 h-4 flex-shrink-0" aria-hidden />
                  <input
                    type="search"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-0 bg-transparent text-gray-700 focus:outline-none flex-1 min-w-0 text-sm"
                    aria-label="Search identities"
                  />
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="ag-theme-quartz ag-main w-full">
                  <AgGridReact
                    theme={themeQuartz}
                    rowData={filteredGridRows}
                    columnDefs={listColumnDefs}
                    defaultColDef={defaultColDef}
                    domLayout="autoHeight"
                    getRowId={(params) => params.data.key}
                    suppressCellFocus={true}
                    onGridReady={(params) => {
                      try {
                        params.api.sizeColumnsToFit();
                      } catch {
                        /* ignore */
                      }
                      const handleResize = () => {
                        try {
                          params.api.sizeColumnsToFit();
                        } catch {
                          /* ignore */
                        }
                      };
                      window.addEventListener("resize", handleResize);
                      params.api.addEventListener("gridPreDestroyed", () => {
                        window.removeEventListener("resize", handleResize);
                      });
                    }}
                    onGridSizeChanged={(params) => {
                      try {
                        params.api.sizeColumnsToFit();
                      } catch {
                        /* ignore */
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <NhiReviewDetail typeKey={detailKey} />
        )}
      </div>
    </div>
  );
}
