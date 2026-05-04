import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const DashboardList = lazy(() => import('./pages/DashboardList'));
const TemplateGallery = lazy(() => import('./pages/TemplateGallery'));
const BuilderPage = lazy(() => import('./pages/BuilderPage'));
const CustomerView = lazy(() => import('./pages/CustomerView'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const GeneratePage = lazy(() => import('./pages/GeneratePage'));
const TemplatePicker = lazy(() => import('./pages/TemplatePicker'));

function Loading() {
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8f9fb' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid #eff6ff', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<DashboardList />} />
          <Route path="/templates" element={<TemplateGallery />} />
          <Route path="/builder/:id" element={<BuilderPage />} />
          <Route path="/c/:slug" element={<CustomerView />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/new" element={<GeneratePage />} />
          <Route path="/new/pick" element={<TemplatePicker />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
