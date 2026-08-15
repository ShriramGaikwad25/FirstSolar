import { Download } from "lucide-react";

interface ExportsProps {
  gridApi: any;
  certificationId?: string;
  onDownloadExcel?: (certificationId: string) => Promise<void>;
  isActionLoading?: boolean;
}

const Exports = ({ gridApi, certificationId, onDownloadExcel, isActionLoading }: ExportsProps) => {
  const handleDownload = async () => {
    // If certificationId and onDownloadExcel are provided, use the new API
    if (certificationId && onDownloadExcel) {
      try {
        await onDownloadExcel(certificationId);
      } catch (error) {
        console.error("Error in Excel download:", error);
        alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    } else {
      alert("Download functionality not available. Certification ID is required.");
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isActionLoading}
      className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors duration-200 ${
        isActionLoading 
          ? 'opacity-50 cursor-not-allowed bg-gray-200' 
          : 'hover:bg-gray-200 cursor-pointer'
      }`}
      title="Download Excel"
      aria-label="Download Excel"
    >
      <Download className="w-5 h-5 text-gray-700" />
    </button>
  );
};
export default Exports;
