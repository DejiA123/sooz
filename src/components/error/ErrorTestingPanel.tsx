import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, WifiOff, Server, Clock, Bug } from 'lucide-react';
import { 
  simulateNetworkError, 
  simulateServerError, 
  simulateSlowNetwork, 
  testErrorBoundary 
} from '@/utils/error-testing';

const ErrorTestingPanel = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [lastTest, setLastTest] = useState<string>('');

  const runTest = (testName: string, testFunction: () => void) => {
    setIsTesting(true);
    setLastTest(testName);
    
    try {
      testFunction();
      setTimeout(() => {
        setIsTesting(false);
      }, 2000);
    } catch (error) {
      console.log(`Test ${testName} completed - error handling triggered`);
      setIsTesting(false);
    }
  };

  return (
    <div className="p-6 bg-card rounded-lg border space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Bug className="w-5 h-5 text-destructive" />
        <h3 className="text-lg font-semibold">Error Handling Test Panel</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        Test error handling scenarios. These tests will simulate various error conditions.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          onClick={() => runTest('Network Error', simulateNetworkError)}
          variant="outline"
          disabled={isTesting}
          className="justify-start"
        >
          <WifiOff className="w-4 h-4 mr-2" />
          Simulate Network Error
        </Button>

        <Button
          onClick={() => runTest('Server Error', simulateServerError)}
          variant="outline"
          disabled={isTesting}
          className="justify-start"
        >
          <Server className="w-4 h-4 mr-2" />
          Simulate Server Error
        </Button>

        <Button
          onClick={() => runTest('Slow Network', simulateSlowNetwork)}
          variant="outline"
          disabled={isTesting}
          className="justify-start"
        >
          <Clock className="w-4 h-4 mr-2" />
          Simulate Slow Network
        </Button>

        <Button
          onClick={() => runTest('Error Boundary', testErrorBoundary)}
          variant="destructive"
          disabled={isTesting}
          className="justify-start"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Test Error Boundary
        </Button>
      </div>

      {isTesting && (
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm font-medium">Running test: {lastTest}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Check the page for error states. The test will auto-restore after a few seconds.
          </p>
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Instructions:</strong></p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Click "Simulate Network Error" to test offline scenarios</li>
          <li>Click "Simulate Server Error" to test 500 errors</li>
          <li>Click "Simulate Slow Network" to test timeout scenarios</li>
          <li>Click "Test Error Boundary" to test uncaught errors (page will show error boundary)</li>
          <li>Navigate to different pages to see error states in context</li>
        </ul>
      </div>
    </div>
  );
};

export { ErrorTestingPanel };