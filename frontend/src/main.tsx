import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import App from '@/App';

// ریشه‌ی panel.luko.ir پنلِ والدین است. nginx آن‌جا ریدایرکت نمی‌دهد (رباتِ اینماد باید
// متاتگِ همین صفحه را ببیند)، پس پیش از اولین رندر نشانی را خودمان عوض می‌کنیم.
if (window.location.hostname === 'panel.luko.ir' && window.location.pathname === '/') {
  window.history.replaceState(null, '', `/parent-panel${window.location.search}${window.location.hash}`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
