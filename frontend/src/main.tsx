import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { themeManager } from './utils/theme';

// Apply initial theme immediately to eliminate any flash or mismatch
themeManager.applyTheme(themeManager.getInitialTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
