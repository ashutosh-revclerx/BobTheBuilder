import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TemplateGallery from './pages/TemplateGallery';
import BuilderPage from './pages/BuilderPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/templates" element={<TemplateGallery />} />
        <Route path="/builder/:templateId" element={<BuilderPage />} />
        <Route path="*" element={<Navigate to="/templates" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
