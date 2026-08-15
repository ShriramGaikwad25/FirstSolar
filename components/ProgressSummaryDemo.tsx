import React, { useState } from "react";
import DynamicProgressSummary from "./DynamicProgressSummary";
import ProgressDonutChart from "./ProgressDonutChart";

const ProgressSummaryDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dynamic' | 'static'>('dynamic');

  // Sample data for testing
  const sampleRowData = [
    { status: "completed", aiInsights: "thumbs-up", recommendation: "certify" },
    { status: "pending", aiInsights: "", recommendation: "" },
    { status: "pending", aiInsights: "", recommendation: "" },
    { status: "revoked", action: "reject", recommendation: "revoke" },
    { status: "delegated", action: "delegate" },
    { status: "remediated", action: "remediate" },
    { status: "pending", aiInsights: "", recommendation: "" },
    { status: "completed", aiInsights: "thumbs-up", recommendation: "certify" },
  ];

  const staticProgressData = {
    totalItems: 150,
    approvedCount: 45,
    pendingCount: 80,
    revokedCount: 15,
    delegatedCount: 5,
    remediatedCount: 5,
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Progress Summary Charts Demo</h1>
      
      {/* Tab Navigation */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveTab('dynamic')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'dynamic'
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          Dynamic Chart
        </button>
        <button
          onClick={() => setActiveTab('static')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'static'
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          Static Chart
        </button>
      </div>

      {/* Chart Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {activeTab === 'dynamic' ? (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Dynamic Progress Summary</h2>
            <p className="text-sm text-gray-600 mb-4">
              This chart automatically calculates progress from the provided row data.
              Sample data: {sampleRowData.length} items with various statuses.
            </p>
            <DynamicProgressSummary 
              rowData={sampleRowData} 
              title="Dynamic Progress"
              height="h-80"
            />
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Static Progress Summary</h2>
            <p className="text-sm text-gray-600 mb-4">
              This chart uses predefined progress data.
              Total: {staticProgressData.totalItems} items.
            </p>
            <ProgressDonutChart 
              data={staticProgressData}
              title="Static Progress"
              height="h-80"
            />
          </div>
        )}

        {/* Data Preview */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Data Preview</h2>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <strong>Active Tab:</strong> {activeTab === 'dynamic' ? 'Dynamic' : 'Static'}
            </p>
            {activeTab === 'dynamic' ? (
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Sample Row Data:</strong>
                </p>
                <div className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-64">
                  <pre>{JSON.stringify(sampleRowData, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Static Progress Data:</strong>
                </p>
                <div className="text-xs bg-gray-100 p-3 rounded">
                  <pre>{JSON.stringify(staticProgressData, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">How to Use</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Dynamic Chart:</strong> Automatically analyzes row data to determine progress status</li>
          <li>• <strong>Static Chart:</strong> Uses predefined progress data for consistent display</li>
          <li>• Both charts show the same visual format with different data sources</li>
          <li>• Charts automatically update when data changes</li>
        </ul>
      </div>
    </div>
  );
};

export default ProgressSummaryDemo;
