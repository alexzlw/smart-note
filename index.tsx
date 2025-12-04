import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Polyfill for process.env to prevent ReferenceError in browser
// This ensures that accessing process.env doesn't crash the app on Vercel/Vite
if (typeof window !== 'undefined' && typeof process === 'undefined') {
  (window as any).process = { env: {} };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);