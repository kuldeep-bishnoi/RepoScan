import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DiffViewerProps {
  isOpen: boolean;
  onClose: () => void;
  diff: string;
  issueTitle: string;
  onCreatePR?: () => void;
  isCreatingPR?: boolean;
}

export default function DiffViewer({ isOpen, onClose, diff, issueTitle, onCreatePR, isCreatingPR }: DiffViewerProps) {
  const lines = diff.split('\n');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proposed Fix: {issueTitle}</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto font-mono text-sm">
            {lines.map((line, index) => {
              let className = "";
              let icon = "";
              
              if (line.startsWith('+') && !line.startsWith('+++')) {
                className = "bg-green-900/30 text-green-300";
                icon = "+ ";
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                className = "bg-red-900/30 text-red-300";
                icon = "- ";
              } else if (line.startsWith('@@')) {
                className = "text-blue-400";
                icon = "@ ";
              } else if (line.startsWith('+++') || line.startsWith('---')) {
                className = "text-slate-400";
                icon = "  ";
              } else {
                className = "text-slate-300";
                icon = "  ";
              }

              return (
                <div key={index} className={`${className} px-2 py-0.5`}>
                  <span className="select-none mr-2">{icon}</span>
                  {line.substring(1) || ' '}
                </div>
              );
            })}
          </div>

          {onCreatePR && (
            <div className="mt-6 flex items-center justify-end gap-4">
              <Button variant="ghost" onClick={onClose} data-testid="button-cancel-pr">
                Cancel
              </Button>
              <Button 
                onClick={onCreatePR} 
                disabled={isCreatingPR}
                data-testid="button-confirm-create-pr"
              >
                <i className="fas fa-code-branch mr-2"></i>
                {isCreatingPR ? "Creating PR..." : "Create Pull Request"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
