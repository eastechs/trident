import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import './css/app.css';

const Main = lazy(() => import('./pages/main'));
const Project = lazy(() => import('./pages/project'));
const Docs = lazy(() => import('./pages/docs'));
const Gallery = lazy(() => import('./pages/gallery'));
const Settings = lazy(() => import('./pages/settings'));
const Onboarding = lazy(() => import('./pages/onboarding'));
const Documentation = lazy(() => import('./pages/documentation'));
const About = lazy(() => import('./pages/about'));

const root = createRoot(document.getElementById('app')!);

root.render(
    <BrowserRouter>
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
