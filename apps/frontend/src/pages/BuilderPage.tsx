import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { getTemplateById, getBlankTemplate } from '../templates';
import Canvas from '../components/editor/Canvas';
import RightPanel from '../components/editor/RightPanel';
import LeftPanel from '../components/editor/LeftPanel';
import PublishToggle from '../components/editor/PublishToggle';
import AssignmentModal from '../components/editor/AssignmentModal';
import { useKineticWidth } from '../hooks/useTextMeasure';
import { exportProject, importProject } from '../services/ProjectService';

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
  const resetToTemplate = useEditorStore((s) => s.resetToTemplate);
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const originalTemplateId = useEditorStore((s) => s.originalTemplateId);
  const importDashboard = useEditorStore((state) => state.importDashboard);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  
  // Left panel toggle state
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);

  const isPreviewMode = useEditorStore((s) => s.isPreviewMode);
  const togglePreviewMode = useEditorStore((s) => s.togglePreviewMode);
  const previewDevice = useEditorStore((s) => s.previewDevice);
  const setPreviewDevice = useEditorStore((s) => s.setPreviewDevice);
  const dirtyStyleMap = useEditorStore((s) => s.dirtyStyleMap);
  const dirtyDataMap = useEditorStore((s) => s.dirtyDataMap);
  
  const isDirty = useEditorStore((s) => s.isDirty);
  
  // Feature C: pretext kinetic width for name input
  const nameWidth = useKineticWidth(dashboardName);

  // Assignment state
  const [assignedCustomers, setAssignedCustomers] = useState<any[]>([]);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      await exportProject(useEditorStore.getState());
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Check console for details.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const projectData = await importProject(file);
      importDashboard(projectData);
      e.target.value = ''; // Reset for same file selection
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const hasUnsavedChanges = isDirty || Object.keys(dirtyStyleMap).length > 0 || Object.keys(dirtyDataMap).length > 0;

  const fetchAssignedCustomers = async () => {
    if (!id || id === 'blank' || id.length < 10) return;
    try {
      const res = await fetch(`${API_BASE}/api/dashboards/${id}/customers`);
      if (res.ok) {
        const data = await res.json();
        setAssignedCustomers(data);
      }
    } catch (err) {
      console.error('Failed to fetch assigned customers:', err);
    }
  };

  useEffect(() => {
    fetchAssignedCustomers();
  }, [id]);

  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // 1. Preview toggle (Ctrl/Cmd + Shift + P)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toUpperCase() === 'P') {
        e.preventDefault();
        togglePreviewMode();
        return;
      }

      if (isInput) return;

      // 2. Duplication (Cmd/Ctrl + D)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const selectedId = useEditorStore.getState().selectedComponentId;
        if (selectedId) {
          useEditorStore.getState().duplicateComponent(selectedId);
        }
      }

      // 3. Deletion (Delete/Backspace)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedId = useEditorStore.getState().selectedComponentId;
        if (selectedId) {
          useEditorStore.getState().removeComponent(selectedId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePreviewMode]);

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
          dashboard.status,
          dashboard.published_at,
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

  // The URL `id` is either a UUID (a real dashboard row in the DB) or a
  // prebuilt-template slug like "project-overview" / "blank" / a saved-
  // template id from localStorage. Only UUID dashboards can be PUT — for
  // anything else the first Save creates a new row and we redirect.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isPersistedDashboard = (candidate: string | undefined): candidate is string =>
    !!candidate && UUID_RE.test(candidate);

  const persistDashboard = async (onlyName: boolean = false) => {
    if (!isPersistedDashboard(id)) return;

    const state = useEditorStore.getState();
    try {
      const response = await fetch(`${API_BASE}/api/dashboards/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:   state.dashboardName,
          config: onlyName ? undefined : {
            components: state.components,
            queries:    state.queriesConfig,
          },
        }),
      });
      if (!response.ok) {
        console.error('[builder] persist failed:', await response.text());
      }
    } catch (err) {
      console.error('[builder] persist network error:', err);
    }
  };

  // First Save on a prebuilt template / blank dashboard: POST a new row,
  // then redirect to /builder/<new-uuid> so subsequent saves PUT to it.
  const persistAsNewDashboard = async (): Promise<string | null> => {
    const state = useEditorStore.getState();
    try {
      const response = await fetch(`${API_BASE}/api/dashboards`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:   state.dashboardName || 'Untitled Dashboard',
          status: 'draft',
          config: {
            components: state.components,
            queries:    state.queriesConfig,
          },
        }),
      });
      if (!response.ok) {
        console.error('[builder] create failed:', await response.text());
        return null;
      }
      const created = await response.json();
      return created.id as string;
    } catch (err) {
      console.error('[builder] create network error:', err);
      return null;
    }
  };

  const handleSave = async () => {
    saveToLocalStorage();

    if (isPersistedDashboard(id)) {
      await persistDashboard();
    } else {
      const newId = await persistAsNewDashboard();
      if (newId) {
        // Clear the local-only "saved template" entry so we don't get a
        // ghost copy in the gallery alongside the real DB row.
        if (id) {
          const fresh = useEditorStore.getState();
          if (fresh.savedTemplates[id]) {
            useEditorStore.getState().deleteSavedTemplate?.(id);
          }
        }
        navigate(`/builder/${newId}`, { replace: true });
      }
    }

    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
  };

  const handleNameBlur = () => {
    if (!dashboardName.trim()) {
      setDashboardName('Untitled Dashboard');
    }
    // Only persist name on blur for already-saved (UUID) dashboards.
    // For prebuilts the user must hit Save explicitly to create the row.
    if (isPersistedDashboard(id)) {
      persistDashboard(true);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleReset = () => {
    if (!originalTemplateId) return;
    
    if (originalTemplateId.startsWith('blank')) {
      resetToTemplate(originalTemplateId, 'Untitled Dashboard', []);
    } else {
      const template = getTemplateById(originalTemplateId);
      if (template) {
        resetToTemplate(template.id, template.name, template.components);
      } else {
        // Fallback for custom dashboards: Reset to empty if template not found
        resetToTemplate(originalTemplateId, 'Dashboard', []);
      }
    }
    setShowResetConfirm(false);
  };

  const isSaved = activeTemplateId ? !!savedTemplates[activeTemplateId] : false;

  return (
    <div className={`builder-layout ${isPreviewMode ? 'preview-mode' : ''} device-${previewDevice}`}>
      {/* ARIA Live Region */}
      <div className="sr-only" aria-live="polite">
        {isPreviewMode ? 'Preview mode active' : 'Edit mode active'}
      </div>

      {/* Top Bar */}
      {!isPreviewMode && (
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
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            placeholder="Dashboard name"
            style={{ width: `${nameWidth}px` }}
          />

          {!isPreviewMode && id && id.length > 10 && (
            <div className="assignment-tags">
              {assignedCustomers.slice(0, 3).map(c => (
                <span key={c.id} className="customer-tag">{c.name}</span>
              ))}
              {assignedCustomers.length > 3 && (
                <span className="customer-tag">+{assignedCustomers.length - 3} more</span>
              )}
              <button 
                className="btn-add-assignment" 
                onClick={() => setIsAssignmentModalOpen(true)}
              >
                + Add
              </button>
            </div>
          )}
        </div>

        {/* Unsaved Changes Note */}
        {isPreviewMode && hasUnsavedChanges && (
          <div className="unsaved-changes-note">
            Previewing unsaved changes
          </div>
        )}

        {/* Publish Toggle */}
        {!isPreviewMode && id && id.length > 10 && (
          <PublishToggle />
        )}

        <div className="topbar-actions">
          {(isSaved || hasUnsavedChanges) && !showResetConfirm && !isPreviewMode && (
            <button
              className="btn-topbar danger-text"
              onClick={() => setShowResetConfirm(true)}
              title="Reset dashboard to original template state"
            >
              Reset
            </button>
          )}
          {showResetConfirm && !isPreviewMode && (
            <div className="reset-confirm-inline">
              <span>Reset all?</span>
              <button className="confirm-yes" onClick={handleReset}>Yes</button>
              <button className="confirm-no" onClick={() => setShowResetConfirm(false)}>No</button>
            </div>
          )}

          {!isPreviewMode && (
            <>
              <button
                className="btn-topbar"
                onClick={handleExport}
                title="Download full project ZIP"
              >
                ⤓ Export
              </button>
              <button
                className="btn-topbar"
                onClick={handleImportClick}
                title="Upload project ZIP"
              >
                ⤒ Import
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".zip"
                onChange={handleImport}
              />
            </>
          )}
          
          {/* Desktop / Mobile width toggle — only visible in edit mode */}
          {!isPreviewMode && (
            <div className="device-toggle" role="group" aria-label="Canvas width">
              <button
                type="button"
                className={`device-toggle__btn${previewDevice === 'desktop' ? ' device-toggle__btn--active' : ''}`}
                onClick={() => setPreviewDevice('desktop')}
                title="Desktop width"
                aria-pressed={previewDevice === 'desktop'}
              >
                🖥
              </button>
              <button
                type="button"
                className={`device-toggle__btn${previewDevice === 'mobile' ? ' device-toggle__btn--active' : ''}`}
                onClick={() => setPreviewDevice('mobile')}
                title="Mobile width (375px)"
                aria-pressed={previewDevice === 'mobile'}
              >
                📱
              </button>
            </div>
          )}

          <button
            className={`btn-preview-toggle ${isPreviewMode ? 'preview-active' : ''}`}
            onClick={togglePreviewMode}
            title="Toggle preview mode (Ctrl+Shift+P)"
            aria-label="Toggle preview mode"
            aria-pressed={isPreviewMode}
          >
            {isPreviewMode ? (
              <>
                <span className="toggle-icon">✎</span>
                <span className="toggle-label">Edit</span>
              </>
            ) : (
              <>
                <span className="toggle-icon">👁</span>
                <span className="toggle-label">Preview</span>
              </>
            )}
          </button>

          <button
            className={`btn-topbar primary ${saveFlash ? 'saved' : ''}`}
            onClick={handleSave}
          >
            {saveFlash ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
      )}
      
      {/* Floating Exit Preview Button */}
      {isPreviewMode && (
        <div className="floating-preview-actions">
          <button
            className="btn-preview-toggle preview-active"
            onClick={togglePreviewMode}
            title="Exit preview mode (Ctrl+Shift+P)"
          >
            <span className="toggle-icon">✎</span>
            <span className="toggle-label">Exit Preview</span>
          </button>
        </div>
      )}

      {/* Body */}
      <div className="builder-body">
        {/* Narrow Sidebar Toggle - only in edit mode */}
        {!isPreviewMode && (
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
        )}

        {/* Left Panel */}
        {!isPreviewMode && isLeftPanelOpen && <LeftPanel onClose={() => setIsLeftPanelOpen(false)} />}

        {/* Canvas */}
        <Canvas readOnly={isPreviewMode} />

        {/* Right Panel */}
        {!isPreviewMode && selectedComponentId && <RightPanel />}
      </div>

      {isAssignmentModalOpen && (
        <AssignmentModal 
          onClose={() => setIsAssignmentModalOpen(false)} 
          onUpdate={fetchAssignedCustomers}
        />
      )}
    </div>
  );
}
