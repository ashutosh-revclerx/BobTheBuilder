import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TemplateGallery from './pages/TemplateGallery';
import BuilderPage from './pages/BuilderPage';
import CustomerView from './pages/CustomerView';
import DashboardList from './pages/DashboardList';
import ResourcesPage from './pages/ResourcesPage';
import GeneratePage from './pages/GeneratePage';
import TemplatePicker from './pages/TemplatePicker';

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
