// Error Handling Test Utility
// This file contains functions to test error handling scenarios

// Simulate network error
export const simulateNetworkError = () => {
  // Override fetch to simulate network error
  const originalFetch = window.fetch;
  window.fetch = () => Promise.reject(new Error('Network error'));
  
  // Restore after 5 seconds
  setTimeout(() => {
    window.fetch = originalFetch;
  }, 5000);
};

// Simulate server error
export const simulateServerError = () => {
  const originalFetch = window.fetch;
  window.fetch = () => Promise.resolve({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    json: () => Promise.reject(new Error('Server error'))
  } as Response);
  
  // Restore after 5 seconds
  setTimeout(() => {
    window.fetch = originalFetch;
  }, 5000);
};

// Simulate slow network
export const simulateSlowNetwork = () => {
  const originalFetch = window.fetch;
  window.fetch = (...args) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(originalFetch(...args));
      }, 5000); // 5 second delay
    });
  };
  
  // Restore after 10 seconds
  setTimeout(() => {
    window.fetch = originalFetch;
  }, 10000);
};

// Test error boundary
export const testErrorBoundary = () => {
  throw new Error('Test error for ErrorBoundary');
};

// Test component error
export const TestErrorComponent = () => {
  throw new Error('Test component error');
};