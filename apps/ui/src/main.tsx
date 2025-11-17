import React from 'react';
import ReactDOM from 'react-dom/client';
import { Buffer } from 'buffer';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import './index.css';

if (typeof globalThis.global === 'undefined') {
  (globalThis as typeof globalThis & { global?: typeof globalThis }).global = globalThis;
}

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
