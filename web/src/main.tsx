import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { applyTextSize, getTextSize } from './lib/textSize';

// Before the first paint, so the remembered text size never flickers.
applyTextSize(getTextSize());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
