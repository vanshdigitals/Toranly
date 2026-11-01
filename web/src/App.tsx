import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FEATURE_ACCOUNTS } from './config/features';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner, RouteTitle } from './components/AppChrome';

// Everything after the landing page loads on demand, so the first visit stays small.
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const EventWizardPage = lazy(() =>
  import('./pages/EventWizardPage').then((m) => ({ default: m.EventWizardPage })),
);
const EventOverviewPage = lazy(() =>
  import('./pages/EventOverviewPage').then((m) => ({ default: m.EventOverviewPage })),
);
const EventsDashboardPage = lazy(() =>
  import('./pages/EventsDashboardPage').then((m) => ({ default: m.EventsDashboardPage })),
);
const PrintPlanPage = lazy(() =>
  import('./pages/PrintPlanPage').then((m) => ({ default: m.PrintPlanPage })),
);

export function App() {
  return (
    <BrowserRouter>
      {/* Accessible skip link: first item in keyboard order */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <OfflineBanner />
      <RouteTitle />
      <ErrorBoundary>
        <Suspense
          fallback={
            <div className="route-loading" role="status">
              Loading…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<LandingPage />} />

            {/* 
            Guest-First Planning (Option C):
            Accounts are disabled by default. /login and /register redirect once to /events/new.
            LoginPage and RegisterPage components are preserved behind FEATURE_ACCOUNTS flag.
          */}
            <Route
              path="/login"
              element={FEATURE_ACCOUNTS ? <LoginPage /> : <Navigate to="/events/new" replace />}
            />
            <Route
              path="/register"
              element={FEATURE_ACCOUNTS ? <RegisterPage /> : <Navigate to="/events/new" replace />}
            />

            {/* S-05 Create Event Wizard Routes */}
            <Route path="/events/new" element={<EventWizardPage initialStep={1} />} />
            <Route path="/events/:eventId/setup" element={<EventWizardPage />} />
            <Route path="/wizard" element={<EventWizardPage initialStep={1} />} />

            {/* S-04 My Plans Dashboard Route */}
            <Route path="/events" element={<EventsDashboardPage />} />

            {/* S-15 Print / PDF Route */}
            <Route path="/events/:eventId/print" element={<PrintPlanPage />} />

            {/* S-06 Event Planner & Sub-routes */}
            <Route path="/events/:eventId" element={<EventOverviewPage />} />
            <Route path="/events/:eventId/:tab" element={<EventOverviewPage />} />

            {/* S-16 Not Found Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
