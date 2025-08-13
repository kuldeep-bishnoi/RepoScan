import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";

interface ScanProgressProps {
  scanId: string;
  repositoryName: string;
  onComplete: () => void;
}

export default function ScanProgress({ scanId, repositoryName, onComplete }: ScanProgressProps) {
  const { data: progressData } = useQuery({
    queryKey: ["/api/scans", scanId, "progress"],
    refetchInterval: 1000, // Poll every second
    onSuccess: (data) => {
      if (data?.status === 'completed') {
        onComplete();
      }
    },
  });

  const progress = progressData?.progress || 0;
  const currentStep = progressData?.currentStep || "Initializing...";

  const getStepIcon = (step: string) => {
    if (step.includes('Cloning') || step.includes('clone')) return 'fas fa-download';
    if (step.includes('ESLint')) return 'fas fa-code';
    if (step.includes('npm') || step.includes('audit')) return 'fas fa-cube';
    if (step.includes('security') || step.includes('Security')) return 'fas fa-shield-alt';
    return 'fas fa-spinner fa-spin';
  };

  const steps = [
    { name: "Repository cloned successfully", completed: progress > 10 },
    { name: "Running ESLint analysis...", completed: progress > 25, active: progress >= 25 && progress < 50 },
    { name: "npm audit scan", completed: progress > 50, active: progress >= 50 && progress < 75 },
    { name: "Security pattern analysis", completed: progress > 75, active: progress >= 75 && progress < 100 },
  ];

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Scanning Repository...</h3>
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600">
            <i className="fas fa-times"></i>
          </Button>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Repository: {repositoryName}</span>
            <span className="text-slate-500">{Math.round(progress)}% Complete</span>
          </div>
          
          <Progress value={progress} className="w-full" />
          
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center text-sm">
                <i className={`mr-3 ${
                  step.completed 
                    ? 'fas fa-check-circle text-green-500'
                    : step.active 
                      ? 'fas fa-spinner fa-spin text-brand-500'
                      : 'fas fa-clock text-slate-400'
                }`}></i>
                <span className={
                  step.completed 
                    ? 'text-slate-700'
                    : step.active 
                      ? 'text-slate-700 font-medium'
                      : 'text-slate-500'
                }>
                  {step.name}
                </span>
              </div>
            ))}
          </div>
          
          <div className="bg-slate-50 rounded-lg p-4 mt-4">
            <p className="text-sm text-slate-600">
              <i className={`${getStepIcon(currentStep)} text-blue-500 mr-2`}></i>
              {currentStep}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
