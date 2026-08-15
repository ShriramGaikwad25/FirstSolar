import { notFound } from "next/navigation";
import { isRiskAnalysisSegment, RISK_ANALYSIS_TITLES } from "@/lib/risk-analysis-routes";

type PageProps = { params: Promise<{ segment: string }> };

export default async function RiskAnalysisSegmentPage({ params }: PageProps) {
  const { segment } = await params;
  if (!isRiskAnalysisSegment(segment)) {
    notFound();
  }
  const title = RISK_ANALYSIS_TITLES[segment] ?? segment;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full min-w-0 px-0 py-8">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600 mt-2">
          This area is ready for the {title} experience. Connect your API or content here.
        </p>
      </div>
    </div>
  );
}
