import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { lazy, Suspense, useEffect, useRef } from 'react';
import './css/app.css';

const Main = lazy(() => import('./pages/main'));
const Project = lazy(() => import('./pages/project'));
const Docs = lazy(() => import('./pages/docs'));
const Gallery = lazy(() => import('./pages/gallery'));
const Settings = lazy(() => import('./pages/settings'));
const Onboarding = lazy(() => import('./pages/onboarding'));
const Documentation = lazy(() => import('./pages/documentation'));
const About = lazy(() => import('./pages/about'));

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
        api.onNotificationNavigate((target) => {
            navigateRef.current(`/projects/${target.projectId}`, {
                state: { focusConversationId: target.conversationId },
            });
        });
    }, []);

    return null;
}

const root = createRoot(document.getElementById('app')!);

root.render(
    <BrowserRouter>
        <NotificationNavigator />
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
    </BrowserRouter>,
);
