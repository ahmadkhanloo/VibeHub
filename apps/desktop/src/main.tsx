import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import "@/styles/main.css";
import i18n from "@/i18n";
import { SettingsProvider, useSettings } from "@/app/settings";
import { ToolProvider } from "@/app/tool-context";
const AccountsPage = lazy(async () => ({ default: (await import('@/features/accounts/Accounts')).AccountsPage }));
const ExtensionsPage = lazy(async () => ({ default: (await import('@/features/guides/Extensions')).ExtensionsPage }));
const SearchPage = lazy(async () => ({
  default: (await import("@/features/explore/Search")).SearchPage,
}));
const GuidesPage = lazy(async () => ({
  default: (await import("@/features/guides/Guides")).GuidesPage,
}));
const OffersPage = lazy(async () => ({
  default: (await import("@/features/offers/Offers")).OffersPage,
}));
import { AppShell } from "@/app/shell";
const Onboarding = lazy(async () => ({
  default: (await import("@/features/onboarding/Onboarding")).Onboarding,
}));
const HomePage = lazy(async () => ({
  default: (await import("@/features/home/Home")).HomePage,
}));
const DiscoverPage = lazy(async () => ({
  default: (await import("@/features/explore/Discover")).DiscoverPage,
}));
const AppDetailsPage = lazy(async () => ({
  default: (await import("@/features/explore/AppDetails")).AppDetailsPage,
}));
const ProxyPage = lazy(async () => ({
  default: (await import("@/features/proxy/Proxy")).ProxyPage,
}));
const LongRunningPage = lazy(async () => ({
  default: (await import("@/features/learning/LongRunning")).LongRunningPage,
}));
const ModelsPage = lazy(async () => ({
  default: (await import("@/features/models/Models")).ModelsPage,
}));
const DoctorPage = lazy(async () => ({
  default: (await import("@/features/doctor/Doctor")).DoctorPage,
}));
const SettingsPage = lazy(async () => ({
  default: (await import("@/features/settings/Settings")).SettingsPage,
}));

function Gate() {
  const { settings } = useSettings();
  const location = useLocation();
  if (
    !settings.onboardingDone &&
    !location.pathname.startsWith("/onboarding")
  ) {
    return <Navigate to="/onboarding" replace />;
  }
  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route
        element={
          <ToolProvider>
            <AppShell />
          </ToolProvider>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/app/:appId" element={<AppDetailsPage />} />
        <Route path="/my-apps" element={<Navigate to="/" replace />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/proxy" element={<ProxyPage />} />
        <Route
          path="/terminal"
          element={<Navigate to="/settings?panel=terminal" replace />}
        />
        <Route
          path="/long-running"
          element={<Navigate to="/learning" replace />}
        />
        <Route path="/guides" element={<GuidesPage />} />
        <Route path="/guides/extensions" element={<ExtensionsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/guides/:appId" element={<GuidesPage />} />
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/learning" element={<LongRunningPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/doctor" element={<DoctorPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const Router = window.location.hostname === 'tauri.localhost' || window.location.protocol === 'tauri:'
  ? HashRouter
  : BrowserRouter;

async function bootstrap() {
  if (import.meta.env.DEV && import.meta.env.MODE === 'browser' && !('__TAURI_INTERNALS__' in window)) {
    const { installBrowserPreview } = await import('@/dev/browser');
    installBrowserPreview();
  }
  createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsProvider>
      <Router>
        <Suspense
          fallback={
            <div className="p-6" role="status">
              {i18n.t('common:appName')}…
            </div>
          }
        >
          <Gate />
        </Suspense>
      </Router>
    </SettingsProvider>
  </StrictMode>,
);
}
void bootstrap();
