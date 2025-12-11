import { ErrorTestingPanel } from '@/components/error/ErrorTestingPanel';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';

const ErrorTestPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-4xl mx-auto p-4 pt-20 pb-24">
        <div className="mb-6">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            size="sm"
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <h1 className="text-2xl font-bold mb-2">Error Handling Test Page</h1>
          <p className="text-muted-foreground">
            Test error handling scenarios across the application
          </p>
        </div>

        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100">Testing Instructions</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1">
                <li>• Use the test panel below to simulate various error conditions</li>
                <li>• Navigate to different pages (Profile, Feed, Discover, Activity) to see error states</li>
                <li>• Test retry functionality on error states</li>
                <li>• Verify error boundary catches unhandled errors</li>
                <li>• Check that error messages are user-friendly</li>
              </ul>
            </div>
          </div>
        </div>

        <ErrorTestingPanel />

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-card rounded-lg border">
            <h3 className="font-semibold mb-3">Expected Error States</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>• Network errors show "Connection failed" messages</li>
              <li>• Server errors show "Something went wrong" messages</li>
              <li>• Not found errors show specific "not found" messages</li>
              <li>• All errors include retry functionality</li>
            </ul>
          </div>

          <div className="p-6 bg-card rounded-lg border">
            <h3 className="font-semibold mb-3">Test Coverage</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>• Profile page error handling</li>
              <li>• Feed page error handling</li>
              <li>• Discover page error handling</li>
              <li>• Activity page error handling</li>
              <li>• Global ErrorBoundary coverage</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ErrorTestPage;