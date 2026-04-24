import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { getTemplateById, getBlankTemplate } from '../templates';
import Canvas from '../components/editor/Canvas';
import RightPanel from '../components/editor/RightPanel';
import LeftPanel from '../components/editor/LeftPanel';
import { useKineticWidth } from '../hooks/useTextMeasure';

const API_BASE = 'http://localhost:3001';

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>();
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
  
  // Left panel toggle state
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);

  // Feature C: pretext kinetic width for name input
  const nameWidth = useKineticWidth(dashboardName);

  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const load = async () => {
      const saved = savedTemplates[id];
      if (saved) {
        loadSavedTemplate(saved);
        return;
      }

      if (id === 'blank') {
        const blank = getBlankTemplate();
        loadTemplate(blank.id, blank.name, blank.components);
        return;
      }

      const template = getTemplateById(id);
      if (template) {
        loadTemplate(template.id, template.name, template.components);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/dashboards/${id}`);
        if (!response.ok) {
          navigate('/');
          return;
        }

        const dashboard = await response.json();
        if (cancelled) {
          return;
        }

        loadTemplate(
          dashboard.id,
          dashboard.name,
          dashboard.config?.components ?? [],
          dashboard.config?.queries ?? [],
        );
      } catch {
        if (!cancelled) {
          navigate('/');
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = () => {
    saveToLocalStorage();
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
  };

  const handleReset = () => {
    if (!originalTemplateId) return;
    resetToDefault();
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
        <div className="topbar-logo">
          <div className="topbar-logo-icon">B</div>
          <span className="topbar-logo-text">BoardTool</span>
        </div>
        <div className="topbar-divider" />
        <button
          className="topbar-back"
          onClick={() => navigate('/')}
        >
          ← Templates
        </button>
        <div className="topbar-divider" />
        <div className="topbar-name">
          <input
            type="text"
            className="topbar-name-input"
            value={dashboardName}
            onChange={(e) => setDashboardName(e.target.value)}
            placeholder="Dashboard name"
            style={{ width: `${nameWidth}px` }}
          />
        </div>
        <div className="topbar-actions">
          {isSaved && !showResetConfirm && (
            <button
              className="btn-topbar danger-text"
              onClick={() => setShowResetConfirm(true)}
            >
              Reset
            </button>
          )}
          {showResetConfirm && (
            <div className="reset-confirm-inline">
              <span>Reset all?</span>
              <button className="confirm-yes" onClick={handleReset}>Yes</button>
              <button className="confirm-no" onClick={() => setShowResetConfirm(false)}>No</button>
            </div>
          )}
          <div className="preview-pill">
            <button className="active">Edit</button>
            <button>Preview</button>
          </div>
          <button
            className={`btn-topbar primary ${saveFlash ? 'saved' : ''}`}
            onClick={handleSave}
          >
            {saveFlash ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="builder-body">
        {/* Narrow Sidebar Toggle */}
        <div className="builder-sidebar">
          <div 
            className={`sidebar-icon ${isLeftPanelOpen ? 'active' : ''}`} 
            data-tooltip="Components"
            onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
          >
            <span>⊞</span>
          </div>
          <div className="sidebar-icon" data-tooltip="Layers">
            <span>☰</span>
          </div>
          <div className="sidebar-icon" data-tooltip="Settings">
            <span>⚙</span>
          </div>
        </div>

        {/* Left Panel */}
        {isLeftPanelOpen && <LeftPanel />}

        {/* Canvas */}
        <Canvas />

        {/* Right Panel */}
        {selectedComponentId && <RightPanel />}
      </div>
    </div>
  );
}
