import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { hasAuthTokens } from './config/api';

const DashboardList = lazy(() => import('./pages/DashboardList'));
const TemplateGallery = lazy(() => import('./pages/TemplateGallery'));
const BuilderPage = lazy(() => import('./pages/BuilderPage'));
const CustomerView = lazy(() => import('./pages/CustomerView'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const GeneratePage = lazy(() => import('./pages/GeneratePage'));
const TemplatePicker = lazy(() => import('./pages/TemplatePicker'));
const LoginPage = lazy(() => import('./pages/LoginPage'));

function Loading() {
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8f9fb' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid #eff6ff', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );
}

function ProtectedRoutes() {
  const location = useLocation();
  if (!hasAuthTokens()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/c/:slug" element={<CustomerView />} />
          <Route element={<ProtectedRoutes />}>
            <Route path="/" element={<DashboardList />} />
            <Route path="/templates" element={<TemplateGallery />} />
            <Route path="/builder/:id" element={<BuilderPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/new" element={<GeneratePage />} />
            <Route path="/new/pick" element={<TemplatePicker />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
