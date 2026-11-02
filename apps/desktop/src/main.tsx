import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import "@/styles/main.css";
import "@/styles/workbench.css";
import i18n from "@/i18n";
import { SettingsProvider } from "@/app/settings";
import { ToolProvider } from "@/app/tool-context";
import { WindowTitlebar } from "@/app/WindowTitlebar";
const SearchPage = lazy(async () => ({
  default: (await import("@/features/explore/Search")).SearchPage,
}));
import { AppShell } from "@/app/shell";
const HomePage = lazy(async () => ({
  default: (await import("@/features/home/Home")).HomePage,
}));
const DiscoverPage = lazy(async () => ({
  default: (await import("@/features/explore/Discover")).DiscoverPage,
}));
const AppDetailsPage = lazy(async () => ({
  default: (await import("@/features/explore/AppDetails")).AppDetailsPage,
}));
const EditorDetailsPage = lazy(async () => ({
  default: (await import("@/features/explore/EditorDetails")).EditorDetailsPage,
}));
const ProxyPage = lazy(async () => ({
  default: (await import("@/features/proxy/Proxy")).ProxyPage,
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

const TerminalPage = lazy(async () => ({default: (await import('@/features/terminal/Terminal')).TerminalPage}));
const OffersPage = lazy(async () => ({default: (await import('@/features/offers/Offers')).OffersPage}));
const LearningPage = lazy(async () => ({default: (await import('@/features/learning/Learning')).LearningPage}));
const Onboarding = lazy(async () => ({default: (await import('@/features/onboarding/Onboarding')).Onboarding}));

function LegacyModels() { const { search } = useLocation(); return <Navigate to={"/connections/api" + search} replace />; }
function LegacyGuide() { const { appId } = useParams(); return <Navigate to={`/learning/${appId ?? ''}`} replace />; }

function Gate() {
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
        <Route path="/tools" element={<Navigate to="/" replace />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/app/:appId" element={<AppDetailsPage />} />
        <Route path="/app/antigravity-ide" element={<Navigate to="/editor/antigravity-ide" replace />} />
        <Route path="/editor/:editorId" element={<EditorDetailsPage />} />
        <Route path="/my-apps" element={<Navigate to="/" replace />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/connections" element={<Navigate to="/connections/api" replace />} />
        <Route path="/connections/api" element={<ModelsPage />} />
        <Route path="/connections/proxy" element={<ProxyPage />} />
        <Route path="/proxy" element={<Navigate to="/connections/proxy" replace />} />
        <Route
          path="/terminal"
          element={<TerminalPage />}
        />
        <Route
          path="/long-running"
          element={<Navigate to="/learning/long-running" replace />}
        />
        <Route path="/guides" element={<Navigate to="/learning?category=applications" replace />} />
        <Route path="/guides/extensions" element={<Navigate to="/learning?category=skills" replace />} />
        <Route path="/accounts" element={<Navigate to="/" replace />} />
        <Route path="/guides/:appId" element={<LegacyGuide />} />
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/learning" element={<LearningPage />} />
        <Route path="/learning/:articleId" element={<LearningPage />} />
        <Route path="/models" element={<LegacyModels />} />
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
      <div className="vh-app-frame">
        <WindowTitlebar />
        <div className="vh-app-content">
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
        </div>
      </div>
    </SettingsProvider>
  </StrictMode>,
);
}
void bootstrap();
