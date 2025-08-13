import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import IssueList from "./issue-list";
import type { Issue, ScanWithIssues } from "@shared/schema";

interface ScanResultsProps {
  scanId: string;
}

export default function ScanResults({ scanId }: ScanResultsProps) {
  const { data: scanData, isLoading } = useQuery<ScanWithIssues>({
    queryKey: ["/api/scans", scanId],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!scanData) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-slate-600">Scan not found</p>
        </CardContent>
      </Card>
    );
  }

  const issues: Issue[] = scanData.issues || [];
  const highSeverityCount = issues.filter(i => i.severity === 'high').length;
  const mediumSeverityCount = issues.filter(i => i.severity === 'medium').length;
  const lowSeverityCount = issues.filter(i => i.severity === 'low').length;

  const handleExportResults = () => {
    const exportData = {
      scan: scanData,
      issues: issues,
      summary: {
        high: highSeverityCount,
        medium: mediumSeverityCount,
        low: lowSeverityCount,
        total: issues.length,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scan-results-${scanData.repositoryName.replace('/', '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Results Overview */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Scan Results</h3>
              <p className="text-sm text-slate-600 mt-1">Repository: <span className="font-medium">{scanData.repositoryName}</span></p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-slate-500">
                <i className="fas fa-clock mr-1"></i>
                {scanData.completedAt ? `Completed ${new Date(scanData.completedAt).toLocaleString()}` : 'In Progress'}
              </span>
              <Button
                onClick={handleExportResults}
                variant="outline"
                size="sm"
              >
                <i className="fas fa-download mr-2"></i>
                Export Results
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">High Severity</p>
                  <p className="text-2xl font-bold text-red-900">{highSeverityCount}</p>
                </div>
                <i className="fas fa-exclamation-triangle text-red-500 text-xl"></i>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-700">Medium Severity</p>
                  <p className="text-2xl font-bold text-yellow-900">{mediumSeverityCount}</p>
                </div>
                <i className="fas fa-exclamation-circle text-yellow-500 text-xl"></i>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Low Severity</p>
                  <p className="text-2xl font-bold text-blue-900">{lowSeverityCount}</p>
                </div>
                <i className="fas fa-info-circle text-blue-500 text-xl"></i>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Total Issues</p>
                  <p className="text-2xl font-bold text-green-900">{issues.length}</p>
                </div>
                <i className="fas fa-file-code text-green-500 text-xl"></i>
              </div>
            </div>
          </div>

          {/* Scan Tools Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-slate-900">ESLint</h4>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">✓</span>
              </div>
              <p className="text-sm text-slate-600">{issues.filter(i => i.source === 'eslint').length} issues</p>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-slate-900">npm audit</h4>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">✓</span>
              </div>
              <p className="text-sm text-slate-600">{issues.filter(i => i.source === 'npm-audit').length} vulnerabilities</p>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-slate-900">Patterns</h4>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">✓</span>
              </div>
              <p className="text-sm text-slate-600">{issues.filter(i => i.source === 'security-patterns').length} issues</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-slate-900">Semgrep</h4>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">✓</span>
              </div>
              <p className="text-sm text-slate-600">{issues.filter(i => i.source === 'semgrep').length} findings</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-slate-900">Trivy</h4>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">✓</span>
              </div>
              <p className="text-sm text-slate-600">{issues.filter(i => i.source === 'trivy').length} vulnerabilities</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues List */}
      <IssueList issues={issues} />
    </div>
  );
}
