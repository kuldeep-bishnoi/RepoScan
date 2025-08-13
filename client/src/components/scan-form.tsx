import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ScanFormProps {
  onScanStarted: (scanId: string) => void;
  disabled?: boolean;
}

export default function ScanForm({ onScanStarted, disabled = false }: ScanFormProps) {
  const [url, setUrl] = useState("");
  const [scanOptions, setScanOptions] = useState({
    eslint: true,
    npmAudit: true,
    securityPatterns: true,
    deepAnalysis: false,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createScanMutation = useMutation({
    mutationFn: async (data: { repositoryUrl: string; scanOptions: typeof scanOptions }) => {
      const response = await apiRequest("POST", "/api/scans", data);
      return response.json();
    },
    onSuccess: (scan) => {
      toast({
        title: "Scan Started",
        description: `Scanning ${scan.repositoryName}`,
      });
      onScanStarted(scan.id);
      queryClient.invalidateQueries({ queryKey: ["/api/scans"] });
    },
    onError: (error) => {
      toast({
        title: "Scan Failed",
        description: error instanceof Error ? error.message : "Failed to start scan",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a GitHub repository URL",
        variant: "destructive",
      });
      return;
    }

    createScanMutation.mutate({
      repositoryUrl: url.trim(),
      scanOptions,
    });
  };

  const handleOptionChange = (key: keyof typeof scanOptions) => (checked: boolean) => {
    setScanOptions(prev => ({ ...prev, [key]: checked }));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Repository Scanner</h2>
          <p className="text-sm text-slate-600 mt-1">Analyze GitHub repositories for security vulnerabilities and code quality issues</p>
        </div>
        <div className="text-sm text-slate-500">
          <i className="fas fa-clock mr-1"></i>
          Average scan time: 2-5 minutes
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Label htmlFor="github-url" className="block text-sm font-medium text-slate-700 mb-2">
              GitHub Repository URL
            </Label>
            <div className="relative">
              <i className="fas fa-code-branch absolute left-3 top-3 text-slate-400"></i>
              <Input 
                id="github-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
                className="pl-10"
                disabled={disabled}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Enter a public GitHub repository URL to begin scanning</p>
          </div>
          <div className="sm:w-40 flex flex-col justify-end">
            <Button 
              type="submit" 
              disabled={disabled || createScanMutation.isPending}
              className="w-full bg-brand-500 hover:bg-brand-600"
            >
              {createScanMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Starting...
                </>
              ) : (
                <>
                  <i className="fas fa-search mr-2"></i>
                  Scan Repository
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="eslint"
              checked={scanOptions.eslint}
              onCheckedChange={handleOptionChange('eslint')}
              disabled={disabled}
            />
            <Label htmlFor="eslint" className="text-sm text-slate-700">ESLint Analysis</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="npm-audit"
              checked={scanOptions.npmAudit}
              onCheckedChange={handleOptionChange('npmAudit')}
              disabled={disabled}
            />
            <Label htmlFor="npm-audit" className="text-sm text-slate-700">npm audit</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="security-patterns"
              checked={scanOptions.securityPatterns}
              onCheckedChange={handleOptionChange('securityPatterns')}
              disabled={disabled}
            />
            <Label htmlFor="security-patterns" className="text-sm text-slate-700">Security Patterns</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="deep-analysis"
              checked={scanOptions.deepAnalysis}
              onCheckedChange={handleOptionChange('deepAnalysis')}
              disabled={disabled}
            />
            <Label htmlFor="deep-analysis" className="text-sm text-slate-700">Deep Analysis</Label>
          </div>
        </div>
      </form>
    </div>
  );
}
