import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  className?: string;
  showHomeButton?: boolean;
  error?: Error | null;
}

const ErrorState = ({ 
  title = "Something went wrong", 
  message = "We're sorry, but something unexpected happened. Please try again.",
  onRetry,
  onGoHome,
  className,
  showHomeButton = true,
  error
}: ErrorStateProps) => {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
      <AlertCircle className="w-16 h-16 text-destructive mb-4" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">{message}</p>
      
      {error && (
        <details className="mb-4 w-full max-w-md">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Technical details
          </summary>
          <pre className="mt-2 p-3 bg-muted rounded-md text-xs text-left overflow-auto">
            {error.message}
          </pre>
        </details>
      )}
      
      <div className="flex gap-2">
        {onRetry && (
          <Button onClick={onRetry} variant="default" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
        {showHomeButton && (
          <Button 
            onClick={onGoHome || (() => window.location.href = '/')} 
            variant="outline" 
            size="sm"
          >
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        )}
      </div>
    </div>
  );
};

export { ErrorState };