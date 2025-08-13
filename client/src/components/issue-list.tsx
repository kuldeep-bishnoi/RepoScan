import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Issue } from "@shared/schema";

interface IssueListProps {
  issues: Issue[];
}

export default function IssueList({ issues }: IssueListProps) {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("severity");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter issues
  const filteredIssues = issues.filter(issue => {
    if (activeFilter === "all") return true;
    if (activeFilter === "high") return issue.severity === "high";
    if (activeFilter === "dependencies") return issue.source === "npm-audit";
    if (activeFilter === "code-quality") return issue.source === "eslint";
    return true;
  });

  // Sort issues
  const sortedIssues = [...filteredIssues].sort((a, b) => {
    if (sortBy === "severity") {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return (severityOrder[b.severity as keyof typeof severityOrder] || 0) - 
             (severityOrder[a.severity as keyof typeof severityOrder] || 0);
    }
    if (sortBy === "file") {
      return (a.file || "").localeCompare(b.file || "");
    }
    if (sortBy === "type") {
      return a.source.localeCompare(b.source);
    }
    return 0;
  });

  // Paginate issues
  const totalPages = Math.ceil(sortedIssues.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedIssues = sortedIssues.slice(startIndex, startIndex + itemsPerPage);

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "eslint":
        return "ESLint";
      case "npm-audit":
        return "npm audit";
      case "security-patterns":
        return "Security Pattern";
      case "semgrep":
        return "Semgrep";
      case "trivy":
        return "Trivy";
      default:
        return source;
    }
  };

  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <i className="fas fa-check-circle text-green-500 text-4xl mb-4"></i>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Issues Found</h3>
            <p className="text-slate-600">Great! No security vulnerabilities or code quality issues were detected.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {/* Filter Tabs */}
      <div className="border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex space-x-1">
            <Button
              variant={activeFilter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("all")}
              className={activeFilter === "all" ? "bg-brand-500 text-white" : "text-slate-600 hover:text-slate-900"}
            >
              All Issues
            </Button>
            <Button
              variant={activeFilter === "high" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("high")}
              className={activeFilter === "high" ? "bg-brand-500 text-white" : "text-slate-600 hover:text-slate-900"}
            >
              High Severity
            </Button>
            <Button
              variant={activeFilter === "dependencies" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("dependencies")}
              className={activeFilter === "dependencies" ? "bg-brand-500 text-white" : "text-slate-600 hover:text-slate-900"}
            >
              Dependencies
            </Button>
            <Button
              variant={activeFilter === "code-quality" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("code-quality")}
              className={activeFilter === "code-quality" ? "bg-brand-500 text-white" : "text-slate-600 hover:text-slate-900"}
            >
              Code Quality
            </Button>
          </div>
          <div className="flex items-center space-x-3">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="severity">Sort by Severity</SelectItem>
                <SelectItem value="file">Sort by File</SelectItem>
                <SelectItem value="type">Sort by Type</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm">
              <i className="fas fa-filter"></i>
            </Button>
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="divide-y divide-slate-200">
        {paginatedIssues.map((issue) => (
          <div key={issue.id} className="p-6 hover:bg-slate-50 transition-colors">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityBadgeClass(issue.severity)}`}>
                  {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">
                    {issue.title}
                  </h4>
                  <span className="text-xs text-slate-500">{getSourceLabel(issue.source)}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  {issue.description}
                </p>
                <div className="flex items-center space-x-4 mt-3 text-xs text-slate-500">
                  {issue.file && (
                    <span>
                      <i className="fas fa-file-code mr-1"></i>
                      {issue.file}
                    </span>
                  )}
                  {issue.line && (
                    <span>
                      <i className="fas fa-map-marker-alt mr-1"></i>
                      Line {issue.line}
                    </span>
                  )}
                  {issue.remediation && (
                    <span>
                      <i className="fas fa-lightbulb mr-1"></i>
                      {issue.remediation}
                    </span>
                  )}
                  {issue.cve && (
                    <span>
                      <i className="fas fa-shield-alt mr-1"></i>
                      {issue.cve}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <Button variant="ghost" size="sm">
                  <i className="fas fa-external-link-alt"></i>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 rounded-b-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(startIndex + itemsPerPage, sortedIssues.length)}</span> of <span className="font-medium">{sortedIssues.length}</span> issues
            </p>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <i className="fas fa-chevron-left"></i>
              </Button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={currentPage === page ? "bg-brand-500 text-white" : ""}
                  >
                    {page}
                  </Button>
                );
              })}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <i className="fas fa-chevron-right"></i>
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
