/**
 * Error Suppressor for Spline Errors
 * 
 * This module patches various browser and React error handling mechanisms
 * to specifically suppress the "_debouncedCallUserAPI is not a function" error
 * that occurs in the Spline component.
 */

// The error message to suppress
const ERROR_TO_SUPPRESS = '_debouncedCallUserAPI is not a function';

// Patch console.error
const originalConsoleError = console.error;
console.error = function(...args) {
  if (args[0] && typeof args[0] === 'string' && args[0].includes(ERROR_TO_SUPPRESS)) {
    // Suppress the error
    return;
  }
  return originalConsoleError.apply(console, args);
};

// Patch console.warn
const originalConsoleWarn = console.warn;
console.warn = function(...args) {
  if (args[0] && typeof args[0] === 'string' && args[0].includes(ERROR_TO_SUPPRESS)) {
    // Suppress the warning
    return;
  }
  return originalConsoleWarn.apply(console, args);
};

// Patch window.onerror
const originalOnError = window.onerror;
window.onerror = function(message, source, lineno, colno, error) {
  if (message && typeof message === 'string' && message.includes(ERROR_TO_SUPPRESS)) {
    // Suppress the error
    return true;
  }
  
  if (originalOnError) {
    return originalOnError.apply(this, arguments);
  }
  return false;
};

// Patch window.onunhandledrejection
const originalOnUnhandledRejection = window.onunhandledrejection;
window.onunhandledrejection = function(event) {
  if (event && event.reason && event.reason.message && 
      event.reason.message.includes(ERROR_TO_SUPPRESS)) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
  
  if (originalOnUnhandledRejection) {
    return originalOnUnhandledRejection.apply(this, arguments);
  }
};

// Add event listeners for errors and unhandled rejections
window.addEventListener('error', function(event) {
  if (event && event.error && event.error.message && 
      event.error.message.includes(ERROR_TO_SUPPRESS)) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}, true);

window.addEventListener('unhandledrejection', function(event) {
  if (event && event.reason && event.reason.message && 
      event.reason.message.includes(ERROR_TO_SUPPRESS)) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}, true);

// Patch React's error overlay in development mode
if (process.env.NODE_ENV === 'development') {
  const patchReactErrorOverlay = () => {
    const interval = setInterval(() => {
      const errorOverlay = window.__REACT_ERROR_OVERLAY__;
      if (errorOverlay) {
        try {
          // Save original methods
          if (!errorOverlay._originalReportRuntimeError) {
            errorOverlay._originalReportRuntimeError = errorOverlay.reportRuntimeError;
          }
          
          if (!errorOverlay._originalDismissRuntimeErrors) {
            errorOverlay._originalDismissRuntimeErrors = errorOverlay.dismissRuntimeErrors;
          }
          
          // Override methods
          errorOverlay.reportRuntimeError = (error) => {
            if (error && error.message && error.message.includes(ERROR_TO_SUPPRESS)) {
              // Silently suppress this specific error
              return;
            }
            // Call original for other errors
            errorOverlay._originalReportRuntimeError(error);
          };
          
          // Auto-dismiss runtime errors on startup
          errorOverlay.dismissRuntimeErrors();
          
          clearInterval(interval);
        } catch (e) {
          console.log('Error patching React error overlay:', e);
        }
      }
    }, 100);
  };
  
  patchReactErrorOverlay();
}

// Inject a global error handler into the Spline component
const patchSplineComponent = () => {
  if (typeof window !== 'undefined') {
    // Save original createElement
    const originalCreateElement = document.createElement;
    
    // Override to patch iframe content
    document.createElement = function(tagName) {
      const element = originalCreateElement.apply(document, arguments);
      
      if (tagName.toLowerCase() === 'iframe') {
        // Add onload handler to patch the iframe content
        const originalOnload = element.onload;
        element.onload = function() {
          try {
            // Call original onload if exists
            if (originalOnload) {
              originalOnload.apply(this, arguments);
            }
            
            // Try to access the contentWindow
            if (this.contentWindow) {
              // Define the missing function
              if (this.contentWindow._debouncedCallUserAPI === undefined) {
                this.contentWindow._debouncedCallUserAPI = function() {
                  return Promise.resolve({});
                };
              }
            }
          } catch (err) {
            // Ignore errors when accessing contentWindow (cross-origin issues)
          }
        };
      }
      
      return element;
    };
  }
};

// Execute the patch
patchSplineComponent();

export default {
  // Export a function to check if a given error should be suppressed
  shouldSuppressError: (err) => {
    if (!err) return false;
    
    // Check error message
    if (typeof err === 'string' && err.includes(ERROR_TO_SUPPRESS)) {
      return true;
    }
    
    // Check error object
    if (err.message && err.message.includes(ERROR_TO_SUPPRESS)) {
      return true;
    }
    
    return false;
  }
}; 