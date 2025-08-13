import { useState } from "react";
import { useParams } from "wouter";
import Header from "@/components/header";
import ScanForm from "@/components/scan-form";
import ScanProgress from "@/components/scan-progress";
import ScanResults from "@/components/scan-results";
import { useQuery } from "@tanstack/react-query";
import type { ScanWithIssues } from "@shared/schema";

export default function Dashboard() {
  const { id: scanId } = useParams<{ id?: string }>();
  const [activeScanId, setActiveScanId] = useState<string | null>(scanId || null);

  const { data: activeScan } = useQuery<ScanWithIssues>({
    queryKey: ["/api/scans", activeScanId],
    enabled: !!activeScanId,
  });

  const handleScanStarted = (scanId: string) => {
    setActiveScanId(scanId);
  };

  const handleScanCompleted = () => {
    // Keep the scan ID to show results
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Scan Form */}
        <ScanForm 
          onScanStarted={handleScanStarted}
          disabled={!!activeScanId && activeScan?.status === 'scanning'}
        />

        {/* Scan Progress */}
        {activeScanId && activeScan?.status === 'scanning' && (
          <ScanProgress 
            scanId={activeScanId}
            repositoryName={activeScan.repositoryName}
            onComplete={handleScanCompleted}
          />
        )}

        {/* Scan Results */}
        {activeScanId && activeScan?.status === 'completed' && (
          <ScanResults scanId={activeScanId} />
        )}

        {/* Error State */}
        {activeScanId && activeScan?.status === 'failed' && (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
            <div className="flex items-center space-x-3 mb-3">
              <i className="fas fa-exclamation-triangle text-red-500 text-xl"></i>
              <div>
                <p className="font-medium text-slate-900">Scan Failed</p>
                <p className="text-sm text-slate-600">Unable to complete the repository scan</p>
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm text-red-700">
                The scan could not be completed due to an error. Please check the repository URL and try again.
              </p>
            </div>
            <button 
              onClick={() => setActiveScanId(null)}
              className="mt-4 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-200 transition-colors"
            >
              Start New Scan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
