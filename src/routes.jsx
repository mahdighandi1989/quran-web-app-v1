// Application routes (task 5f2e... — React Router integration).
//
// The app keeps its single tabbed <App /> shell, but every tab is addressable so the
// URL updates on navigation and the browser Back/Forward buttons work. App reads the
// current location (useLocation) and selects the matching tab, so each <Route> simply
// renders <App />. The catch-all keeps deep links (e.g. /search, /exam, /quran) working.
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import App from './App.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/practice" element={<App />} />
      <Route path="/hifz" element={<App />} />
      <Route path="/settings" element={<App />} />
      <Route path="*" element={<App />} />
    </Routes>
  );
}
