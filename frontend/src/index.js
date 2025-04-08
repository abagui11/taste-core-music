// Import the error suppressor first to ensure it runs before anything else
import './errorSuppressor';

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Global error suppression for the Spline error - specifically target the unhandled promise rejection
const originalOnUnhandledRejection = window.onunhandledrejection;
window.onunhandledrejection = function(event) {
  // Check if this is the Spline error
  if (event && event.reason && event.reason.message && 
      event.reason.message.includes('_debouncedCallUserAPI is not a function')) {
    // Prevent the error from being reported
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
  
  // Pass through to original handler if it exists
  if (originalOnUnhandledRejection) {
    return originalOnUnhandledRejection.apply(this, arguments);
  }
};

// Add a monkey patch to React's error overlay
const disableReactErrorOverlay = () => {
  if (process.env.NODE_ENV === 'development') {
    // Wait a bit for the overlay to be available
    const interval = setInterval(() => {
      const errorOverlay = window.__REACT_ERROR_OVERLAY__;
      if (errorOverlay) {
        try {
          // Save the original method
          if (!errorOverlay._originalReportBuildError) {
            errorOverlay._originalReportBuildError = errorOverlay.reportBuildError;
          }
          
          // Override the method
          errorOverlay.reportBuildError = (error) => {
            if (error && error.message && error.message.includes('_debouncedCallUserAPI')) {
              console.log('Suppressed Spline error in React error overlay');
              return;
            }
            errorOverlay._originalReportBuildError(error);
          };
          
          // Also clear existing errors on load
          if (errorOverlay.clearCompileError) {
            errorOverlay.clearCompileError();
          }
          if (errorOverlay.clearRuntimeErrors) {
            errorOverlay.clearRuntimeErrors();
          }
          
          clearInterval(interval);
        } catch (e) {
          console.log('Error patching React error overlay:', e);
        }
      }
    }, 100);
  }
};

// Apply the error overlay patch
disableReactErrorOverlay();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
