import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { getTemplateById, getBlankTemplate } from '../templates';
import Canvas from '../components/editor/Canvas';
import RightPanel from '../components/editor/RightPanel';

export default function BuilderPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const loadTemplate = useEditorStore((s) => s.loadTemplate);
  const loadSavedTemplate = useEditorStore((s) => s.loadSavedTemplate);
  const loadFromLocalStorage = useEditorStore((s) => s.loadFromLocalStorage);
  const savedTemplates = useEditorStore((s) => s.savedTemplates);
  const dashboardName = useEditorStore((s) => s.dashboardName);
  const setDashboardName = useEditorStore((s) => s.setDashboardName);
  const saveToLocalStorage = useEditorStore((s) => s.saveToLocalStorage);
  const resetToDefault = useEditorStore((s) => s.resetToDefault);
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const originalTemplateId = useEditorStore((s) => s.originalTemplateId);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  useEffect(() => {
    if (!templateId) return;

    // Check if there's a saved version
    const saved = savedTemplates[templateId];
    if (saved) {
      loadSavedTemplate(saved);
      return;
    }

    // Load from default templates
    if (templateId === 'blank') {
      const blank = getBlankTemplate();
      loadTemplate(blank.id, blank.name, blank.components);
    } else {
      const template = getTemplateById(templateId);
      if (template) {
        loadTemplate(template.id, template.name, template.components);
      } else {
        navigate('/templates');
      }
    }
    // Only run when templateId changes or when savedTemplates are first loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const handleSave = () => {
    saveToLocalStorage();
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
  };

  const handleReset = () => {
    if (!originalTemplateId) return;
    resetToDefault();
    // Reload the original template
    if (originalTemplateId.startsWith('blank')) {
      const blank = getBlankTemplate();
      loadTemplate(blank.id, blank.name, blank.components);
    } else {
      const template = getTemplateById(originalTemplateId);
      if (template) {
        loadTemplate(template.id, template.name, template.components);
      }
    }
    setShowResetConfirm(false);
  };

  const isSaved = activeTemplateId ? !!savedTemplates[activeTemplateId] : false;

  return (
    <div className="builder-layout">
      {/* Top Bar */}
      <div className="builder-topbar">
        <button
          className="topbar-back"
          onClick={() => navigate('/templates')}
        >
          ← Gallery
        </button>
        <div className="topbar-divider" />
        <div className="topbar-name">
          <input
            type="text"
            className="topbar-name-input"
            value={dashboardName}
            onChange={(e) => setDashboardName(e.target.value)}
            placeholder="Dashboard name"
          />
        </div>
        <div className="topbar-actions">
          {isSaved && !showResetConfirm && (
            <button
              className="btn-topbar danger-text"
              onClick={() => setShowResetConfirm(true)}
            >
              Reset to default
            </button>
          )}
          {showResetConfirm && (
            <div className="reset-confirm-inline">
              <span>Reset all changes?</span>
              <button className="confirm-yes" onClick={handleReset}>Yes</button>
              <button className="confirm-no" onClick={() => setShowResetConfirm(false)}>No</button>
            </div>
          )}
          <button className="btn-topbar">
            👁️ Preview
          </button>
          <button
            className={`btn-topbar primary`}
            onClick={handleSave}
            style={saveFlash ? { background: 'var(--accent-success)' } : undefined}
          >
            {saveFlash ? '✓ Saved' : '💾 Save'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="builder-body">
        {/* Left Sidebar */}
        <div className="builder-sidebar">
          <div className="sidebar-icon active" title="Components">
            <span>⊞</span>
          </div>
          <div className="sidebar-icon" title="Layers">
            <span>☰</span>
          </div>
          <div className="sidebar-icon" title="Settings">
            <span>⚙</span>
          </div>
        </div>

        {/* Canvas */}
        <Canvas />

        {/* Right Panel */}
        {selectedComponentId && <RightPanel />}
      </div>
    </div>
  );
}
