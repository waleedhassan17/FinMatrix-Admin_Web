import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { initObservability } from '@/app/observability';

import App from './App';
import './index.css';

initObservability();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
