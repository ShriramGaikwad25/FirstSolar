"use client";
import Link from "next/link";

export default function CatalogTestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Catalog Component Test</h1>
      
      <div className="space-y-4">
        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Test Links</h2>
          <p className="text-gray-600 mb-4">
            Click the links below to test the catalog component with different URL parameters:
          </p>
          
          <div className="space-y-2">
            <div>
              <Link 
                href="/catalog?appinstanceid=b73ac8d7-f4cd-486f-93c7-3589ab5c5296&reviewerId=ec527a50-0944-4b31-b239-05518c87a743"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Test with example appinstanceid and reviewerId
              </Link>
            </div>
            
            <div>
              <Link 
                href="/catalog?appinstanceid=test-app-456&reviewerId=test-reviewer-123"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Test with different parameters
              </Link>
            </div>
            
            <div>
              <Link 
                href="/catalog"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Test with default parameters (fallback values)
              </Link>
            </div>
          </div>
        </div>
        
        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">API Endpoint</h2>
          <p className="text-gray-600 mb-2">
            The component calls this API endpoint:
          </p>
          {/* <code className="bg-gray-100 p-2 rounded text-sm block">
            https://preview.keyforge.ai/catalog/api/v1/ACMECOM/app/b73ac8d7-f4cd-486f-93c7-3589ab5c5296/entitlement?filter=appownerid eq ec527a50-0944-4b31-b239-05518c87a743
          </code> */}
        </div>
        
        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Features Implemented</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>URL parameter handling for appinstanceid and reviewerId</li>
            <li>API call to fetch entitlements with proper filtering</li>
            <li>Loading states with spinner</li>
            <li>Error handling with retry functionality</li>
            <li>Data transformation to match existing table format</li>
            <li>Pagination controls</li>
            <li>Debug information showing current parameters</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
