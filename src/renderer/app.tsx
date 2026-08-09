import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api_get } from "@/lib/api";
import type { ProviderSettingsResponse } from "@/lib/providers";
import "./css/app.css";

type OnboardingContextValue = {
  markComplete: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

// For use inside the Onboarding page: tells the guard that keys are now
// configured so it doesn't redirect back when the page calls navigate('/').
export function useOnboardingComplete(): () => void {
  const ctx = useContext(OnboardingContext);
  return ctx?.markComplete ?? (() => {});
}

const Main = lazy(() => import("./pages/main"));
const Project = lazy(() => import("./pages/project"));
const Docs = lazy(() => import("./pages/docs"));
const Gallery = lazy(() => import("./pages/gallery"));
const Settings = lazy(() => import("./pages/settings"));
const Onboarding = lazy(() => import("./pages/onboarding"));
const Documentation = lazy(() => import("./pages/documentation"));
const About = lazy(() => import("./pages/about"));

// Bootstraps the onboarding gate: if no provider connection is configured and we're
// not already at /onboarding, redirect there so the user can't navigate past
// the unconfigured state. Nothing renders while the check is in flight, to
// avoid flashing a page the user shouldn't see. The Onboarding page calls
// markComplete (via useOnboardingComplete) right before navigate('/') so the
// guard's state flips synchronously and doesn't loop the user back.
function OnboardingGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    api_get<ProviderSettingsResponse>("/api/settings/providers")
      .then((data) => {
        if (cancelled) return;
        setNeedsOnboarding(!data.anyConfigured);
      })
      .catch(() => {
        if (cancelled) return;
        setNeedsOnboarding(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const markComplete = useCallback(() => setNeedsOnboarding(false), []);
  const contextValue = useMemo(() => ({ markComplete }), [markComplete]);

  if (needsOnboarding === null) return null;

  if (needsOnboarding && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
}

// Subscribes to deep-link events from the main process. When the user
// clicks a system notification, navigate to the target project and stash
// the target conversation in router state so the project page can route
// it to the correct chat panel on mount.
function NotificationNavigator() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onNotificationNavigate) return;
    const unsubscribe = api.onNotificationNavigate((target) => {
      navigateRef.current(`/projects/${target.projectId}`, {
        state: { focusConversationId: target.conversationId },
      });
    });
    return unsubscribe;
  }, []);

  return null;
}

const root = createRoot(document.getElementById("app")!);

root.render(
  <BrowserRouter>
    <NotificationNavigator />
    <OnboardingGuard>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/projects/:id" element={<Project />} />
          <Route path="/projects/:id/docs" element={<Docs />} />
          <Route path="/projects/:id/gallery" element={<Gallery />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/documentation" element={<Documentation />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </Suspense>
    </OnboardingGuard>
  </BrowserRouter>,
);
