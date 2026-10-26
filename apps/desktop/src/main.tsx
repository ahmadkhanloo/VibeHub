import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import '@/styles/main.css';
import '@/i18n';
import { SettingsProvider, useSettings } from '@/app/settings';
import { AppShell } from '@/app/shell';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { HomePage } from '@/features/home/Home';
import { DiscoverPage } from '@/features/explore/Discover';
import { AppDetailsPage } from '@/features/explore/AppDetails';
import { MyAppsPage } from '@/features/my-apps/MyApps';
import { ProxyPage } from '@/features/proxy/Proxy';
import { TerminalPage } from '@/features/terminal/Terminal';
import { GuidesPage } from '@/features/guides/Guides';
import { OffersPage } from '@/features/offers/Offers';
import { ModelsPage } from '@/features/models/Models';
import { DoctorPage } from '@/features/doctor/Doctor';
import { SettingsPage } from '@/features/settings/Settings';

function Gate() {
  const { settings } = useSettings();
  const location = useLocation();
  if (!settings.onboardingDone && !location.pathname.startsWith('/onboarding')) {
    return <Navigate to="/onboarding" replace />;
  }
  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/app/:appId" element={<AppDetailsPage />} />
        <Route path="/my-apps" element={<MyAppsPage />} />
        <Route path="/proxy" element={<ProxyPage />} />
        <Route path="/terminal" element={<TerminalPage />} />
        <Route path="/guides" element={<GuidesPage />} />
        <Route path="/guides/:appId" element={<GuidesPage />} />
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/doctor" element={<DoctorPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const Router = import.meta.env.TAURI_INTERNALS ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <Router>
        <Gate />
      </Router>
    </SettingsProvider>
  </StrictMode>
);
