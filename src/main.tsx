// Safeguard window.fetch against packages that attempt property assignment on read-only getter
if (typeof window !== 'undefined' && window.fetch) {
  try {
    const nativeFetch = window.fetch.bind(window);
    let activeFetch = nativeFetch;
    Object.defineProperty(window, 'fetch', {
      get: () => activeFetch,
      set: (fn: any) => {
        activeFetch = typeof fn === 'function' ? fn : nativeFetch;
      },
      configurable: true,
      enumerable: true,
    });
  } catch (e) {
    // Ignore
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
